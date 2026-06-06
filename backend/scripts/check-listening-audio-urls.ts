import { pool } from '../src/config/database.js';

async function checkListeningAudioUrls() {
  try {
    const query = await pool.query(
      `SELECT 
        item_id,
        type,
        metadata,
        LEFT(content, 200) as content_preview
      FROM test_items 
      WHERE section = 'listening'
      AND metadata->>'audio_url' IS NOT NULL
      LIMIT 3`
    );

    console.log('🎵 Listening Items with Audio URLs:\n');

    query.rows.forEach(row => {
      console.log(`Item ID: ${row.item_id}`);
      console.log(`Type: ${row.type}`);
      console.log(`Metadata:`, row.metadata);
      console.log(`Content Preview: ${row.content_preview}...`);
      console.log('---\n');
    });

    // Check items with audio_filename
    const filenameQuery = await pool.query(
      `SELECT 
        item_id,
        metadata->>'audio_filename' as audio_filename,
        metadata->>'audio_url' as audio_url
      FROM test_items 
      WHERE section = 'listening'
      AND metadata->>'audio_filename' IS NOT NULL
      LIMIT 5`
    );

    console.log('\n🎵 Items with audio_filename:\n');
    filenameQuery.rows.forEach(row => {
      console.log(`Item: ${row.item_id}`);
      console.log(`  Filename: ${row.audio_filename}`);
      console.log(`  URL: ${row.audio_url}`);
    });

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkListeningAudioUrls();
