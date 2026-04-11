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
 * Split a SQL source into individual statements.
 * Correctly handles: -- line comments, /* block comments *\/,
 * 'single-quoted strings' (with '' escape), and $$/$tag$ dollar-quoted blocks.
 * A bare $ that is NOT a valid dollar-quote opener (e.g. inside a regex string)
 * is treated as a plain character and never triggers dollar-quote mode.
 */
function splitStatements(src) {
  const out = [];
  let buf = '';
  let i = 0;
  const n = src.length;

  while (i < n) {
    // -- line comment: consume through end of line
    if (src[i] === '-' && src[i + 1] === '-') {
      const end = src.indexOf('\n', i);
      const chunk = end === -1 ? src.slice(i) : src.slice(i, end + 1);
      buf += chunk;
      i += chunk.length;
      continue;
    }

    // /* block comment */: consume through */
    if (src[i] === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const chunk = end === -1 ? src.slice(i) : src.slice(i, end + 2);
      buf += chunk;
      i += chunk.length;
      continue;
    }

    // 'single-quoted string': consume through closing ', handling '' escapes
    if (src[i] === "'") {
      let j = i + 1;
      while (j < n) {
        if (src[j] === "'" && src[j + 1] === "'") {
          j += 2; // '' is an escaped quote, not end of string
        } else if (src[j] === "'") {
          j++;    // closing quote
          break;
        } else {
          j++;
        }
      }
      buf += src.slice(i, j);
      i = j;
      continue;
    }

    // $tag$ dollar-quoted block: only if $ starts a valid tag pattern
    if (src[i] === '$') {
      const m = src.slice(i).match(/^\$([A-Za-z0-9_]*)\$/);
      if (m) {
        const openTag = m[0]; // e.g. '$$' or '$func$'
        const closeIdx = src.indexOf(openTag, i + openTag.length);
        if (closeIdx !== -1) {
          // consume from open tag to close tag (inclusive)
          buf += src.slice(i, closeIdx + openTag.length);
          i = closeIdx + openTag.length;
          continue;
        }
      }
      // Not a valid dollar-quote opener — treat as plain character
      buf += src[i];
      i++;
      continue;
    }

    // Statement separator
    if (src[i] === ';') {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = '';
      i++;
      continue;
    }

    buf += src[i];
    i++;
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
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 120);
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
