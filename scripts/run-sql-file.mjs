import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { getPgClientConfig, getPgTargetLabel } from '../server/db-config.js';

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('[db-seed] Missing SQL file path. Example: node scripts/run-sql-file.mjs peuplement_rapide.sql');
  process.exit(1);
}

const sqlPath = path.resolve(process.cwd(), inputPath);
const sql = await fs.readFile(sqlPath, 'utf8');

const { Client } = pg;
const client = new Client(getPgClientConfig());
const target = getPgTargetLabel();

try {
  await client.connect();
  await client.query(sql);
  console.log(`[db-seed] Applied ${path.basename(sqlPath)} on ${target}`);
} catch (error) {
  console.error(`[db-seed] Failed for ${path.basename(sqlPath)}: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
