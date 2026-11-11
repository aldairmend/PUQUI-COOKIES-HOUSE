// Autenticación: contraseñas con bcrypt y sesión con JWT de 12 horas (RNF-05).
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { ErrorNegocio } = require('./errores');

const DURACION = '12h';
const secreto = () => process.env.JWT_SECRET || 'puqui-secreto-de-desarrollo';

const hashPassword = (plano) => bcrypt.hash(plano, 10);

async function login(email, password) {
  const { rows: [u] } = await query(
    `SELECT u.*, m.nombre AS modulo_nombre FROM usuarios u LEFT JOIN modulos m ON m.id = u.modulo_id
      WHERE lower(u.email) = lower($1) AND u.activo`,
    [String(email || '').trim()]
  );
  if (!u || !(await bcrypt.compare(String(password || ''), u.password_hash))) {
    throw new ErrorNegocio(401, 'Correo o contraseña incorrectos.');
  }
  const usuario = { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, modulo_id: u.modulo_id, modulo_nombre: u.modulo_nombre };
  const token = jwt.sign(usuario, secreto(), { expiresIn: DURACION });
  return { token, usuario };
}

function verificar(token) {
  return jwt.verify(token, secreto());
}

module.exports = { hashPassword, login, verificar, DURACION };
