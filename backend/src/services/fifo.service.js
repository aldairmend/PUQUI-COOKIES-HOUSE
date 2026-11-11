// Lógica FIFO por sabor y día (RN-01 a RN-03): reemplaza la hojita.
const { StockInsuficienteError } = require('./errores');

// Lotes vendibles del producto, sabor y módulo, del más antiguo al más nuevo, bloqueados para la venta.
// Un lote que ya alcanzó el límite de días de su producto no es vendible (misma fórmula que v_stock_actual).
async function obtenerLotesFIFO(client, { productoId, saborId, moduloId, fecha = null, bloquear = true }) {
  const { rows } = await client.query(
    `SELECT l.id, l.cantidad_actual, l.fecha_recepcion,
            GREATEST(1, (COALESCE($4::date, CURRENT_DATE) - l.fecha_recepcion::date) + 1) AS dia
       FROM lotes l
       JOIN productos p ON p.id = l.producto_id
      WHERE l.producto_id = $1 AND l.sabor_id = $2 AND l.modulo_id = $3
        AND l.estado = 'activo' AND l.cantidad_actual > 0
        AND GREATEST(1, (COALESCE($4::date, CURRENT_DATE) - l.fecha_recepcion::date) + 1) < p.dias_limite_venta
      ORDER BY l.fecha_recepcion, l.id
      ${bloquear ? 'FOR UPDATE OF l' : ''}`,
    [productoId, saborId, moduloId, fecha]
  );
  return rows;
}

async function consumirStockFIFO(client, { productoId, saborId, moduloId, cantidad, fecha = null, nombres = {} }) {
  const lotes = await obtenerLotesFIFO(client, { productoId, saborId, moduloId, fecha });
  const disponible = lotes.reduce((acc, l) => acc + l.cantidad_actual, 0);
  if (disponible < cantidad) {
    throw new StockInsuficienteError({ productoId, saborId, moduloId, disponible, cantidad, ...nombres });
  }
  const consumos = [];
  let restante = cantidad;
  for (const lote of lotes) { // del más antiguo al más nuevo
    if (restante <= 0) break;
    const tomar = Math.min(lote.cantidad_actual, restante);
    const nuevaCantidad = lote.cantidad_actual - tomar;
    await client.query(
      'UPDATE lotes SET cantidad_actual = $1, estado = $2 WHERE id = $3',
      [nuevaCantidad, nuevaCantidad === 0 ? 'agotado' : 'activo', lote.id]
    );
    consumos.push({ loteId: lote.id, cantidadTomada: tomar, dia: lote.dia });
    restante -= tomar;
  }
  return consumos; // se guarda en venta_detalle_lote
}

module.exports = { obtenerLotesFIFO, consumirStockFIFO };
