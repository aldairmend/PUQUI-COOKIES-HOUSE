// Migraciones incrementales. Cada una se aplica una sola vez y queda registrada en schema_migrations,
// de modo que una base creada con una versión anterior se actualiza sin perder datos.
const MIGRACIONES = [
  {
    id: '001_indice_devoluciones_fecha',
    sql: 'CREATE INDEX IF NOT EXISTS idx_devoluciones_fecha ON devoluciones (fecha)',
  },
  {
    id: '002_indice_asistencias_fecha',
    sql: 'CREATE INDEX IF NOT EXISTS idx_asistencias_fecha ON asistencias (fecha_hora)',
  },
];

async function aplicarMigraciones(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id VARCHAR(100) PRIMARY KEY,
    aplicada_en TIMESTAMP NOT NULL DEFAULT now()
  )`);
  const { rows } = await client.query('SELECT id FROM schema_migrations');
  const hechas = new Set(rows.map((r) => r.id));
  const aplicadas = [];
  for (const m of MIGRACIONES) {
    if (hechas.has(m.id)) continue;
    await client.query(m.sql);
    await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [m.id]);
    aplicadas.push(m.id);
  }
  return aplicadas;
}

// Aplica schema.sql (idempotente) y luego las migraciones pendientes.
async function prepararEsquema(pool) {
  const fs = require('fs');
  const path = require('path');
  const client = await pool.connect();
  try {
    await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    return await aplicarMigraciones(client);
  } finally {
    client.release();
  }
}

module.exports = { aplicarMigraciones, prepararEsquema, MIGRACIONES };
