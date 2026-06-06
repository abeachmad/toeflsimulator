/**
 * Generate proper answer options for listening questions
 * that currently have placeholder text
 */

import { pool } from '../src/config/database.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

interface ListeningItem {
  item_id: string;
  content: string;
  options: string[];
  correct_answer: string | number;
  metadata: any;
}

async function generateOptions(item: ListeningItem): Promise<{ options: string[], correctIndex: number }> {
  try {
    // Parse content to get question
    let questionText = item.content;
    try {
      const parsed = JSON.parse(item.content);
      questionText = parsed.question || parsed.prompt || item.content;
    } catch {
      // Content is plain text
    }

    const prompt = `You are generating multiple choice options for a TOEFL listening comprehension question.

Question: ${questionText}

Generate 4 plausible answer options where:
1. One is clearly correct
2. The other 3 are plausible but incorrect distractors
3. Options should be concise (5-10 words each)
4. Options should test comprehension, not trick the student

Return ONLY a JSON object in this format:
{
  "options": ["correct answer", "distractor 1", "distractor 2", "distractor 3"],
  "correctIndex": 0
}

Make the options diverse and contextually appropriate for TOEFL listening.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const generated = JSON.parse(jsonMatch[0]);
    
    // Shuffle options to randomize correct answer position
    const shuffled = shuffleOptionsWithCorrect(generated.options, generated.correctIndex);
    
    return shuffled;
  } catch (error) {
    console.error(`Failed to generate options for ${item.item_id}:`, error);
    // Return placeholder as fallback
    return {
      options: [
        'Unable to generate option A',
        'Unable to generate option B',
        'Unable to generate option C',
        'Unable to generate option D'
      ],
      correctIndex: 0
    };
  }
}

function shuffleOptionsWithCorrect(options: string[], correctIndex: number): { options: string[], correctIndex: number } {
  const items = options.map((opt, idx) => ({ option: opt, wasCorrect: idx === correctIndex }));
  
  // Fisher-Yates shuffle
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  
  const shuffledOptions = items.map(item => item.option);
  const newCorrectIndex = items.findIndex(item => item.wasCorrect);
  
  return { options: shuffledOptions, correctIndex: newCorrectIndex };
}

async function main() {
  try {
    console.log('🎯 Generating Real Options for Listening Questions\n');

    // Find all listening items with placeholder options
    const query = await pool.query<ListeningItem>(`
      SELECT item_id, content, options, correct_answer, metadata
      FROM test_items
      WHERE section = 'listening'
      AND metadata->>'audio_filename' IS NOT NULL
      AND (
        options @> '["First answer option"]'::jsonb
        OR options @> '["Second answer option"]'::jsonb
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
    let failed = 0;

    for (const item of items) {
      console.log(`Processing: ${item.item_id}...`);
      
      try {
        const { options, correctIndex } = await generateOptions(item);
        
        // Update database
        await pool.query(
          `UPDATE test_items 
           SET options = $1, correct_answer = $2
           WHERE item_id = $3`,
          [JSON.stringify(options), correctIndex, item.item_id]
        );
        
        console.log(`  ✅ Generated: ${options[correctIndex]} (correct)`);
        console.log(`  Options: ${options.join(' | ')}`);
        updated++;
        
        // Rate limit: wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`  ❌ Failed: ${error}`);
        failed++;
      }
    }

    console.log(`\n📊 Results:`);
    console.log(`  ✅ Updated: ${updated} items`);
    console.log(`  ❌ Failed: ${failed} items`);

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
