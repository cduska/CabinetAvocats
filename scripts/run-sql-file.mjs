import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('[db-seed] Missing SQL file path. Example: node scripts/run-sql-file.mjs peuplement_rapide.sql');
  process.exit(1);
}

const sqlPath = path.resolve(process.cwd(), inputPath);
const sql = await fs.readFile(sqlPath, 'utf8');

const host = String(process.env.PGHOST || '127.0.0.1');
const port = Number(process.env.PGPORT || 5432);
const user = String(process.env.PGUSER || 'postgres');
const password = String(process.env.PGPASSWORD ?? 'postgres');
const database = String(process.env.PGDATABASE || 'postgres');

const { Client } = pg;
const client = new Client({
  host,
  port,
  user,
  password,
  database,
});

try {
  await client.connect();
  await client.query(sql);
  console.log(`[db-seed] Applied ${path.basename(sqlPath)} on ${database}@${host}:${port}`);
} catch (error) {
  console.error(`[db-seed] Failed for ${path.basename(sqlPath)}: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
