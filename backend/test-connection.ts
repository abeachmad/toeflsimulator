import { Pool } from 'pg';
import { config } from 'dotenv';

config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@'));
    
    const result = await pool.query('SELECT NOW(), COUNT(*) FROM test_items');
    console.log('✅ Connection successful!');
    console.log('Current time:', result.rows[0].now);
    console.log('Test items count:', result.rows[0].count);
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error);
    process.exit(1);
  }
}

testConnection();
