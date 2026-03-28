import pg from 'pg';
import { getPgClientConfig, getPgTargetLabel } from '../server/db-config.js';

const timeoutMs = Number(process.env.PG_WAIT_TIMEOUT_MS || 120000);
const intervalMs = Number(process.env.PG_WAIT_INTERVAL_MS || 2000);
const target = getPgTargetLabel();

const { Client } = pg;
const start = Date.now();

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function canConnect() {
  const client = new Client(
    getPgClientConfig({
      connectionTimeoutMillis: Math.min(intervalMs, 5000),
    }),
  );

  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

while (Date.now() - start < timeoutMs) {
  if (await canConnect()) {
    console.log(`[db-wait] PostgreSQL ready at ${target}`);
    process.exit(0);
  }

  await sleep(intervalMs);
}

console.error(`[db-wait] PostgreSQL not ready after ${timeoutMs}ms for ${target}`);
process.exit(1);
