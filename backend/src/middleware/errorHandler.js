// Convierte los errores de negocio (400, 404, 409…) y los inesperados en respuestas JSON uniformes.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message, detalle: err.detalle });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'La petición no es un JSON válido.' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Ocurrió un error inesperado. Intenta de nuevo.' });
}

// Envuelve un controlador async para que sus errores lleguen a errorHandler.
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { errorHandler, ah };
