// Reportes consolidados (RF-32): por rango de fechas (desde/hasta) y, opcionalmente, por módulo.
const { query } = require('../db/pool');
const { rangoFechas, SQL_RANGO } = require('./comun');

const params = (req) => {
  const { desde, hasta } = rangoFechas(req);
  return [desde, hasta, req.moduloId];
};

async function ventasPorMedioPago(req, res) {
  const { rows } = await query(
    `SELECT medio_pago AS medio, COUNT(*)::int AS ventas, COALESCE(SUM(monto_total), 0) AS monto
       FROM ventas WHERE NOT anulada AND ${SQL_RANGO('fecha_hora', 1)} AND ($3::int IS NULL OR modulo_id = $3)
      GROUP BY 1 ORDER BY 3 DESC`, params(req));
  res.json(rows);
}

async function ventasPorProducto(req, res) {
  const { rows } = await query(
    `SELECT p.nombre AS producto, s.nombre AS sabor, SUM(vd.cantidad)::int AS unidades,
            SUM(vd.cantidad * vd.precio_unitario - vd.descuento) AS monto, SUM(vd.descuento) AS descuento
       FROM venta_detalle vd JOIN ventas v ON v.id = vd.venta_id
       JOIN productos p ON p.id = vd.producto_id JOIN sabores s ON s.id = vd.sabor_id
      WHERE NOT v.anulada AND ${SQL_RANGO('v.fecha_hora', 1)} AND ($3::int IS NULL OR v.modulo_id = $3)
      GROUP BY p.id, p.nombre, s.id, s.nombre ORDER BY p.id, monto DESC`, params(req));
  res.json(rows);
}

async function caja(req, res) {
  const { rows } = await query(
    `SELECT t.id, t.fecha, t.tipo, m.nombre AS modulo, u.nombre AS usuario, t.efectivo_apertura, t.efectivo_esperado,
            t.efectivo_cierre, t.desajuste, t.hora_cierre,
            (SELECT COALESCE(SUM(monto_total), 0) FROM ventas v WHERE v.turno_id = t.id AND NOT v.anulada) AS ventas_total
       FROM turnos t JOIN modulos m ON m.id = t.modulo_id JOIN usuarios u ON u.id = t.usuario_id
      WHERE ${SQL_RANGO('t.fecha', 1)} AND ($3::int IS NULL OR t.modulo_id = $3)
      ORDER BY t.fecha DESC, t.tipo DESC, m.id`, params(req));
  const cerrados = rows.filter((r) => r.hora_cierre);
  res.json({
    turnos: rows,
    resumen: {
      turnos: rows.length,
      cerrados: cerrados.length,
      cuadrados: cerrados.filter((r) => Number(r.desajuste) === 0).length,
      faltantes: cerrados.filter((r) => Number(r.desajuste) < 0).length,
      sobrantes: cerrados.filter((r) => Number(r.desajuste) > 0).length,
      desajuste_total: Math.round(cerrados.reduce((a, r) => a + Number(r.desajuste), 0) * 100) / 100,
    },
  });
}

async function devoluciones(req, res) {
  const { rows } = await query(
    `SELECT p.nombre AS producto, s.nombre AS sabor, d.motivo, COUNT(*)::int AS registros, SUM(d.cantidad)::int AS unidades,
            SUM(d.cantidad * p.precio_base) AS valor
       FROM devoluciones d JOIN lotes l ON l.id = d.lote_id
       JOIN productos p ON p.id = l.producto_id JOIN sabores s ON s.id = l.sabor_id
      WHERE ${SQL_RANGO('d.fecha', 1)} AND ($3::int IS NULL OR d.modulo_id = $3)
      GROUP BY p.id, p.nombre, s.id, s.nombre, d.motivo ORDER BY unidades DESC`, params(req));
  res.json(rows);
}

module.exports = { ventasPorMedioPago, ventasPorProducto, caja, devoluciones };
