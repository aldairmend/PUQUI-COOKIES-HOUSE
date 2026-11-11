const { Pool, types } = require('pg');
require('dotenv').config();

// NUMERIC → número de JavaScript (montos en soles con 2 decimales).
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
// TIMESTAMP y DATE se devuelven como texto en hora de Lima, sin conversiones de zona.
types.setTypeParser(1114, (v) => v);
types.setTypeParser(1082, (v) => v);
// COUNT(*) y SUM de enteros → número.
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/puqui',
  // RNF-12: todas las fechas y el corte de turnos se calculan en hora local de Lima.
  options: '-c timezone=America/Lima',
});

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query: (text, params) => pool.query(text, params), withTransaction };
