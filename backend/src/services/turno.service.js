// Control de caja y entrega de turno (RN-04, RN-08, RN-12).
const { conflicto, noEncontrado, invalido } = require('./errores');
const { redondear } = require('./promociones.service');

const AHORA = 'COALESCE($AHORA::timestamp, now()::timestamp)';
const conAhora = (sql, idx) => sql.replaceAll('$AHORA', `$${idx}`);

// Franja (mañana/tarde) y fecha de un instante, calculadas por PostgreSQL en hora de Lima.
async function franjaDe(client, ahora = null) {
  const { rows } = await client.query(conAhora(
    `SELECT (${AHORA})::date::text AS fecha,
            CASE WHEN EXTRACT(HOUR FROM ${AHORA}) >= 16 THEN 'tarde' ELSE 'manana' END AS tipo`, 1), [ahora]);
  return rows[0];
}

// Turno de la franja actual en el módulo (abierto o ya cerrado), o null si no se abrió.
async function turnoDeFranja(client, moduloId, ahora = null) {
  const { fecha, tipo } = await franjaDe(client, ahora);
  const { rows } = await client.query(
    `SELECT t.*, u.nombre AS usuario_nombre FROM turnos t JOIN usuarios u ON u.id = t.usuario_id
      WHERE t.modulo_id = $1 AND t.fecha = $2 AND t.tipo = $3`,
    [moduloId, fecha, tipo]
  );
  return { fecha, tipo, turno: rows[0] || null };
}

// RN-04: solo se vende con el turno de la franja actual abierto.
async function exigirTurnoAbierto(client, moduloId, ahora = null) {
  const { turno, tipo } = await turnoDeFranja(client, moduloId, ahora);
  if (!turno || turno.hora_cierre) {
    throw conflicto(`No hay un turno de ${tipo === 'manana' ? 'mañana' : 'tarde'} abierto en este módulo. Abre la caja para vender.`);
  }
  return turno;
}

async function abrirTurno(client, { moduloId, usuarioId, efectivoApertura, ahora = null }) {
  const monto = Number(efectivoApertura);
  if (!Number.isFinite(monto) || monto < 0) throw invalido('El efectivo de apertura debe ser un monto válido.');
  const { fecha, tipo, turno } = await turnoDeFranja(client, moduloId, ahora);
  if (turno) throw conflicto('El turno de esta franja ya fue abierto en este módulo.');
  const { rows } = await client.query(
    `INSERT INTO turnos (modulo_id, usuario_id, tipo, fecha, hora_apertura, efectivo_apertura)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamp, now()::timestamp), $6) RETURNING *`,
    [moduloId, usuarioId, tipo, fecha, ahora, redondear(monto)]
  );
  return rows[0];
}

async function resumenTurno(client, turnoId) {
  const { rows: [turno] } = await client.query('SELECT * FROM turnos WHERE id = $1', [turnoId]);
  if (!turno) throw noEncontrado('El turno');
  const { rows } = await client.query(
    `SELECT medio_pago, COUNT(*) AS ventas, COALESCE(SUM(monto_total), 0) AS monto
       FROM ventas WHERE turno_id = $1 AND NOT anulada GROUP BY medio_pago`,
    [turnoId]
  );
  const porMedio = { efectivo: 0, tarjeta: 0, yape: 0 };
  let ventas = 0;
  rows.forEach((r) => { porMedio[r.medio_pago] = r.monto; ventas += r.ventas; });
  const total = redondear(porMedio.efectivo + porMedio.tarjeta + porMedio.yape);
  // RN-08: efectivo esperado = apertura + ventas en efectivo del turno.
  const esperado = redondear(Number(turno.efectivo_apertura) + porMedio.efectivo);
  return { turno, porMedio, ventas, total, esperado };
}

async function cerrarTurno(client, { turnoId, efectivoCierre, ahora = null }) {
  const contado = Number(efectivoCierre);
  if (!Number.isFinite(contado) || contado < 0) throw invalido('El efectivo contado debe ser un monto válido.');
  const { rows: [t] } = await client.query('SELECT * FROM turnos WHERE id = $1 FOR UPDATE', [turnoId]);
  if (!t) throw noEncontrado('El turno');
  if (t.hora_cierre) throw conflicto('El turno ya estaba cerrado.');
  const { esperado } = await resumenTurno(client, turnoId);
  const desajuste = redondear(contado - esperado);
  const { rows } = await client.query(
    `UPDATE turnos SET hora_cierre = COALESCE($2::timestamp, now()::timestamp),
            efectivo_cierre = $3, efectivo_esperado = $4, desajuste = $5
      WHERE id = $1 RETURNING *`,
    [turnoId, ahora, redondear(contado), esperado, desajuste]
  );
  return rows[0];
}

// Composición del stock por sabor y día del módulo: qué vender primero y qué devolver.
async function composicionStock(client, moduloId, fecha = null) {
  const { rows } = await client.query(
    `SELECT l.id AS lote_id, p.id AS producto_id, p.nombre AS producto, s.id AS sabor_id, s.nombre AS sabor,
            l.cantidad_actual AS cantidad, p.dias_limite_venta AS limite,
            GREATEST(1, (COALESCE($2::date, CURRENT_DATE) - l.fecha_recepcion::date) + 1) AS dia
       FROM lotes l JOIN productos p ON p.id = l.producto_id JOIN sabores s ON s.id = l.sabor_id
      WHERE l.modulo_id = $1 AND l.estado = 'activo' AND l.cantidad_actual > 0
      ORDER BY p.nombre, s.nombre, l.fecha_recepcion, l.id`,
    [moduloId, fecha]
  );
  const grupos = new Map();
  rows.forEach((r) => {
    const k = `${r.producto_id}|${r.sabor_id}`;
    if (!grupos.has(k)) grupos.set(k, { producto: r.producto, sabor: r.sabor, limite: r.limite, lotes: [] });
    grupos.get(k).lotes.push({ dia: r.dia, cantidad: r.cantidad, devolver: r.dia >= r.limite });
  });
  return [...grupos.values()].map((g) => {
    const vendibles = g.lotes.filter((l) => !l.devolver);
    return {
      ...g,
      total: vendibles.reduce((a, l) => a + l.cantidad, 0),
      porDevolver: g.lotes.filter((l) => l.devolver).reduce((a, l) => a + l.cantidad, 0),
      venderPrimero: vendibles[0] ? { dia: vendibles[0].dia, cantidad: vendibles[0].cantidad } : null,
    };
  });
}

// RN-12: la entrega de turno guarda la composición de stock por sabor y día, el efectivo esperado y un comentario.
async function entregarTurno(client, { turnoId, usuarioId, comentario = '', ahora = null }) {
  const { turno, esperado, total, porMedio } = await resumenTurno(client, turnoId);
  const { rows: [ya] } = await client.query('SELECT id FROM entregas_turno WHERE turno_id = $1', [turnoId]);
  if (ya) throw conflicto('Este turno ya fue entregado.');
  const fecha = ahora ? ahora.slice(0, 10) : null;
  const stock = await composicionStock(client, turno.modulo_id, fecha);
  const nota = {
    turno: turno.tipo,
    fecha: turno.fecha,
    efectivo_esperado: esperado,
    ventas_total: total,
    ventas_por_medio: porMedio,
    por_devolver: stock.reduce((a, g) => a + g.porDevolver, 0),
    stock: stock.map((g) => ({
      producto: g.producto,
      sabor: g.sabor,
      lotes: g.lotes,
      vender_primero: g.venderPrimero,
      por_devolver: g.porDevolver,
    })),
    comentario: String(comentario || '').slice(0, 500),
  };
  const { rows } = await client.query(
    `INSERT INTO entregas_turno (turno_id, modulo_id, usuario_id, nota, creado_en)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamp, now()::timestamp)) RETURNING *`,
    [turnoId, turno.modulo_id, usuarioId, nota, ahora]
  );
  return rows[0];
}

module.exports = {
  franjaDe, turnoDeFranja, exigirTurnoAbierto, abrirTurno, resumenTurno, cerrarTurno, composicionStock, entregarTurno,
};
