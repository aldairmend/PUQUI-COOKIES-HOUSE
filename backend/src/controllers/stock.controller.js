const { query } = require('../db/pool');
const { moduloRequerido } = require('./comun');

// Stock por producto, sabor y día de antigüedad, con el lote que sale primero (RF-14, RF-15).
async function getStock(req, res) {
  const moduloId = await moduloRequerido(req);
  const { rows: productos } = await query(
    `SELECT p.id AS producto_id, p.nombre AS producto, p.precio_base, p.dias_limite_venta, s.id AS sabor_id, s.nombre AS sabor
       FROM productos p JOIN sabores s ON s.producto_id = p.id WHERE p.activo AND s.activo ORDER BY p.id, s.id`
  );
  const { rows: lotes } = await query(
    `SELECT lote_id, producto_id, sabor_id, cantidad_inicial, cantidad_actual, fecha_recepcion, turno_recepcion,
            dia, dia_limite, debe_devolverse
       FROM v_stock_actual WHERE modulo_id = $1 ORDER BY fecha_recepcion, lote_id`,
    [moduloId]
  );
  const grupos = productos.map((p) => {
    const ls = lotes.filter((l) => l.producto_id === p.producto_id && l.sabor_id === p.sabor_id);
    const vendibles = ls.filter((l) => !l.debe_devolverse);
    return {
      ...p,
      lotes: ls,
      total: vendibles.reduce((a, l) => a + l.cantidad_actual, 0),
      por_devolver: ls.filter((l) => l.debe_devolverse).reduce((a, l) => a + l.cantidad_actual, 0),
      sale_primero: vendibles[0] ? { lote_id: vendibles[0].lote_id, dia: vendibles[0].dia, cantidad: vendibles[0].cantidad_actual } : null,
    };
  });
  res.json({ modulo_id: moduloId, grupos });
}

// Historial de rotación por turno, día y sabor (RF-16), a partir de v_historial_rotacion.
async function getHistorial(req, res) {
  const moduloId = await moduloRequerido(req);
  const dias = Math.min(Math.max(Number(req.query.dias) || 7, 1), 60);
  const saborId = req.query.sabor_id ? Number(req.query.sabor_id) : null;
  const { rows } = await query(
    `SELECT fecha_hora::date::text AS fecha, turno, producto, sabor, dia_al_vender, SUM(cantidad_tomada)::int AS cantidad
       FROM v_historial_rotacion
      WHERE modulo_id = $1 AND fecha_hora >= CURRENT_DATE - ($2::int - 1)
        AND ($3::int IS NULL OR sabor_id = $3)
      GROUP BY 1, 2, 3, 4, 5
      ORDER BY 1 DESC, 2 DESC, 3, 4, 5 DESC
      LIMIT 300`,
    [moduloId, dias, saborId]
  );
  res.json(rows);
}

module.exports = { getStock, getHistorial };
