const { query, withTransaction } = require('../db/pool');
const { registrarDevolucion } = require('../services/lotes.service');
const { invalido } = require('../services/errores');

// Lotes que alcanzaron su día límite y deben devolverse (RF-22).
async function getPendientes(req, res) {
  const { rows } = await query(
    `SELECT lote_id, modulo_id, modulo, producto, sabor, cantidad_actual, cantidad_inicial,
            fecha_recepcion, dia, dia_limite
       FROM v_stock_actual
      WHERE debe_devolverse AND ($1::int IS NULL OR modulo_id = $1)
      ORDER BY modulo_id, fecha_recepcion, lote_id`,
    [req.moduloId]
  );
  res.json(rows);
}

async function postDevolucion(req, res) {
  const b = req.body || {};
  if (!b.lote_id) throw invalido('Elige el lote a devolver.');
  const dev = await withTransaction((c) => registrarDevolucion(c, {
    loteId: Number(b.lote_id), cantidad: b.cantidad, usuario: req.usuario, motivo: b.motivo,
  }));
  res.status(201).json(dev);
}

// Historial de devoluciones ligado a producto, sabor, módulo, usuario y fecha (RF-24).
async function getDevoluciones(req, res) {
  const limite = Math.min(Number(req.query.limit) || 30, 200);
  const { rows } = await query(
    `SELECT d.id, d.lote_id, d.modulo_id, m.nombre AS modulo, p.nombre AS producto, s.nombre AS sabor,
            d.cantidad, d.motivo, d.fecha, u.nombre AS usuario, u.rol AS usuario_rol,
            GREATEST(1, (d.fecha::date - l.fecha_recepcion::date) + 1) AS dia
       FROM devoluciones d
       JOIN lotes l ON l.id = d.lote_id JOIN productos p ON p.id = l.producto_id JOIN sabores s ON s.id = l.sabor_id
       JOIN modulos m ON m.id = d.modulo_id JOIN usuarios u ON u.id = d.usuario_id
      WHERE ($1::int IS NULL OR d.modulo_id = $1)
      ORDER BY d.fecha DESC, d.id DESC LIMIT $2`,
    [req.moduloId, limite]
  );
  res.json(rows);
}

module.exports = { getPendientes, postDevolucion, getDevoluciones };
