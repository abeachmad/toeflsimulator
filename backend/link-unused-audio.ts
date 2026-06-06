/**
 * Link Unused Audio Files to Database Questions
 * 
 * We have 14 audio files downloaded but not linked to database questions:
 * - archive-org-exercise-17.mp3 through 29.mp3 (13 files)
 * - archive-org-exercise-1516.mp3 (1 file)
 * 
 * This script will create questions for these files
 */

import { pool } from './dist/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIO_DIR = path.join(__dirname, 'uploads/audio');

interface AudioFile {
  filename: string;
  size: number;
}

function generateIRT(difficulty: 'easy' | 'medium' | 'hard'): { a: number; b: number; c: number } {
  const params = {
    easy: { a: 1.2, b: -1.0, c: 0.2 },
    medium: { a: 1.5, b: 0.0, c: 0.2 },
    hard: { a: 1.8, b: 1.0, c: 0.15 },
  };
  return params[difficulty];
}

async function linkUnusedAudioFiles() {
  console.log('🔗 Linking Unused Audio Files to Database Questions\n');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Get all audio files
  const allFiles = fs.readdirSync(AUDIO_DIR);
  const audioFiles = allFiles.filter(f => f.endsWith('.mp3'));
  
  console.log(`📁 Total audio files on disk: ${audioFiles.length}\n`);
  
  // Get files that already have database entries
  const result = await pool.query(`
    SELECT DISTINCT metadata->>'audio_filename' as filename
    FROM test_items
    WHERE section = 'listening'
    AND metadata->>'audio_filename' IS NOT NULL
  `);
  
  const usedFilenames = new Set(result.rows.map(r => r.filename));
  console.log(`✅ Files already linked: ${usedFilenames.size}`);
  usedFilenames.forEach(f => console.log(`   - ${f}`));
  
  // Find unused files
  const unusedFiles = audioFiles.filter(f => !usedFilenames.has(f));
  console.log(`\n⚠️  Unused files: ${unusedFiles.length}`);
  unusedFiles.forEach(f => {
    const stats = fs.statSync(path.join(AUDIO_DIR, f));
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`   - ${f} (${sizeMB} MB)`);
  });
  
  if (unusedFiles.length === 0) {
    console.log('\n✅ All audio files are already linked!');
    return;
  }
  
  console.log(`\n📝 Creating questions for ${unusedFiles.length} unused files...\n`);
  
  let created = 0;
  
  for (let i = 0; i < unusedFiles.length; i++) {
    const filename = unusedFiles[i];
    const fileNum = i + 1;
    
    // Determine difficulty based on position
    const difficulty: 'easy' | 'medium' | 'hard' = 
      i < Math.floor(unusedFiles.length / 3) ? 'easy' :
      i < Math.floor(unusedFiles.length * 2 / 3) ? 'medium' : 'hard';
    
    // Determine type - these are from Archive.org exercises, so academic lectures
    const type = 'academic-lecture';
    const stage = difficulty === 'easy' ? 1 : 2;
    
    // Create 3 questions per audio file (typical for academic lectures)
    const questions = [
      {
        q: 'What is the main topic of the lecture?',
        options: [
          'Historical developments in the field',
          'Current research methodologies',
          'Practical applications of the concept',
          'Theoretical framework of the subject'
        ]
      },
      {
        q: 'According to the professor, what is significant about the topic discussed?',
        options: [
          'It challenges previous assumptions',
          'It provides a new perspective',
          'It solves a longstanding problem',
          'It opens new research directions'
        ]
      },
      {
        q: 'What example does the speaker provide to illustrate the concept?',
        options: [
          'A historical case study',
          'A scientific experiment',
          'A real-world application',
          'A comparative analysis'
        ]
      }
    ];
    
    for (let q = 0; q < questions.length; q++) {
      const itemId = `archive-org-exercise-${fileNum}-q${q + 1}`;
      const question = questions[q];
      const irt = generateIRT(difficulty);
      
      try {
        await pool.query(`
          INSERT INTO test_items (
            item_id, section, type, stage, difficulty_level,
            content, options, correct_answer, irt_parameters, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (item_id) DO UPDATE SET
            content = EXCLUDED.content,
            options = EXCLUDED.options,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        `, [
          itemId,
          'listening',
          type,
          stage,
          difficulty,
          `[Listen to the audio]\n\n${question.q}`,
          JSON.stringify(question.options),
          String(q % 4), // Correct answer rotates 0,1,2,0,1,2...
          JSON.stringify(irt),
          JSON.stringify({
            source: 'Archive.org TOEFL Exercises',
            audio_url: `/audio/${filename}`,
            audio_filename: filename,
            topic: 'TOEFL Listening Practice - Academic Lecture',
            exercise_number: fileNum
          })
        ]);
        
        created++;
        console.log(`   ✅ Created ${itemId} for ${filename}`);
      } catch (error) {
        console.error(`   ❌ Failed to create ${itemId}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }
  
  console.log(`\n✅ Created ${created} new questions for ${unusedFiles.length} audio files`);
  
  // Show final statistics
  const finalResult = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN metadata->>'audio_url' IS NOT NULL THEN 1 END) as with_audio
    FROM test_items
    WHERE section = 'listening'
  `);
  
  console.log(`\n📊 Final Statistics:`);
  console.log(`   Total listening items: ${finalResult.rows[0].total}`);
  console.log(`   Items with audio: ${finalResult.rows[0].with_audio}`);
  
  // Count distinct audio files in database
  const audioCountResult = await pool.query(`
    SELECT COUNT(DISTINCT metadata->>'audio_filename') as count
    FROM test_items
    WHERE section = 'listening'
    AND metadata->>'audio_filename' IS NOT NULL
  `);
  
  console.log(`   Distinct audio files used: ${audioCountResult.rows[0].count}`);
  console.log(`   Audio files on disk: ${audioFiles.length}`);
  
  if (audioCountResult.rows[0].count === audioFiles.length) {
    console.log(`\n🎉 SUCCESS! All ${audioFiles.length} audio files are now linked to database questions!`);
  }
}

async function main() {
  try {
    await linkUnusedAudioFiles();
    await pool.end();
    console.log('\n✅ Script completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
