require('dotenv').config();
const app = require('./app');
const { pool, query } = require('./db/pool');
const { prepararEsquema } = require('./db/migrations');

const PORT = Number(process.env.PORT) || 4000;

async function iniciar() {
  if (!process.env.JWT_SECRET) {
    console.warn('Aviso: JWT_SECRET no está definido; se usa un secreto de desarrollo. Defínelo en producción.');
  }
  // Al arrancar, la base queda lista sola: crea o actualiza el esquema y, si está vacía, carga los datos de demostración
  // (se puede desactivar con SEED_DEMO=false). Así el sistema se publica sin ejecutar comandos en el servidor.
  const aplicadas = await prepararEsquema(pool);
  if (aplicadas.length) console.log(`Esquema listo. Migraciones aplicadas: ${aplicadas.join(', ')}`);
  const { rows: [{ n }] } = await query('SELECT COUNT(*)::int AS n FROM usuarios');
  if (n === 0 && process.env.SEED_DEMO !== 'false') {
    console.log('Base de datos vacía: cargando los datos de demostración (puede tardar unos segundos)…');
    await require('../scripts/seed').sembrar();
  }
  app.listen(PORT, () => {
    console.log(`Puqui Cookies House escuchando en http://localhost:${PORT}`);
  });
}

iniciar().catch((err) => {
  console.error('No se pudo iniciar el sistema:', err.message);
  console.error('Revisa que DATABASE_URL apunte a una base PostgreSQL accesible.');
  process.exit(1);
});
