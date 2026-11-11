const { login } = require('../services/auth.service');
const { invalido } = require('../services/errores');

async function postLogin(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) throw invalido('Escribe tu correo y tu contraseña.');
  res.json(await login(email, password));
}

module.exports = { postLogin };
