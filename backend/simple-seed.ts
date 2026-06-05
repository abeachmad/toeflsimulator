import { Pool } from 'pg';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function simpleSeed() {
  try {
    console.log('🌱 Starting simple database seeding...\n');
    
    // Load sample reading items
    const readingPath = path.join(__dirname, 'datasets', 'sample-reading-items.json');
    const writingPath = path.join(__dirname, 'datasets', 'sample-writing-items.json');
    
    console.log('📖 Loading sample files...');
    const readingItems = JSON.parse(fs.readFileSync(readingPath, 'utf-8'));
    const writingItems = JSON.parse(fs.readFileSync(writingPath, 'utf-8'));
    
    console.log(`  ✓ Loaded ${readingItems.length} reading items`);
    console.log(`  ✓ Loaded ${writingItems.length} writing items\n`);
    
    // Insert items
    let inserted = 0;
    let failed = 0;
    
    console.log('💾 Inserting items into database...\n');
    
    for (const item of [...readingItems, ...writingItems]) {
      try {
        await pool.query(`
          INSERT INTO test_items (
            item_id, section, type, difficulty_level, stage,
            content, options, correct_answer, irt_parameters, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (item_id) DO NOTHING
        `, [
          item.id,
          item.section,
          item.type,
          item.difficulty_level,
          item.stage || 1,
          item.content,
          JSON.stringify(item.options || []),
          item.correct_answer || '',
          JSON.stringify({
            a: item.irt_a || 1.0,
            b: item.irt_b || 0.0,
            c: item.irt_c || 0.2
          }),
          JSON.stringify(item.metadata || {})
        ]);
        inserted++;
        if (inserted % 10 === 0) {
          process.stdout.write(`  → Inserted ${inserted} items...\r`);
        }
      } catch (error) {
        failed++;
        console.error(`  ✗ Failed to insert ${item.id}:`, error instanceof Error ? error.message : error);
      }
    }
    
    console.log(`\n\n✅ Seeding completed!`);
    console.log(`  ✓ Items inserted: ${inserted}`);
    console.log(`  ✗ Items failed: ${failed}\n`);
    
    // Verify
    const result = await pool.query('SELECT section, COUNT(*) as count FROM test_items GROUP BY section ORDER BY section');
    console.log('📊 Items by section:');
    result.rows.forEach((row: any) => {
      console.log(`  - ${row.section}: ${row.count}`);
    });
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

simpleSeed();
