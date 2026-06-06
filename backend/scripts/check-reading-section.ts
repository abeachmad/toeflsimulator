import { pool } from '../src/config/database.js';

async function checkReading() {
  try {
    // Total reading items
    const totalQuery = await pool.query(
      'SELECT COUNT(*) as count FROM test_items WHERE section = $1',
      ['reading']
    );
    console.log('📚 Total Reading Items:', totalQuery.rows[0].count);

    // Sample reading items
    const sampleQuery = await pool.query(
      `SELECT 
        item_id, 
        type, 
        difficulty_level,
        LEFT(content, 100) as content_preview
      FROM test_items 
      WHERE section = 'reading'
      LIMIT 5`
    );
    
    console.log('\n📝 Sample Reading Items:');
    sampleQuery.rows.forEach(row => {
      console.log(`\n   ID: ${row.item_id}`);
      console.log(`   Type: ${row.type}`);
      console.log(`   Difficulty: ${row.difficulty_level}`);
      console.log(`   Content: ${row.content_preview}...`);
    });

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkReading();
