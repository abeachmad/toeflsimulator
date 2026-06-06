import { pool } from '../src/config/database.js';

async function checkAllSections() {
  try {
    console.log('📝 Checking Writing Section Items:\n');
    const writing = await pool.query(
      `SELECT item_id, type, LEFT(content, 200) as content_preview 
       FROM test_items 
       WHERE section = 'writing' 
       LIMIT 3`
    );
    writing.rows.forEach(row => {
      console.log(`ID: ${row.item_id}`);
      console.log(`Type: ${row.type}`);
      console.log(`Content: ${row.content_preview}...`);
      console.log('---\n');
    });

    console.log('\n🎧 Checking Listening Items (first 10 with audio):\n');
    const listening = await pool.query(
      `SELECT item_id, options, correct_answer 
       FROM test_items 
       WHERE section = 'listening' 
       AND metadata->>'audio_filename' IS NOT NULL
       LIMIT 10`
    );
    listening.rows.forEach((row, i) => {
      console.log(`Question ${i+1}: ${row.item_id}`);
      console.log(`  Options:`, row.options);
      console.log(`  Correct:`, row.correct_answer);
    });

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkAllSections();
