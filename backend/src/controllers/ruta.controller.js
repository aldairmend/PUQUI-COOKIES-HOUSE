const { query } = require('../db/pool');

// Ruta del día del repartidor: qué módulos ya recibieron y qué lotes hay por recoger (RF-33).
async function getRutaHoy(req, res) {
  const { rows: modulos } = await query(
    `SELECT m.id, m.nombre, m.direccion,
            COUNT(l.id)::int AS lotes_hoy,
            COALESCE(SUM(l.cantidad_inicial), 0)::int AS unidades_hoy,
            MIN(l.fecha_recepcion) AS primera_entrega
       FROM modulos m
       LEFT JOIN lotes l ON l.modulo_id = m.id AND l.fecha_recepcion::date = CURRENT_DATE
      WHERE m.activo
      GROUP BY m.id ORDER BY m.id`
  );
  const { rows: recoger } = await query(
    `SELECT lote_id, modulo_id, producto, sabor, cantidad_actual, dia, dia_limite, fecha_recepcion
       FROM v_stock_actual WHERE debe_devolverse ORDER BY modulo_id, fecha_recepcion`
  );
  res.json(modulos.map((m) => ({
    ...m,
    entregado: m.lotes_hoy > 0,
    por_recoger: recoger.filter((r) => r.modulo_id === m.id),
  })));
}

module.exports = { getRutaHoy };
