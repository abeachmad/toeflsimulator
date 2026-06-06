/**
 * Verification script for audio ingestion
 * Shows statistics and sample data from listening items
 */

import { pool } from '../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUDIO_DIR = path.join(__dirname, '../uploads/audio');

async function verifyIngestion() {
  try {
    console.log('🔍 Audio Ingestion Verification Report');
    console.log('═══════════════════════════════════════\n');

    // 1. Count listening items by source
    console.log('📊 Listening Items by Source:');
    const sourceQuery = `
      SELECT 
        metadata->>'source' as source,
        COUNT(*) as count
      FROM test_items
      WHERE section = 'listening'
      GROUP BY metadata->>'source'
      ORDER BY count DESC;
    `;
    const sources = await pool.query(sourceQuery);
    sources.rows.forEach(row => {
      console.log(`   ${row.source}: ${row.count} items`);
    });

    // 2. Total listening items
    const totalQuery = `SELECT COUNT(*) as total FROM test_items WHERE section = 'listening'`;
    const total = await pool.query(totalQuery);
    console.log(`\n📈 Total Listening Items: ${total.rows[0].total}`);

    // 3. Items with audio files
    const audioQuery = `
      SELECT COUNT(*) as count 
      FROM test_items 
      WHERE section = 'listening' 
      AND metadata->>'audio_url' IS NOT NULL
    `;
    const withAudio = await pool.query(audioQuery);
    console.log(`🎵 Items with Audio URLs: ${withAudio.rows[0].count}`);

    // 4. Difficulty distribution
    console.log('\n📊 Difficulty Distribution:');
    const diffQuery = `
      SELECT 
        difficulty_level,
        COUNT(*) as count
      FROM test_items
      WHERE section = 'listening'
      GROUP BY difficulty_level
      ORDER BY 
        CASE difficulty_level
          WHEN 'easy' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'hard' THEN 3
          ELSE 4
        END;
    `;
    const difficulties = await pool.query(diffQuery);
    difficulties.rows.forEach(row => {
      console.log(`   ${row.difficulty_level || 'unspecified'}: ${row.count} items`);
    });

    // 5. Stage distribution
    console.log('\n📊 Stage Distribution:');
    const stageQuery = `
      SELECT 
        stage,
        COUNT(*) as count
      FROM test_items
      WHERE section = 'listening'
      GROUP BY stage
      ORDER BY stage;
    `;
    const stages = await pool.query(stageQuery);
    stages.rows.forEach(row => {
      console.log(`   Stage ${row.stage || 'unspecified'}: ${row.count} items`);
    });

    // 6. Type distribution
    console.log('\n📊 Type Distribution:');
    const typeQuery = `
      SELECT 
        type,
        COUNT(*) as count
      FROM test_items
      WHERE section = 'listening'
      GROUP BY type
      ORDER BY count DESC;
    `;
    const types = await pool.query(typeQuery);
    types.rows.forEach(row => {
      console.log(`   ${row.type}: ${row.count} items`);
    });

    // 7. Sample Magoosh items
    console.log('\n📝 Sample Magoosh Items:');
    const magooshQuery = `
      SELECT 
        item_id,
        type,
        difficulty_level,
        LEFT(content, 80) as content_preview,
        metadata->>'audio_filename' as audio_file
      FROM test_items
      WHERE section = 'listening' 
      AND item_id LIKE 'magoosh%'
      ORDER BY item_id
      LIMIT 5;
    `;
    const magoosh = await pool.query(magooshQuery);
    magoosh.rows.forEach(row => {
      console.log(`\n   ID: ${row.item_id}`);
      console.log(`   Type: ${row.type}`);
      console.log(`   Difficulty: ${row.difficulty_level}`);
      console.log(`   Audio: ${row.audio_file}`);
      console.log(`   Content: ${row.content_preview}...`);
    });

    // 8. Audio files on disk
    console.log('\n\n🎵 Audio Files on Disk:');
    if (fs.existsSync(AUDIO_DIR)) {
      const files = fs.readdirSync(AUDIO_DIR);
      const audioFiles = files.filter(f => 
        f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.m4a')
      );
      
      console.log(`   Total files: ${audioFiles.length}\n`);
      audioFiles.forEach(file => {
        const stats = fs.statSync(path.join(AUDIO_DIR, file));
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`   - ${file} (${sizeMB} MB)`);
      });
    } else {
      console.log('   ⚠ Audio directory not found');
    }

    // 9. Verify audio URLs match files
    console.log('\n\n🔗 Audio URL Verification:');
    const urlQuery = `
      SELECT DISTINCT 
        metadata->>'audio_filename' as filename
      FROM test_items
      WHERE section = 'listening'
      AND metadata->>'audio_filename' IS NOT NULL;
    `;
    const urls = await pool.query(urlQuery);
    
    let matched = 0;
    let missing = 0;
    
    urls.rows.forEach(row => {
      const filePath = path.join(AUDIO_DIR, row.filename);
      if (fs.existsSync(filePath)) {
        matched++;
      } else {
        missing++;
        console.log(`   ⚠ Missing: ${row.filename}`);
      }
    });
    
    console.log(`   ✅ Matched: ${matched} files`);
    console.log(`   ⚠ Missing: ${missing} files`);

    // 10. IRT Parameters check
    console.log('\n\n📊 IRT Parameters Sample:');
    const irtQuery = `
      SELECT 
        item_id,
        difficulty_level,
        irt_parameters->>'a' as discrimination,
        irt_parameters->>'b' as difficulty,
        irt_parameters->>'c' as guessing
      FROM test_items
      WHERE section = 'listening'
      AND item_id LIKE 'magoosh%'
      LIMIT 3;
    `;
    const irt = await pool.query(irtQuery);
    irt.rows.forEach(row => {
      console.log(`   ${row.item_id} (${row.difficulty_level}):`);
      console.log(`     a=${row.discrimination}, b=${row.difficulty}, c=${row.guessing}`);
    });

    console.log('\n✅ Verification complete!');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

verifyIngestion();
