const { query } = require('../db/pool');
const { simularVenta } = require('../services/promociones.service');
const { promocionesActivas } = require('../services/ventas.service');
const { invalido, noEncontrado } = require('../services/errores');

const TIPOS = ['porcentaje', 'monto_fijo', 'precio_fijo', 'lleva_paga'];

async function getPromociones(req, res) {
  const todas = req.query.todas === '1' && req.usuario.rol !== 'vendedor';
  const { rows } = await query(
    `SELECT pr.*, p.nombre AS producto_nombre, s.nombre AS sabor_nombre, u.nombre AS creado_por_nombre
       FROM promociones pr
       LEFT JOIN productos p ON p.id = pr.producto_id LEFT JOIN sabores s ON s.id = pr.sabor_id
       LEFT JOIN usuarios u ON u.id = pr.creado_por
      WHERE ($1 OR pr.activo)
      ORDER BY pr.activo DESC, pr.id`,
    [todas]
  );
  res.json(rows);
}

const nulo = (v) => (v === undefined || v === null || v === '' ? null : v);
const hora = (v) => {
  if (nulo(v) === null) return null;
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(String(v))) throw invalido('Las horas deben tener el formato HH:MM.');
  return String(v).slice(0, 5);
};

// Crea una promoción por producto, sabor, día, horario y cantidad (RF-27).
async function postPromocion(req, res) {
  const b = req.body || {};
  const nombre = String(b.nombre || '').trim();
  if (!nombre) throw invalido('Ponle un nombre a la promoción.');
  if (!TIPOS.includes(b.tipo_descuento)) throw invalido('Elige el tipo de descuento.');
  const valor = Number(b.valor);
  const minima = Number(nulo(b.cantidad_minima) ?? 1);
  if (!Number.isFinite(valor) || valor < 0) throw invalido('El valor del descuento no es válido.');
  if (!Number.isInteger(minima) || minima < 1) throw invalido('La cantidad mínima debe ser un entero desde 1.');
  if (b.tipo_descuento === 'porcentaje' && valor > 100) throw invalido('El porcentaje no puede pasar de 100.');
  if (b.tipo_descuento === 'lleva_paga' && (!Number.isInteger(valor) || valor >= minima || valor < 1)) {
    throw invalido('En «lleva N, paga M», M debe ser un entero menor que N (por ejemplo, lleva 3 y paga 2).');
  }
  const ini = hora(b.hora_inicio);
  const fin = hora(b.hora_fin);
  if (ini && fin && ini >= fin) throw invalido('La hora de inicio debe ser anterior a la hora de fin.');
  const dia = nulo(b.dia_semana) === null ? null : Number(b.dia_semana);
  if (dia !== null && !(dia >= 0 && dia <= 6)) throw invalido('El día de la semana no es válido.');
  const productoId = nulo(b.producto_id) === null ? null : Number(b.producto_id);
  const saborId = nulo(b.sabor_id) === null ? null : Number(b.sabor_id);
  if (saborId) {
    const { rows: [s] } = await query('SELECT producto_id FROM sabores WHERE id = $1', [saborId]);
    if (!s || (productoId && s.producto_id !== productoId)) throw invalido('El sabor no corresponde al producto.');
  }
  const { rows: [p] } = await query(
    `INSERT INTO promociones (nombre, producto_id, sabor_id, dia_semana, hora_inicio, hora_fin, cantidad_minima,
                              tipo_descuento, valor, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [nombre, productoId, saborId, dia, ini, fin, minima, b.tipo_descuento, valor, req.usuario.id]
  );
  res.status(201).json(p);
}

async function patchDesactivar(req, res) {
  const { rows: [p] } = await query('UPDATE promociones SET activo = FALSE WHERE id = $1 RETURNING *', [Number(req.params.id)]);
  if (!p) throw noEncontrado('La promoción');
  res.json(p);
}

// Simula una venta en un día y hora y explica qué promoción aplica y por qué (RF-29).
async function postSimular(req, res) {
  const b = req.body || {};
  const dia = Number(b.dia_semana);
  const h = hora(b.hora) || '12:00';
  if (!(dia >= 0 && dia <= 6)) throw invalido('Elige el día de la venta.');
  const items = Array.isArray(b.items) ? b.items : [];
  const { rows: catalogo } = await query(
    `SELECT p.id AS producto_id, p.nombre AS producto, p.precio_base, s.id AS sabor_id, s.nombre AS sabor
       FROM productos p JOIN sabores s ON s.producto_id = p.id`
  );
  const lineas = items.map((i) => {
    const c = catalogo.find((x) => x.producto_id === Number(i.producto_id) && x.sabor_id === Number(i.sabor_id));
    if (!c) throw invalido('Hay un producto o sabor que no existe.');
    const cantidad = Number(i.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0) throw invalido('Las cantidades deben ser enteros mayores que cero.');
    return { productoId: c.producto_id, saborId: c.sabor_id, producto: c.producto, sabor: c.sabor, precioLista: c.precio_base, cantidad };
  });
  const promos = await promocionesActivas({ query: (t, p) => query(t, p) });
  const r = simularVenta(promos, lineas, { diaSemana: dia, hora: h });
  res.json({
    ...r,
    lineas: r.lineas.map((l) => ({
      producto: l.producto, sabor: l.sabor, cantidad: l.cantidad, precio_lista: l.precioLista,
      total_lista: l.totalLista, total: l.total, descuento: l.descuento,
      promocion: l.promo ? l.promo.nombre : null, motivos: l.motivos,
    })),
  });
}

module.exports = { getPromociones, postPromocion, patchDesactivar, postSimular };
