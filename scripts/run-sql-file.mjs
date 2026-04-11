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

/**
 * Split a SQL source into individual statements, correctly handling
 * $$-dollar-quoted function bodies so semicolons inside them are ignored.
 */
function splitStatements(src) {
  const out = [];
  let buf = '';
  let inDollar = false;
  let tag = '';

  for (let i = 0; i < src.length; i++) {
    // Start of a dollar-quoted block: scan forward to find the closing '$'
    if (!inDollar && src[i] === '$') {
      const j = src.indexOf('$', i + 1);
      if (j !== -1) {
        tag = src.slice(i, j + 1); // e.g. "$$" or "$body$"
        buf += tag;
        i = j;
        inDollar = true;
        continue;
      }
    }

    // End of a dollar-quoted block
    if (inDollar && src[i] === '$') {
      const candidate = src.slice(i, i + tag.length);
      if (candidate === tag) {
        buf += candidate;
        i += tag.length - 1;
        inDollar = false;
        tag = '';
        continue;
      }
    }

    if (!inDollar && src[i] === ';') {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = '';
    } else {
      buf += src[i];
    }
  }

  const last = buf.trim();
  if (last) out.push(last);
  return out;
}

const { Client } = pg;
const client = new Client(getPgClientConfig());
const target = getPgTargetLabel();

try {
  await client.connect();
  const statements = splitStatements(sql);
  for (const stmt of statements) {
    await client.query(stmt);
  }
  console.log(`[db-seed] Applied ${path.basename(sqlPath)} on ${target}`);
} catch (error) {
  console.error(`[db-seed] Failed for ${path.basename(sqlPath)}: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
