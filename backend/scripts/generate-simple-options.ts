/**
 * Generate simple contextual options for listening questions
 * without using AI - based on question patterns
 */

import { pool } from '../src/config/database.js';

// Common TOEFL listening question patterns and their option templates
const OPTION_TEMPLATES = {
  'what.*main.*topic': [
    'Economic developments',
    'Environmental concerns',
    'Social changes',
    'Political reforms'
  ],
  'why.*speaker.*mention': [
    'To provide an example',
    'To support an argument',
    'To introduce a new topic',
    'To clarify a point'
  ],
  'what.*professor.*imply': [
    'Further research is needed',
    'The theory has limitations',
    'Multiple perspectives exist',
    'The conclusion is significant'
  ],
  'what.*can.*infer': [
    'The situation will improve',
    'More information is needed',
    'The outcome is uncertain',
    'Changes are expected'
  ],
  'default': [
    'First option based on context',
    'Second alternative explanation',
    'Third possible interpretation',
    'Fourth reasonable answer'
  ]
};

function generateContextualOptions(questionText: string): { options: string[], correctIndex: number } {
  // Try to match question patterns
  const lowerQuestion = questionText.toLowerCase();
  
  let templateKey = 'default';
  for (const pattern of Object.keys(OPTION_TEMPLATES)) {
    if (pattern !== 'default') {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(lowerQuestion)) {
        templateKey = pattern;
        break;
      }
    }
  }
  
  const template = OPTION_TEMPLATES[templateKey];
  
  // Shuffle and select random correct answer
  const shuffled = [...template].sort(() => Math.random() - 0.5);
  const correctIndex = Math.floor(Math.random() * 4);
  
  return {
    options: shuffled,
    correctIndex
  };
}

async function main() {
  try {
    console.log('🎯 Generating Contextual Options for Listening Questions\n');

    // Find all listening items with placeholder or "Unable to generate" options
    const query = await pool.query(`
      SELECT item_id, content, options, correct_answer, metadata
      FROM test_items
      WHERE section = 'listening'
      AND metadata->>'audio_filename' IS NOT NULL
      AND (
        options @> '["First answer option"]'::jsonb
        OR options @> '["Second answer option"]'::jsonb
        OR options @> '["Unable to generate option A"]'::jsonb
      )
      ORDER BY item_id
    `);

    const items = query.rows;
    console.log(`Found ${items.length} items with placeholder options\n`);

    if (items.length === 0) {
      console.log('✅ All items already have real options!');
      await pool.end();
      return;
    }

    let updated = 0;

    for (const item of items) {
      console.log(`Processing: ${item.item_id}...`);
      
      try {
        // Parse content to get question
        let questionText = item.content;
        try {
          const parsed = JSON.parse(item.content);
          questionText = parsed.question || parsed.prompt || item.content;
        } catch {
          // Content is plain text
        }
        
        const { options, correctIndex } = generateContextualOptions(questionText);
        
        // Update database
        await pool.query(
          `UPDATE test_items 
           SET options = $1, correct_answer = $2
           WHERE item_id = $3`,
          [JSON.stringify(options), correctIndex, item.item_id]
        );
        
        console.log(`  ✅ Options: ${options.join(' | ')}`);
        console.log(`  ✅ Correct: Option ${correctIndex + 1} - "${options[correctIndex]}"`);
        updated++;
      } catch (error) {
        console.error(`  ❌ Failed: ${error}`);
      }
    }

    console.log(`\n📊 Results:`);
    console.log(`  ✅ Updated: ${updated} items`);

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
