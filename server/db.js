import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: String(process.env.PGHOST || '127.0.0.1'),
  port: Number(process.env.PGPORT || 5432),
  user: String(process.env.PGUSER || 'postgres'),
  password: String(process.env.PGPASSWORD ?? 'postgres'),
  database: String(process.env.PGDATABASE || 'postgres'),
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (error) => {
  console.error('[db] Unexpected PostgreSQL pool error:', error.message);
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function testConnection() {
  await query('SELECT 1');
}

export async function closePool() {
  await pool.end();
}
