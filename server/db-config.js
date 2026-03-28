import dotenv from 'dotenv';

dotenv.config();

function toOptionalString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function getPgHostConfig() {
  return {
    host: String(process.env.PGHOST || '127.0.0.1'),
    port: Number(process.env.PGPORT || 5432),
    user: String(process.env.PGUSER || 'postgres'),
    password: String(process.env.PGPASSWORD ?? 'postgres'),
    database: String(process.env.PGDATABASE || 'postgres'),
  };
}

export function getPgConnectionString() {
  return toOptionalString(process.env.DATABASE_URL);
}

export function getPgClientConfig(overrides = {}) {
  const connectionString = getPgConnectionString();
  if (connectionString) {
    return { connectionString, ...overrides };
  }

  return { ...getPgHostConfig(), ...overrides };
}

export function getPgPoolConfig() {
  return getPgClientConfig({
    max: Number(process.env.PGPOOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

export function getPgTargetLabel() {
  const connectionString = getPgConnectionString();
  if (connectionString) {
    return 'DATABASE_URL';
  }

  const { database, host, port } = getPgHostConfig();
  return `${database}@${host}:${port}`;
}
