const { query, withTransaction } = require('../db/pool');
const { registrarVenta } = require('../services/ventas.service');
const { invalido } = require('../services/errores');

async function postVenta(req, res) {
  const b = req.body || {};
  if (!req.moduloId) throw invalido('Elige el módulo donde se vende.');
  const items = (b.items || []).map((i) => ({ productoId: i.producto_id, saborId: i.sabor_id, cantidad: i.cantidad }));
  const venta = await withTransaction((c) => registrarVenta(c, {
    moduloId: req.moduloId, usuarioId: req.usuario.id, items, medioPago: b.medio_pago,
  }));
  res.status(201).json(venta);
}

async function getVentas(req, res) {
  const limite = Math.min(Number(req.query.limit) || 30, 200);
  const turnoId = req.query.turno_id ? Number(req.query.turno_id) : null;
  const { rows } = await query(
    `SELECT v.id, v.modulo_id, m.nombre AS modulo, v.turno_id, v.fecha_hora, v.medio_pago, v.monto_total, v.anulada,
            u.nombre AS vendedor,
            (SELECT string_agg(vd.cantidad || ' × ' || p.nombre || ' ' || s.nombre, ', ' ORDER BY vd.id)
               FROM venta_detalle vd JOIN productos p ON p.id = vd.producto_id JOIN sabores s ON s.id = vd.sabor_id
              WHERE vd.venta_id = v.id) AS resumen,
            (SELECT COALESCE(SUM(vd.descuento), 0) FROM venta_detalle vd WHERE vd.venta_id = v.id) AS descuento
       FROM ventas v JOIN modulos m ON m.id = v.modulo_id JOIN usuarios u ON u.id = v.usuario_id
      WHERE ($1::int IS NULL OR v.modulo_id = $1) AND ($2::int IS NULL OR v.turno_id = $2)
      ORDER BY v.fecha_hora DESC, v.id DESC LIMIT $3`,
    [req.moduloId, turnoId, limite]
  );
  res.json(rows);
}

module.exports = { postVenta, getVentas };
