// Cadena de middleware de seguridad (Tabla 27): el servidor, y no el menú, decide qué puede hacer cada rol.
const { verificar } = require('../services/auth.service');

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  try {
    const p = verificar(token);
    req.usuario = { id: p.id, nombre: p.nombre, rol: p.rol, modulo_id: p.modulo_id, modulo_nombre: p.modulo_nombre };
    return next();
  } catch {
    return res.status(401).json({ error: 'Tu sesión venció. Vuelve a iniciar sesión.' });
  }
}

const requireRol = (...roles) => (req, res, next) => {
  if (!req.usuario || !roles.includes(req.usuario.rol)) {
    return res.status(403).json({ error: 'Tu rol no tiene acceso a esta operación.' });
  }
  return next();
};

// El vendedor siempre opera en su módulo: se ignora el módulo que envíe el cliente.
function scopeModulo(req, res, next) {
  const u = req.usuario;
  if (u.rol === 'vendedor') {
    if (!u.modulo_id) return res.status(403).json({ error: 'Tu usuario no tiene un módulo asignado.' });
    req.moduloId = Number(u.modulo_id);
  } else {
    const v = (req.body && req.body.modulo_id) || req.query.modulo_id;
    req.moduloId = v ? Number(v) : null;
  }
  return next();
}

// El usuario que registra la operación es siempre el del token.
function usuarioDeToken(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body.usuario_id = req.usuario.id;
  }
  return next();
}

// El vendedor solo consulta sus propias marcaciones de asistencia.
function soloPropio(req, res, next) {
  req.soloUsuarioId = req.usuario.rol === 'vendedor' ? req.usuario.id : null;
  return next();
}

module.exports = { requireAuth, requireRol, scopeModulo, usuarioDeToken, soloPropio };
