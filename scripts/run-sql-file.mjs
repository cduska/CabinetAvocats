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

function consumeLineComment(src, i) {
  const end = src.indexOf('\n', i);
  return end === -1 ? src.slice(i) : src.slice(i, end + 1);
}

function consumeBlockComment(src, i) {
  const end = src.indexOf('*/', i + 2);
  return end === -1 ? src.slice(i) : src.slice(i, end + 2);
}

function consumeSingleQuoted(src, i) {
  const n = src.length;
  let j = i + 1;
  while (j < n) {
    if (src[j] === "'" && src[j + 1] === "'") {
      j += 2;
    } else if (src[j] === "'") {
      j++;
      break;
    } else {
      j++;
    }
  }
  return src.slice(i, j);
}

function consumeDollarQuoted(src, i) {
  const m = src.slice(i).match(/^\$(\w*)\$/);
  if (!m) return null;
  const openTag = m[0];
  const closeIdx = src.indexOf(openTag, i + openTag.length);
  if (closeIdx === -1) return null;
  return src.slice(i, closeIdx + openTag.length);
}

function scanToken(src, i) {
  if (src[i] === '-' && src[i + 1] === '-') return consumeLineComment(src, i);
  if (src[i] === '/' && src[i + 1] === '*') return consumeBlockComment(src, i);
  if (src[i] === "'") return consumeSingleQuoted(src, i);
  if (src[i] === '$') return consumeDollarQuoted(src, i) ?? src[i];
  return null;
}

function splitStatements(src) {
  const out = [];
  let buf = '';
  let i = 0;
  const n = src.length;

  while (i < n) {
    if (src[i] === ';') {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = '';
      i++;
    } else {
      const token = scanToken(src, i);
      if (token) {
        buf += token;
        i += token.length;
      } else {
        buf += src[i];
        i++;
      }
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
  let stmtIndex = 0;
  for (const stmt of statements) {
    stmtIndex++;
    try {
      await client.query(stmt);
    } catch (err) {
      const preview = stmt.replaceAll(/\s+/g, ' ').slice(0, 120);
      throw new Error(`Statement #${stmtIndex}: ${err.message}\n  SQL: ${preview}`);
    }
  }
  console.log(`[db-seed] Applied ${path.basename(sqlPath)} on ${target}`);
} catch (error) {
  console.error(`[db-seed] Failed for ${path.basename(sqlPath)}: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
