/**
 * Check Listening Content Format
 * Verify whether listening items have JSON or plain text content
 */

import { pool } from '../src/config/database.js';

async function checkListeningContent() {
  console.log('🔍 Checking listening content format...\n');
  
  try {
    const result = await pool.query(
      `SELECT item_id, type, content, options 
       FROM test_items 
       WHERE section = 'listening' 
       LIMIT 5`
    );

    console.log(`Found ${result.rows.length} listening items:\n`);

    for (const row of result.rows) {
      console.log(`Item: ${row.item_id}`);
      console.log(`Type: ${row.type}`);
      console.log(`Content (first 300 chars): ${row.content.substring(0, 300)}...`);
      console.log(`Options: ${JSON.stringify(row.options)}`);
      
      // Check if content is JSON
      try {
        const parsed = JSON.parse(row.content);
        console.log('✅ Content is valid JSON');
        console.log(`   Keys: ${Object.keys(parsed).join(', ')}`);
      } catch {
        console.log('❌ Content is NOT JSON (plain text)');
      }
      
      console.log('-'.repeat(80));
      console.log('');
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkListeningContent();
