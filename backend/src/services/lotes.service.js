// Entregas (RN-01) y devoluciones (RN-09) de lotes.
const { invalido, noEncontrado, conflicto, prohibido } = require('./errores');

// Registra una entrega con varias líneas: cada línea crea un lote nuevo que empieza en Día 1.
async function registrarEntrega(client, { moduloId, repartidorId, lineas, turno = null, ahora = null }) {
  if (!moduloId) throw invalido('Elige el módulo que recibe la entrega.');
  const validas = (lineas || []).filter((l) => Number(l.cantidad) > 0);
  if (validas.length === 0) throw invalido('La entrega no tiene cantidades.');
  const { rows: [m] } = await client.query('SELECT id FROM modulos WHERE id = $1 AND activo', [moduloId]);
  if (!m) throw noEncontrado('El módulo');

  const lotes = [];
  for (const l of validas) {
    const cantidad = Number(l.cantidad);
    if (!Number.isInteger(cantidad)) throw invalido('Las cantidades deben ser números enteros.');
    const { rows: [s] } = await client.query(
      'SELECT id FROM sabores WHERE id = $1 AND producto_id = $2 AND activo', [l.saborId, l.productoId]
    );
    if (!s) throw invalido('Hay un sabor que no corresponde a su producto.');
    const { rows: [lote] } = await client.query(
      `INSERT INTO lotes (producto_id, sabor_id, modulo_id, repartidor_id, cantidad_inicial, cantidad_actual,
                          fecha_recepcion, turno_recepcion, creado_en)
       VALUES ($1, $2, $3, $4, $5, $5, COALESCE($6::timestamp, now()::timestamp),
               COALESCE($7::tipo_turno, CASE WHEN EXTRACT(HOUR FROM COALESCE($6::timestamp, now()::timestamp)) >= 16
                                             THEN 'tarde'::tipo_turno ELSE 'manana'::tipo_turno END),
               COALESCE($6::timestamp, now()::timestamp))
       RETURNING *`,
      [l.productoId, l.saborId, moduloId, repartidorId, cantidad, ahora, turno]
    );
    lotes.push(lote);
  }
  return lotes;
}

// Registra la devolución de un lote. Si queda en cero, su estado pasa a «devuelto».
async function registrarDevolucion(client, { loteId, cantidad = null, usuario, motivo = 'limite_dias', ahora = null }) {
  const { rows: [lote] } = await client.query('SELECT * FROM lotes WHERE id = $1 FOR UPDATE', [loteId]);
  if (!lote) throw noEncontrado('El lote');
  if (usuario.rol === 'vendedor' && Number(lote.modulo_id) !== Number(usuario.modulo_id)) {
    throw prohibido('Solo puedes devolver lotes de tu módulo.');
  }
  if (lote.estado !== 'activo' || lote.cantidad_actual <= 0) throw conflicto('Este lote ya no tiene unidades para devolver.');
  const cant = cantidad === null || cantidad === undefined || cantidad === '' ? lote.cantidad_actual : Number(cantidad);
  if (!Number.isInteger(cant) || cant <= 0) throw invalido('La cantidad a devolver debe ser un entero mayor que cero.');
  if (cant > lote.cantidad_actual) throw conflicto(`No puedes devolver ${cant}: el lote solo tiene ${lote.cantidad_actual}.`);
  const motivos = ['limite_dias', 'merma', 'otro'];
  const mot = motivos.includes(motivo) ? motivo : 'otro';

  const restante = lote.cantidad_actual - cant;
  await client.query('UPDATE lotes SET cantidad_actual = $1, estado = $2 WHERE id = $3',
    [restante, restante === 0 ? 'devuelto' : 'activo', loteId]);
  const { rows: [dev] } = await client.query(
    `INSERT INTO devoluciones (lote_id, modulo_id, usuario_id, cantidad, motivo, fecha)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamp, now()::timestamp)) RETURNING *`,
    [loteId, lote.modulo_id, usuario.id, cant, mot, ahora]
  );
  return dev;
}

module.exports = { registrarEntrega, registrarDevolucion };
