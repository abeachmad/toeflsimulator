#!/usr/bin/env tsx
/**
 * Quick Audio Setup Checker
 * 
 * Verifies that audio ingestion is working properly:
 * - Database connectivity
 * - Audio files present
 * - Listening items exist
 * - Audio URLs are valid
 */

import { pool } from '../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUDIO_DIR = path.join(__dirname, '../uploads/audio');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function printStatus(status: 'ok' | 'warning' | 'error', message: string) {
  const icon = status === 'ok' ? '✅' : status === 'warning' ? '⚠️' : '❌';
  const color = status === 'ok' ? colors.green : status === 'warning' ? colors.yellow : colors.red;
  console.log(`${icon} ${color}${message}${colors.reset}`);
}

async function checkAudioSetup() {
  console.log(`${colors.bold}${colors.cyan}`);
  console.log('═══════════════════════════════════════════');
  console.log('   TOEFL Audio Setup Checker');
  console.log('═══════════════════════════════════════════');
  console.log(colors.reset);

  let allChecksPass = true;

  // Check 1: Database Connection
  console.log('\n1️⃣  Database Connection');
  try {
    await pool.query('SELECT 1');
    printStatus('ok', 'Database connection successful');
  } catch (error) {
    printStatus('error', `Database connection failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    allChecksPass = false;
    await pool.end();
    process.exit(1);
  }

  // Check 2: Audio Directory
  console.log('\n2️⃣  Audio Directory');
  if (fs.existsSync(AUDIO_DIR)) {
    printStatus('ok', `Audio directory exists: ${AUDIO_DIR}`);
    
    const files = fs.readdirSync(AUDIO_DIR);
    const audioFiles = files.filter(f => 
      f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.m4a')
    );
    
    if (audioFiles.length > 0) {
      printStatus('ok', `Found ${audioFiles.length} audio files`);
      
      // Show file sizes
      let totalSize = 0;
      audioFiles.forEach(file => {
        const stats = fs.statSync(path.join(AUDIO_DIR, file));
        totalSize += stats.size;
      });
      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
      console.log(`   Total size: ${totalSizeMB} MB`);
    } else {
      printStatus('warning', 'No audio files found in directory');
      console.log(`   ${colors.yellow}Run: npm run ingest-audio${colors.reset}`);
    }
  } else {
    printStatus('error', 'Audio directory does not exist');
    console.log(`   ${colors.red}Expected: ${AUDIO_DIR}${colors.reset}`);
    allChecksPass = false;
  }

  // Check 3: Listening Items in Database
  console.log('\n3️⃣  Listening Items');
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM test_items WHERE section = \'listening\''
    );
    const count = parseInt(result.rows[0].count);
    
    if (count > 0) {
      printStatus('ok', `${count} listening items in database`);
    } else {
      printStatus('warning', 'No listening items in database');
      console.log(`   ${colors.yellow}Run: npm run db:seed or npm run ingest-audio${colors.reset}`);
    }
  } catch (error) {
    printStatus('error', 'Failed to query listening items');
    allChecksPass = false;
  }

  // Check 4: Items with Audio URLs
  console.log('\n4️⃣  Audio URL Mapping');
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count 
      FROM test_items 
      WHERE section = 'listening' 
      AND metadata->>'audio_url' IS NOT NULL
    `);
    const count = parseInt(result.rows[0].count);
    
    if (count > 0) {
      printStatus('ok', `${count} items have audio URLs`);
    } else {
      printStatus('warning', 'No items with audio URLs');
      console.log(`   ${colors.yellow}Run: npm run ingest-audio${colors.reset}`);
    }
  } catch (error) {
    printStatus('error', 'Failed to check audio URLs');
    allChecksPass = false;
  }

  // Check 5: Audio File Validation
  console.log('\n5️⃣  Audio File Validation');
  try {
    const result = await pool.query(`
      SELECT DISTINCT metadata->>'audio_filename' as filename
      FROM test_items
      WHERE section = 'listening'
      AND metadata->>'audio_filename' IS NOT NULL
    `);
    
    let matched = 0;
    let missing = 0;
    const missingFiles: string[] = [];
    
    result.rows.forEach(row => {
      const filePath = path.join(AUDIO_DIR, row.filename);
      if (fs.existsSync(filePath)) {
        matched++;
      } else {
        missing++;
        missingFiles.push(row.filename);
      }
    });
    
    if (missing === 0 && matched > 0) {
      printStatus('ok', `All ${matched} audio files are present`);
    } else if (missing > 0) {
      printStatus('warning', `${missing} audio files are missing`);
      missingFiles.forEach(file => {
        console.log(`   ${colors.yellow}- ${file}${colors.reset}`);
      });
    } else {
      printStatus('warning', 'No audio files referenced in database');
    }
  } catch (error) {
    printStatus('error', 'Failed to validate audio files');
    allChecksPass = false;
  }

  // Check 6: Magoosh Audio (specific check)
  console.log('\n6️⃣  Magoosh Audio (Example)');
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count 
      FROM test_items 
      WHERE metadata->>'source' = 'Magoosh Official Practice'
    `);
    const count = parseInt(result.rows[0].count);
    
    if (count > 0) {
      printStatus('ok', `${count} Magoosh items found`);
      
      // Check if Magoosh audio files exist
      const magooshFiles = [
        'magoosh-lecture-1-high-intermediate.mp3',
        'magoosh-speaking-task4-lecture.mp3'
      ];
      
      const existingMagoosh = magooshFiles.filter(f => 
        fs.existsSync(path.join(AUDIO_DIR, f))
      );
      
      console.log(`   Audio files: ${existingMagoosh.length}/${magooshFiles.length} present`);
    } else {
      printStatus('warning', 'No Magoosh items found');
      console.log(`   ${colors.yellow}Run: npm run ingest-audio${colors.reset}`);
    }
  } catch (error) {
    printStatus('error', 'Failed to check Magoosh items');
  }

  // Check 7: IRT Parameters
  console.log('\n7️⃣  IRT Parameters');
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM test_items
      WHERE section = 'listening'
      AND irt_parameters IS NOT NULL
      AND irt_parameters::jsonb ? 'a'
      AND irt_parameters::jsonb ? 'b'
      AND irt_parameters::jsonb ? 'c'
    `);
    const count = parseInt(result.rows[0].count);
    
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM test_items WHERE section = \'listening\''
    );
    const total = parseInt(totalResult.rows[0].total);
    
    if (count === total && total > 0) {
      printStatus('ok', `All ${count} items have valid IRT parameters`);
    } else if (count > 0) {
      printStatus('warning', `${count}/${total} items have IRT parameters`);
    } else {
      printStatus('error', 'No items with IRT parameters');
      allChecksPass = false;
    }
  } catch (error) {
    printStatus('error', 'Failed to check IRT parameters');
    allChecksPass = false;
  }

  // Summary
  console.log('\n' + colors.cyan + '═══════════════════════════════════════════' + colors.reset);
  
  if (allChecksPass) {
    console.log(`${colors.green}${colors.bold}\n✅ All checks passed! Audio setup is ready.${colors.reset}\n`);
    console.log('Next steps:');
    console.log('  1. Start backend: npm run dev');
    console.log('  2. Test audio playback in frontend');
    console.log('  3. Optionally add more sources: npm run ingest-audio');
  } else {
    console.log(`${colors.red}${colors.bold}\n❌ Some checks failed. See above for details.${colors.reset}\n`);
    console.log('Quick fixes:');
    console.log('  - Database: Check .env file and PostgreSQL status');
    console.log('  - Audio files: Run npm run ingest-audio');
    console.log('  - Items: Run npm run db:seed or npm run ingest-audio');
  }
  
  console.log('');

  await pool.end();
  process.exit(allChecksPass ? 0 : 1);
}

// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  checkAudioSetup().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { checkAudioSetup };
