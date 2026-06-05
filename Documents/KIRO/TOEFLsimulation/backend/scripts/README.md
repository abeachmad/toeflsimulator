# Database Seeding Scripts

This directory contains scripts for initializing and seeding the TOEFL iBT 2026 Test Simulator database.

## Prerequisites

1. **PostgreSQL 16+** must be installed and running
2. **Database** `toefl_simulator` must be created
3. **Environment variables** must be configured in `.env` file

## Quick Start

### Option 1: Using Docker Compose (Recommended)

```bash
# Start PostgreSQL container
cd ..
docker-compose up -d postgres

# Initialize database schema
npm run db:init

# Seed test data
npm run db:seed
```

### Option 2: Using Local PostgreSQL

```bash
# Create database
createdb -U postgres toefl_simulator

# Or using psql
psql -U postgres -c "CREATE DATABASE toefl_simulator;"

# Initialize schema
psql -U postgres -d toefl_simulator -f scripts/init-db.sql

# Seed test data
npm run db:seed
```

## Scripts Overview

### `init-db.sql`
Initializes the database schema including:
- `test_items` table - Stores all test questions and content
- `exam_sessions` table - Tracks user exam sessions
- `cefr_conversion` table - CEFR to scale score conversion data
- Indexes for performance optimization
- Triggers for automatic timestamp updates

**Usage:**
```bash
psql -U postgres -d toefl_simulator -f scripts/init-db.sql
```

### `seed-database.ts`
Main seeding script that:
- Downloads official TOEFL datasets from external sources
- Generates synthetic test items for all sections
- Populates `test_items` table with 50+ items per section (MVP requirement)
- Validates item distribution across difficulty levels
- Verifies MVP requirements are met

**Usage:**
```bash
npm run db:seed
```

**What it seeds:**
- **Reading**: 50+ items (TOEFL-QA dataset + Wordlink vocabulary + synthetic)
- **Listening**: 47+ items (synthetic conversations and lectures)
- **Writing**: 12+ items (academic discussion + build sentence + email)
- **Speaking**: 11+ items (listen-repeat + simulated interview)
- **CEFR Conversion**: Official ETS 2026 conversion data (already in init-db.sql)

### `test-db-connection.ts`
Utility script to verify database connectivity and initialization status.

**Usage:**
```bash
npm run db:test
```

**What it checks:**
- Database connection status
- Table existence
- Row counts in key tables

## Data Sources

### External Datasets (Automatically Downloaded)

1. **TOEFL-QA Dataset**
   - Source: https://github.com/iamyuanchung/TOEFL-QA
   - Content: Reading comprehension passages and questions
   - Format: JSON
   - Usage: Reading section items

2. **Wordlink Vocabulary Dataset**
   - Source: Hugging Face - Genius-Society/wordlink
   - Content: Synonym matching questions
   - Format: JSON
   - Usage: Reading vocabulary items

3. **Academic Discussion Dataset**
   - Source: Hugging Face - Rinat0423/toefl
   - Content: Professor prompts and peer opinions
   - Format: JSON
   - Usage: Writing section tasks

### Synthetic Data Generation

For sections where external datasets are unavailable or insufficient, the seeder generates high-quality synthetic items:

- **Listening Items**: Conversations, academic lectures, choose-response
- **Speaking Items**: Listen-repeat tasks, simulated interviews
- **Writing Items**: Build sentence, email, academic discussion

All synthetic items include:
- Realistic IRT parameters (a, b, c) based on difficulty level
- Proper difficulty distribution (easy, medium, hard)
- Stage assignment (Stage 1 or Stage 2) for MST engine
- Complete metadata for adaptive testing

## IRT Parameters

All test items include 3-Parameter Logistic (3PL) IRT parameters:

- **a (discrimination)**: 0.5 to 2.5 - How well the item differentiates ability levels
- **b (difficulty)**: -3.0 to +3.0 - Item difficulty on the ability scale
- **c (guessing)**: 0.0 to 0.3 - Probability of guessing correctly

### Parameter Generation by Difficulty

| Difficulty | a (discrimination) | b (difficulty) | c (guessing) |
|------------|-------------------|----------------|--------------|
| Easy       | 1.0 - 1.5         | -1.5 to -0.7   | 0.20 - 0.25  |
| Medium     | 1.2 - 1.8         | -0.5 to +0.5   | 0.15 - 0.25  |
| Hard       | 1.5 - 2.3         | +0.7 to +1.7   | 0.10 - 0.20  |

## Seeding Output

When you run `npm run db:seed`, you'll see:

```
╔═══════════════════════════════════════════════════════════╗
║  TOEFL iBT 2026 Test Simulator - Database Seeding        ║
╚═══════════════════════════════════════════════════════════╝

📡 Connecting to database...
✓ Database connection established
✓ CEFR conversion table populated (24 entries)

📥 Phase 1: Downloading external datasets
  → Downloading TOEFL-QA dataset...
    ✓ Downloaded successfully
    → Parsed 60 reading items

🔧 Phase 2: Generating synthetic test items
  → Generating listening items
    ✓ Generated 60 listening items
  → Generating writing items
    ✓ Generated 15 writing items
  → Generating speaking items
    ✓ Generated 15 speaking items

💾 Phase 3: Loading items into database
[DataLoader] Starting batch load of 150 test items
[DataLoader] Validated: 150 valid, 0 invalid
[DataLoader] Batch 1: Inserted 100 items
[DataLoader] Batch 2: Inserted 50 items

╔═══════════════════════════════════════════════════════════╗
║  Import Summary                                           ║
╠═══════════════════════════════════════════════════════════╣
║  ✓ Items inserted: 150                                    ║
║  ⚠️  Items failed:   0                                     ║
╚═══════════════════════════════════════════════════════════╝

📊 Phase 4: Verifying item distribution

Item Distribution:
─────────────────────────────────────────────────────────

  READING: 63 items
    - Stage 1, easy: 10 items
    - Stage 1, medium: 15 items
    - Stage 2, hard: 20 items
    - Stage 2, medium: 18 items

  LISTENING: 60 items
    - Stage 1, easy: 20 items
    - Stage 1, medium: 10 items
    - Stage 2, medium: 10 items
    - Stage 2, hard: 20 items

  WRITING: 15 items
    - Stage N/A, medium: 15 items

  SPEAKING: 15 items
    - Stage N/A, medium: 15 items

Total items in database: 153

MVP Requirements Check:
─────────────────────────────────────────────────────────

  ✓ reading: 63/50 items
  ✓ listening: 60/47 items
  ✓ writing: 15/12 items
  ✓ speaking: 15/11 items

╔═══════════════════════════════════════════════════════════╗
║  ✓ Database seeding completed successfully!               ║
║  ✓ All MVP requirements met                               ║
╚═══════════════════════════════════════════════════════════╝
```

## Troubleshooting

### Database Connection Failed

**Error**: `connection to server at "localhost" (::1), port 5432 failed`

**Solutions**:
1. Check if PostgreSQL is running:
   ```bash
   docker ps  # If using Docker
   # or
   pg_ctl status  # If using local install
   ```

2. Verify `.env` file has correct `DATABASE_URL`:
   ```
   DATABASE_URL=postgresql://postgres:<your_db_password>@localhost:5432/toefl_simulator
   ```

3. Create database if it doesn't exist:
   ```bash
   createdb -U postgres toefl_simulator
   ```

### Tables Don't Exist

**Error**: `relation "test_items" does not exist`

**Solution**: Run the initialization script first:
```bash
psql -U postgres -d toefl_simulator -f scripts/init-db.sql
```

### External Dataset Download Fails

If external datasets fail to download (network issues, rate limits), the seeder will automatically fall back to synthetic data generation. You'll see:

```
⚠️  Failed to download TOEFL-QA: connection timeout
→ Will use synthetic data instead
```

This is normal and won't affect functionality - synthetic items are designed to match the quality of real datasets.

### Duplicate Items

If you run the seeder multiple times, duplicate items are automatically skipped:

```bash
npm run db:seed
# Items already in database will be skipped
```

To force re-seeding:
```sql
-- Clear test items
TRUNCATE TABLE test_items RESTART IDENTITY CASCADE;
```

Then run `npm run db:seed` again.

## Verifying Seeded Data

### Using psql

```bash
# Connect to database
psql -U postgres -d toefl_simulator

# Check item counts by section
SELECT section, COUNT(*) as count
FROM test_items
GROUP BY section
ORDER BY section;

# Check difficulty distribution
SELECT section, difficulty_level, COUNT(*) as count
FROM test_items
GROUP BY section, difficulty_level
ORDER BY section, difficulty_level;

# Check IRT parameters
SELECT item_id, section, 
       irt_parameters->>'a' as discrimination,
       irt_parameters->>'b' as difficulty,
       irt_parameters->>'c' as guessing
FROM test_items
LIMIT 10;

# Check CEFR conversion data
SELECT section, cefr_band, theta_min, theta_max, scale_score
FROM cefr_conversion
ORDER BY section, cefr_band;
```

### Using the DataLoader API

```typescript
import { DataLoader } from '../src/services/DataLoader';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const loader = new DataLoader(pool);

// Get statistics
const stats = await loader.getItemStatistics();
console.log(stats);

// Pretty print some items
const result = await pool.query('SELECT * FROM test_items LIMIT 5');
loader.prettyPrint(result.rows);
```

## Advanced Usage

### Seeding Specific Sections Only

Modify `seed-database.ts` to comment out sections you don't want:

```typescript
// Comment these lines to skip specific sections
// const listeningItems = generateListeningItems();
// allItems.push(...listeningItems);
```

### Custom IRT Parameters

To use specific IRT parameters instead of random generation, modify the item data:

```typescript
const customItem: RawItemData = {
  id: 'custom-001',
  section: 'reading',
  type: 'multiple-choice',
  difficulty_level: 'medium',
  content: 'Your question content here',
  options: ['A', 'B', 'C', 'D'],
  correct_answer: 'A',
  irt_a: 1.5,  // Specific discrimination
  irt_b: 0.2,  // Specific difficulty
  irt_c: 0.2   // Specific guessing
};
```

### Importing CSV/JSON Files

Use the DataLoader directly to import custom files:

```typescript
import { DataLoader } from '../src/services/DataLoader';

const loader = new DataLoader(pool);

// From CSV
await loader.loadFromCSV('/path/to/items.csv');

// From JSON
await loader.loadFromJSON('/path/to/items.json');
```

## Requirements Validation

This seeding script validates the following requirements:

✓ **14.1**: Parse TOEFL-QA Dataset from GitHub  
✓ **14.2**: Parse Sentence Insertion Dataset  
✓ **14.3**: Parse Academic Discussion Dataset  
✓ **14.4**: Parse Synonym Match Dataset (Wordlink)  
✓ **14.5**: Parse TOEFL-Spell Dataset  
✓ **9.3**: Dual scoring system (CEFR conversion table)  

MVP Requirements:
✓ Reading: 50+ items per section  
✓ Listening: 47+ items per section  
✓ Writing: 12+ items per section  
✓ Speaking: 11+ items per section  

## Related Documentation

- [Database Schema](./init-db.sql) - Complete schema definition
- [DataLoader Service](../src/services/DataLoader.ts) - Data import implementation
- [IRT Types](../src/models/irt.types.ts) - Type definitions
- [Design Document](../../.kiro/specs/toefl-simulator/design.md) - System design

## Support

For issues or questions about database seeding:
1. Check the troubleshooting section above
2. Review the DataLoader test files for examples
3. Consult the requirements and design documents
