const { query, withTransaction } = require('../db/pool');
const T = require('../services/turno.service');
const { noEncontrado, prohibido } = require('../services/errores');
const { moduloRequerido } = require('./comun');

// El vendedor solo opera turnos de su módulo.
async function turnoPermitido(client, req) {
  const { rows: [t] } = await client.query('SELECT * FROM turnos WHERE id = $1', [Number(req.params.turnoId)]);
  if (!t) throw noEncontrado('El turno');
  if (req.usuario.rol === 'vendedor' && t.modulo_id !== Number(req.usuario.modulo_id)) {
    throw prohibido('Solo puedes operar los turnos de tu módulo.');
  }
  return t;
}

async function postAbrir(req, res) {
  const moduloId = await moduloRequerido(req);
  const turno = await withTransaction((c) => T.abrirTurno(c, {
    moduloId, usuarioId: req.usuario.id, efectivoApertura: (req.body || {}).efectivo_apertura,
  }));
  res.status(201).json(turno);
}

async function patchCerrar(req, res) {
  const turno = await withTransaction(async (c) => {
    const t = await turnoPermitido(c, req);
    return T.cerrarTurno(c, { turnoId: t.id, efectivoCierre: (req.body || {}).efectivo_cierre });
  });
  res.json(turno);
}

async function postEntregar(req, res) {
  const entrega = await withTransaction(async (c) => {
    const t = await turnoPermitido(c, req);
    return T.entregarTurno(c, { turnoId: t.id, usuarioId: req.usuario.id, comentario: (req.body || {}).comentario });
  });
  res.status(201).json(entrega);
}

// Turno de la franja actual del módulo, con su resumen si ya se abrió.
async function getActivo(req, res) {
  const moduloId = await moduloRequerido(req);
  const r = await withTransaction(async (c) => {
    const f = await T.turnoDeFranja(c, moduloId);
    const resumen = f.turno ? await T.resumenTurno(c, f.turno.id) : null;
    const { rows: [entrega] } = f.turno
      ? await c.query('SELECT id, creado_en FROM entregas_turno WHERE turno_id = $1', [f.turno.id])
      : { rows: [] };
    return { modulo_id: moduloId, fecha: f.fecha, tipo: f.tipo, turno: f.turno, resumen, entrega: entrega || null };
  });
  res.json(r);
}

// Resumen de un turno: ventas por medio de pago y efectivo esperado (RF-19).
async function getResumen(req, res) {
  const r = await withTransaction(async (c) => {
    let turnoId = req.query.turno_id ? Number(req.query.turno_id) : null;
    if (!turnoId) {
      const f = await T.turnoDeFranja(c, await moduloRequerido(req));
      if (!f.turno) return null;
      turnoId = f.turno.id;
    }
    const { rows: [t] } = await c.query('SELECT modulo_id FROM turnos WHERE id = $1', [turnoId]);
    if (!t) throw noEncontrado('El turno');
    if (req.usuario.rol === 'vendedor' && t.modulo_id !== Number(req.usuario.modulo_id)) throw prohibido();
    return T.resumenTurno(c, turnoId);
  });
  res.json(r);
}

// Última nota de entrega de turno del módulo, para el turno siguiente (RF-21).
async function getNotaAnterior(req, res) {
  const moduloId = await moduloRequerido(req);
  const { rows: [nota] } = await query(
    `SELECT e.id, e.turno_id, e.nota, e.creado_en, u.nombre AS usuario
       FROM entregas_turno e JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.modulo_id = $1 ORDER BY e.creado_en DESC, e.id DESC LIMIT 1`,
    [moduloId]
  );
  res.json(nota || null);
}

// Historial de turnos con esperado, contado y desajuste.
async function getTurnos(req, res) {
  const limite = Math.min(Number(req.query.limit) || 20, 200);
  const { rows } = await query(
    `SELECT t.id, t.modulo_id, m.nombre AS modulo, t.tipo, t.fecha, t.hora_apertura, t.hora_cierre,
            t.efectivo_apertura, t.efectivo_cierre, t.efectivo_esperado, t.desajuste, u.nombre AS usuario,
            (SELECT COALESCE(SUM(monto_total), 0) FROM ventas v WHERE v.turno_id = t.id AND NOT v.anulada) AS ventas_total
       FROM turnos t JOIN modulos m ON m.id = t.modulo_id JOIN usuarios u ON u.id = t.usuario_id
      WHERE ($1::int IS NULL OR t.modulo_id = $1)
      ORDER BY t.fecha DESC, t.tipo DESC, t.modulo_id LIMIT $2`,
    [req.moduloId, limite]
  );
  res.json(rows);
}

module.exports = { postAbrir, patchCerrar, postEntregar, getActivo, getResumen, getNotaAnterior, getTurnos };
