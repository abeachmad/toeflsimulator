import { pool } from '../src/config/database.js';

async function main() {
  const total = await pool.query('SELECT COUNT(*) as total FROM test_items');
  console.log('Total items:', total.rows[0].total);
  
  const bySection = await pool.query('SELECT section, COUNT(*) as count FROM test_items GROUP BY section ORDER BY section');
  console.log('By section:', bySection.rows);
  
  await pool.end();
}

main();
