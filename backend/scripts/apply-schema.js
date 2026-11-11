// Crea el esquema (tablas, vistas y tipos) y aplica las migraciones. Es idempotente: npm run db:schema
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db/pool');
const { aplicarMigraciones } = require('../src/db/migrations');

(async () => {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8');
    await client.query(sql);
    const aplicadas = await aplicarMigraciones(client);
    console.log('Esquema aplicado.', aplicadas.length ? `Migraciones nuevas: ${aplicadas.join(', ')}` : 'Sin migraciones pendientes.');
  } catch (err) {
    console.error('No se pudo aplicar el esquema:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
