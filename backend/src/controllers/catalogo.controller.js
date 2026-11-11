const { query } = require('../db/pool');

async function getProductos(req, res) {
  const { rows: productos } = await query(
    'SELECT id, nombre, precio_base, dias_limite_venta FROM productos WHERE activo ORDER BY id'
  );
  const { rows: sabores } = await query(
    'SELECT id, producto_id, nombre FROM sabores WHERE activo ORDER BY producto_id, id'
  );
  res.json(productos.map((p) => ({ ...p, sabores: sabores.filter((s) => s.producto_id === p.id) })));
}

async function getModulos(req, res) {
  const { rows } = await query(
    'SELECT id, nombre, direccion, latitud, longitud, radio_metros FROM modulos WHERE activo ORDER BY id'
  );
  res.json(rows);
}

async function getUsuarios(req, res) {
  const { rows } = await query(
    `SELECT u.id, u.nombre, u.email, u.rol, u.modulo_id, m.nombre AS modulo_nombre, u.activo
       FROM usuarios u LEFT JOIN modulos m ON m.id = u.modulo_id ORDER BY u.rol, u.nombre`
  );
  res.json(rows);
}

module.exports = { getProductos, getModulos, getUsuarios };
