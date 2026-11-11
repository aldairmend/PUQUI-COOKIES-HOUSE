require('dotenv').config();
const app = require('./app');

const PORT = Number(process.env.PORT) || 4000;
if (!process.env.JWT_SECRET) {
  console.warn('Aviso: JWT_SECRET no está definido; se usa un secreto de desarrollo. Defínelo en producción.');
}
app.listen(PORT, () => {
  console.log(`API de Puqui Cookies House escuchando en http://localhost:${PORT}/api`);
});
