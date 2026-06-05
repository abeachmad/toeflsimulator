/**
 * Test Database Connection Script
 * 
 * Tests if the database is accessible and tables are initialized
 */

import { Pool } from 'pg';
import { config } from 'dotenv';

config();

async function testConnection() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set.');
    console.error('Create a .env file or export the variable before running this script.');
    process.exit(1);
  }

  console.log('Testing database connection...\n');
  console.log(`Database URL: ${dbUrl.replace(/:[^:@]*@/, ':***@')}\n`);
  
  const pool = new Pool({
    connectionString: dbUrl
  });

  try {
    // Test connection
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('✓ Database connection successful');
    console.log(`  Current time: ${result.rows[0].current_time}\n`);

    // Check if tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`Found ${tablesResult.rows.length} tables:`);
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    console.log();

    // Check test_items table
    if (tablesResult.rows.some(row => row.table_name === 'test_items')) {
      const countResult = await pool.query('SELECT COUNT(*) FROM test_items');
      console.log(`✓ test_items table exists with ${countResult.rows[0].count} items\n`);
    } else {
      console.log('⚠️  test_items table does not exist - run init-db.sql first\n');
    }

    // Check cefr_conversion table
    if (tablesResult.rows.some(row => row.table_name === 'cefr_conversion')) {
      const cefrResult = await pool.query('SELECT COUNT(*) FROM cefr_conversion');
      console.log(`✓ cefr_conversion table exists with ${cefrResult.rows[0].count} entries\n`);
    } else {
      console.log('⚠️  cefr_conversion table does not exist - run init-db.sql first\n');
    }

    console.log('Database is ready for seeding!\n');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    if (error instanceof Error) {
      console.error(`  ${error.message}\n`);
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();
