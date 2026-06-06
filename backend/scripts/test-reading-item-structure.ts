import { pool } from '../src/config/database.js';

async function testReadingStructure() {
  try {
    // Get a sample reading item
    const query = await pool.query(
      `SELECT 
        id,
        item_id,
        section,
        type,
        difficulty_level,
        content,
        options,
        correct_answer,
        metadata,
        irt_parameters
      FROM test_items 
      WHERE section = 'reading'
      LIMIT 1`
    );

    if (query.rows.length === 0) {
      console.log('❌ No reading items found in database!');
      await pool.end();
      return;
    }

    const item = query.rows[0];
    
    console.log('✅ Reading Item Structure:');
    console.log('=====================================\n');
    console.log('ID:', item.id || item.item_id);
    console.log('Section:', item.section);
    console.log('Type:', item.type);
    console.log('Difficulty:', item.difficulty_level);
    console.log('\nContent (type):', typeof item.content);
    console.log('Content (length):', item.content.length);
    
    // Try to parse content
    try {
      const parsed = JSON.parse(item.content);
      console.log('\n📋 Parsed Content Structure:');
      console.log('Keys:', Object.keys(parsed));
      console.log('Has passage:', 'passage' in parsed);
      console.log('Has question:', 'question' in parsed);
      
      if (parsed.passage) {
        console.log('\n📖 Passage (first 200 chars):');
        console.log(parsed.passage.substring(0, 200) + '...');
      }
      
      if (parsed.question) {
        console.log('\n❓ Question:');
        console.log(parsed.question);
      }
    } catch (e) {
      console.log('\n⚠️ Content is not JSON, treating as plain text');
      console.log('Content preview:', item.content.substring(0, 200));
    }
    
    console.log('\n\n📊 Options:');
    console.log(item.options);
    console.log('\n✅ Correct Answer:', item.correct_answer);
    
    console.log('\n\n🧮 IRT Parameters:');
    console.log(item.irt_parameters);

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

testReadingStructure();
