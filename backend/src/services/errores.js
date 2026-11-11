// Errores de negocio: el middleware errorHandler los convierte en respuestas JSON uniformes.
class ErrorNegocio extends Error {
  constructor(status, mensaje, detalle) {
    super(mensaje);
    this.status = status;
    this.detalle = detalle;
  }
}

class StockInsuficienteError extends ErrorNegocio {
  constructor(detalle) {
    super(409, `Stock insuficiente de ${detalle.producto || 'producto'} · ${detalle.sabor || 'sabor'}: hay ${detalle.disponible} y se piden ${detalle.cantidad}.`, detalle);
  }
}

const noEncontrado = (que) => new ErrorNegocio(404, `${que} no existe.`);
const conflicto = (msg, detalle) => new ErrorNegocio(409, msg, detalle);
const invalido = (msg, detalle) => new ErrorNegocio(400, msg, detalle);
const prohibido = (msg) => new ErrorNegocio(403, msg || 'No tienes permiso para esta operación.');

module.exports = { ErrorNegocio, StockInsuficienteError, noEncontrado, conflicto, invalido, prohibido };
