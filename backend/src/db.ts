import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://scheduler:scheduler@localhost:5432/scheduler';

export const pool = new Pool({
  connectionString,
  // For local dev, SSL usually not needed. Set via env if using managed DB.
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('PostgreSQL pool: new client connected');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.log('executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
  }
  return res;
}

export async function getClient(): Promise<PoolClient> {
  const client = await pool.connect();
  return client;
}

export async function testConnection(): Promise<boolean> {
  try {
    const res = await pool.query('SELECT NOW() as now, current_database() as db, current_user as user');
    console.log('DB connection OK:', res.rows[0]);
    return true;
  } catch (err) {
    console.error('DB connection FAILED:', err);
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
