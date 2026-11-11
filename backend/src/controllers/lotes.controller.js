const { query, withTransaction } = require('../db/pool');
const { registrarEntrega } = require('../services/lotes.service');
const { invalido } = require('../services/errores');

const lineaDe = (l) => ({ productoId: Number(l.producto_id), saborId: Number(l.sabor_id), cantidad: Number(l.cantidad) });
const turnoValido = (t) => (t === 'manana' || t === 'tarde' ? t : null);

// Un lote suelto (una sola línea).
async function postLote(req, res) {
  const b = req.body || {};
  const lotes = await withTransaction((c) => registrarEntrega(c, {
    moduloId: req.moduloId, repartidorId: req.usuario.id, lineas: [lineaDe(b)], turno: turnoValido(b.turno),
  }));
  res.status(201).json(lotes[0]);
}

// Una entrega con varias líneas: cada una crea un lote en Día 1 (RF-04, RF-05).
async function postEntrega(req, res) {
  const b = req.body || {};
  if (!Array.isArray(b.lineas)) throw invalido('La entrega no tiene líneas.');
  const lotes = await withTransaction((c) => registrarEntrega(c, {
    moduloId: req.moduloId, repartidorId: req.usuario.id, lineas: b.lineas.map(lineaDe), turno: turnoValido(b.turno),
  }));
  res.status(201).json({ lotes, unidades: lotes.reduce((a, l) => a + l.cantidad_inicial, 0) });
}

// Últimos lotes de un módulo con su cantidad actual, estado, día y turno de recepción (RF-06).
async function getLotes(req, res) {
  const limite = Math.min(Number(req.query.limit) || 40, 200);
  const { rows } = await query(
    `SELECT l.id, l.modulo_id, m.nombre AS modulo, p.nombre AS producto, s.nombre AS sabor,
            l.cantidad_inicial, l.cantidad_actual, l.fecha_recepcion, l.turno_recepcion, l.estado,
            GREATEST(1, (CURRENT_DATE - l.fecha_recepcion::date) + 1) AS dia, p.dias_limite_venta AS dia_limite,
            u.nombre AS repartidor
       FROM lotes l
       JOIN productos p ON p.id = l.producto_id JOIN sabores s ON s.id = l.sabor_id
       JOIN modulos m ON m.id = l.modulo_id LEFT JOIN usuarios u ON u.id = l.repartidor_id
      WHERE ($1::int IS NULL OR l.modulo_id = $1)
      ORDER BY l.fecha_recepcion DESC, l.id DESC LIMIT $2`,
    [req.moduloId, limite]
  );
  res.json(rows);
}

module.exports = { postLote, postEntrega, getLotes };
