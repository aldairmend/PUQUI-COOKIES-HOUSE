// Utilidades compartidas por los controladores.
const { query } = require('../db/pool');
const { invalido } = require('../services/errores');

// Módulo efectivo de la petición: el del vendedor, el elegido o, si se exige, el primero activo.
async function moduloRequerido(req) {
  if (req.moduloId) return req.moduloId;
  const { rows: [m] } = await query('SELECT id FROM modulos WHERE activo ORDER BY id LIMIT 1');
  if (!m) throw invalido('No hay módulos registrados.');
  return m.id;
}

// Periodos del dashboard: desplazamientos en días respecto de hoy (hora de Lima), fin exclusivo.
const PERIODOS = {
  ayer: { desde: -1, hasta: 0, titulo: 'Ventas por hora (ayer)', compara: 'vs. anteayer' },
  semana: { desde: -6, hasta: 1, titulo: 'Ventas por día (últimos 7 días)', compara: 'vs. 7 días anteriores' },
  mes: { desde: -29, hasta: 1, titulo: 'Ventas por semana (últimos 30 días)', compara: 'vs. 30 días anteriores' },
};

function periodo(nombre) {
  const p = PERIODOS[nombre] || PERIODOS.semana;
  const largo = p.hasta - p.desde;
  return { ...p, clave: PERIODOS[nombre] ? nombre : 'semana', prevDesde: p.desde - largo, prevHasta: p.desde };
}

// Rango de fechas para reportes (YYYY-MM-DD, ambos incluidos). Por defecto, los últimos 7 días.
function rangoFechas(req) {
  const ok = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  return { desde: ok(req.query.desde) ? req.query.desde : null, hasta: ok(req.query.hasta) ? req.query.hasta : null };
}
const SQL_RANGO = (col, i) =>
  `${col} >= COALESCE($${i}::date, CURRENT_DATE - 6) AND ${col} < COALESCE($${i + 1}::date, CURRENT_DATE) + 1`;

module.exports = { moduloRequerido, periodo, PERIODOS, rangoFechas, SQL_RANGO };
