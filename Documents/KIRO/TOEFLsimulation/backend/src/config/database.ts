import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';

// Credentials must always come from the environment — never from source code.
// In production the process exits immediately if DB_PASSWORD is absent.
if (!process.env.DB_PASSWORD) {
  if (NODE_ENV === 'production') {
    console.error('[FATAL] DB_PASSWORD environment variable is not set. Refusing to start.');
    process.exit(1);
  } else {
    console.warn(
      '[SECURITY WARNING] DB_PASSWORD is not set. ' +
      'Ensure your .env file is present for local development.',
    );
  }
}

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'toefl_simulator',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,   // intentionally no fallback
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create connection pool
export const pool = new Pool(poolConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connected successfully at:', result.rows[0]?.now);
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    return false;
  }
}

// Graceful shutdown
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('Database pool closed');
}
