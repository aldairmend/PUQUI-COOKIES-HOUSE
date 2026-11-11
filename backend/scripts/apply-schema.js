// Crea el esquema (tablas, vistas y tipos) y aplica las migraciones. Es idempotente: npm run db:schema
const { pool } = require('../src/db/pool');
const { prepararEsquema } = require('../src/db/migrations');

(async () => {
  try {
    const aplicadas = await prepararEsquema(pool);
    console.log('Esquema aplicado.', aplicadas.length ? `Migraciones nuevas: ${aplicadas.join(', ')}` : 'Sin migraciones pendientes.');
  } catch (err) {
    console.error('No se pudo aplicar el esquema:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
