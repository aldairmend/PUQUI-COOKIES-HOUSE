// Rutas de la API y roles autorizados (Tabla 28). Todas, salvo el inicio de sesión, exigen sesión.
const express = require('express');
const { requireAuth, requireRol, scopeModulo, usuarioDeToken, soloPropio } = require('../middleware/auth');
const { ah } = require('../middleware/errorHandler');

const auth = require('../controllers/auth.controller');
const catalogo = require('../controllers/catalogo.controller');
const dashboard = require('../controllers/dashboard.controller');
const ruta = require('../controllers/ruta.controller');
const lotes = require('../controllers/lotes.controller');
const ventas = require('../controllers/ventas.controller');
const stock = require('../controllers/stock.controller');
const turnos = require('../controllers/turnos.controller');
const devoluciones = require('../controllers/devoluciones.controller');
const asistencia = require('../controllers/asistencia.controller');
const promociones = require('../controllers/promociones.controller');
const reportes = require('../controllers/reportes.controller');

const P = 'propietario';
const A = 'administrador';
const V = 'vendedor';
const R = 'repartidor';
const TODOS = [P, A, V, R];

const r = express.Router();
const ruta_ = (metodo, path, roles, ...fns) => {
  const cadena = roles ? [requireAuth, requireRol(...roles), scopeModulo, usuarioDeToken] : [];
  r[metodo](path, ...cadena, ...fns.map(ah));
};

ruta_('post', '/auth/login', null, auth.postLogin);

ruta_('get', '/productos', TODOS, catalogo.getProductos);
ruta_('get', '/modulos', TODOS, catalogo.getModulos);
ruta_('get', '/usuarios', [A, P], catalogo.getUsuarios);

ruta_('get', '/dashboard/admin', [A], dashboard.getAdmin);
ruta_('get', '/dashboard/propietario', [P, A], dashboard.getPropietario);

ruta_('get', '/ruta/hoy', [R, A], ruta.getRutaHoy);

ruta_('post', '/lotes', [A, V, R], lotes.postLote);
ruta_('post', '/lotes/entrega', [A, V, R], lotes.postEntrega);
ruta_('get', '/lotes', TODOS, lotes.getLotes);

ruta_('post', '/ventas', [A, V], ventas.postVenta);
ruta_('get', '/ventas', [A, P, V], ventas.getVentas);

ruta_('get', '/stock', [A, P, V], stock.getStock);
ruta_('get', '/stock/historial', [A, P, V], stock.getHistorial);

ruta_('post', '/turnos/abrir', [A, V], turnos.postAbrir);
ruta_('patch', '/turnos/:turnoId/cerrar', [A, V], turnos.patchCerrar);
ruta_('post', '/turnos/:turnoId/entregar', [A, V], turnos.postEntregar);
ruta_('get', '/turnos/activo', [A, P, V], turnos.getActivo);
ruta_('get', '/turnos/resumen', [A, P, V], turnos.getResumen);
ruta_('get', '/turnos/nota-anterior', [A, P, V], turnos.getNotaAnterior);
ruta_('get', '/turnos', [A, P, V], turnos.getTurnos);

ruta_('get', '/devoluciones/pendientes', TODOS, devoluciones.getPendientes);
ruta_('post', '/devoluciones', [A, V, R], devoluciones.postDevolucion);
ruta_('get', '/devoluciones', TODOS, devoluciones.getDevoluciones);

ruta_('post', '/asistencia', [A, V], asistencia.postAsistencia);
ruta_('get', '/asistencia/hoy', [A, P], asistencia.getHoy);
r.get('/asistencia', requireAuth, requireRol(A, P, V), soloPropio, ah(asistencia.getAsistencias));

ruta_('get', '/promociones', [A, P, V], promociones.getPromociones);
ruta_('post', '/promociones', [A, P], promociones.postPromocion);
ruta_('patch', '/promociones/:id/desactivar', [A, P], promociones.patchDesactivar);
ruta_('post', '/promociones/simular', [A, P], promociones.postSimular);

ruta_('get', '/reportes/ventas-por-producto', [A, P], reportes.ventasPorProducto);
ruta_('get', '/reportes/ventas-por-medio-pago', [A, P], reportes.ventasPorMedioPago);
ruta_('get', '/reportes/caja', [A, P], reportes.caja);
ruta_('get', '/reportes/devoluciones', [A, P], reportes.devoluciones);

module.exports = r;
