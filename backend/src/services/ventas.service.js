// Registro de una venta (CU-06): turno abierto, promociones, FIFO y trazabilidad por lote, en una transacción.
const { consumirStockFIFO } = require('./fifo.service');
const { mejorPromocion, redondear } = require('./promociones.service');
const { exigirTurnoAbierto } = require('./turno.service');
const { invalido } = require('./errores');

const MEDIOS = ['efectivo', 'tarjeta', 'yape'];

async function promocionesActivas(client) {
  const { rows } = await client.query(
    `SELECT pr.*, p.nombre AS producto_nombre, s.nombre AS sabor_nombre
       FROM promociones pr
       LEFT JOIN productos p ON p.id = pr.producto_id
       LEFT JOIN sabores s ON s.id = pr.sabor_id
      WHERE pr.activo ORDER BY pr.id`
  );
  return rows;
}

// Día de la semana (0 = domingo) y hora HH:MM del instante de la venta, en hora de Lima.
async function contextoHorario(client, ahora = null) {
  const { rows } = await client.query(
    `SELECT EXTRACT(DOW FROM COALESCE($1::timestamp, now()::timestamp))::int AS dia_semana,
            to_char(COALESCE($1::timestamp, now()::timestamp), 'HH24:MI') AS hora`,
    [ahora]
  );
  return { diaSemana: rows[0].dia_semana, hora: rows[0].hora };
}

async function registrarVenta(client, { moduloId, usuarioId, items, medioPago, ahora = null, promos = null }) {
  if (!MEDIOS.includes(medioPago)) throw invalido('Elige un medio de pago: efectivo, tarjeta o Yape.');
  if (!Array.isArray(items) || items.length === 0) throw invalido('La venta no tiene productos.');

  // Agrupa líneas repetidas del mismo producto y sabor.
  const agrupados = new Map();
  for (const it of items) {
    const cantidad = Number(it.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0) throw invalido('Cada producto debe tener una cantidad entera mayor que cero.');
    const k = `${Number(it.productoId)}|${Number(it.saborId)}`;
    agrupados.set(k, (agrupados.get(k) || 0) + cantidad);
  }

  const turno = await exigirTurnoAbierto(client, moduloId, ahora);
  const listaPromos = promos || (await promocionesActivas(client));
  const ctx = await contextoHorario(client, ahora);

  const lineas = [];
  // Orden fijo de líneas para que dos ventas simultáneas bloqueen los lotes en el mismo orden.
  for (const [k, cantidad] of [...agrupados].sort(([a], [b]) => a.localeCompare(b))) {
    const [productoId, saborId] = k.split('|').map(Number);
    const { rows: [ps] } = await client.query(
      `SELECT p.nombre AS producto, p.precio_base, s.nombre AS sabor
         FROM productos p JOIN sabores s ON s.producto_id = p.id
        WHERE p.id = $1 AND s.id = $2 AND p.activo AND s.activo`,
      [productoId, saborId]
    );
    if (!ps) throw invalido('Hay un producto o sabor que no existe.');
    const r = mejorPromocion(listaPromos, { productoId, saborId, cantidad, precioLista: ps.precio_base }, ctx);
    lineas.push({ productoId, saborId, cantidad, producto: ps.producto, sabor: ps.sabor, precio: ps.precio_base, ...r });
  }
  const montoTotal = redondear(lineas.reduce((a, l) => a + l.total, 0));

  const { rows: [venta] } = await client.query(
    `INSERT INTO ventas (modulo_id, usuario_id, turno_id, fecha_hora, medio_pago, monto_total)
     VALUES ($1, $2, $3, COALESCE($4::timestamp, now()::timestamp), $5, $6) RETURNING *`,
    [moduloId, usuarioId, turno.id, ahora, medioPago, montoTotal]
  );

  const fecha = ahora ? ahora.slice(0, 10) : null;
  const detalle = [];
  for (const l of lineas) {
    const { rows: [d] } = await client.query(
      `INSERT INTO venta_detalle (venta_id, producto_id, sabor_id, cantidad, precio_unitario, descuento, promocion_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [venta.id, l.productoId, l.saborId, l.cantidad, l.precio, l.descuento, l.promo ? l.promo.id : null]
    );
    const consumos = await consumirStockFIFO(client, {
      productoId: l.productoId, saborId: l.saborId, moduloId, cantidad: l.cantidad, fecha,
      nombres: { producto: l.producto, sabor: l.sabor },
    });
    for (const c of consumos) {
      await client.query(
        'INSERT INTO venta_detalle_lote (venta_detalle_id, lote_id, cantidad_tomada) VALUES ($1, $2, $3)',
        [d.id, c.loteId, c.cantidadTomada]
      );
    }
    detalle.push({
      producto: l.producto, sabor: l.sabor, cantidad: l.cantidad, precio_unitario: l.precio,
      descuento: l.descuento, total: l.total, promocion: l.promo ? l.promo.nombre : null,
      lotes: consumos.map((c) => ({ lote_id: c.loteId, dia: c.dia, cantidad: c.cantidadTomada })),
    });
  }
  return { ...venta, detalle };
}

module.exports = { MEDIOS, promocionesActivas, contextoHorario, registrarVenta };
