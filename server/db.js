import pg from 'pg';
import { getPgPoolConfig } from './db-config.js';

const { Pool } = pg;

const pool = new Pool(getPgPoolConfig());

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
