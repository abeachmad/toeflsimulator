/**
 * DataLoader - Handles test item import from CSV/JSON files
 * 
 * Implements Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 15.3, 16.2
 * 
 * This service provides:
 * - CSV and JSON file parsing for test items
 * - Item validation against database schema
 * - Parsers for different item types (reading, listening, writing, speaking)
 * - Batch import with transaction support
 * - Error handling and validation reporting
 */

import { Pool } from 'pg';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { z } from 'zod';
import { Item, Section, DifficultyLevel, IRTParameters } from '../models/irt.types.js';

/**
 * Item validation schema using Zod
 * Validates against database schema and requirement constraints
 */
const IRTParametersSchema = z.object({
  a: z.number().min(0.5).max(2.5).describe('Discrimination parameter'),
  b: z.number().min(-3).max(3).describe('Difficulty parameter'),
  c: z.number().min(0.0).max(0.3).describe('Guessing parameter')
});

const ItemSchema = z.object({
  id: z.string().min(1).describe('Unique item identifier'),
  section: z.enum(['reading', 'listening', 'writing', 'speaking']).describe('Test section'),
  type: z.string().min(1).describe('Item type (e.g., multiple-choice, essay)'),
  difficulty_level: z.enum(['easy', 'medium', 'hard']).optional().describe('Difficulty tier'),
  stage: z.number().int().min(1).max(2).optional().describe('MST stage (1 or 2)'),
  content: z.string().min(1).describe('Item content/question text'),
  options: z.array(z.string()).optional().describe('Multiple choice options'),
  correct_answer: z.string().min(1).describe('Correct answer'),
  irt_parameters: IRTParametersSchema.describe('IRT 3PL parameters'),
  metadata: z.record(z.any()).optional().describe('Additional metadata')
});

/**
 * Raw item data from CSV or JSON before validation
 */
export interface RawItemData {
  id: string;
  section: string;
  type: string;
  difficulty_level?: string;
  stage?: number | string;
  content: string;
  options?: string | string[];
  correct_answer: string;
  irt_a?: number | string;
  irt_b?: number | string;
  irt_c?: number | string;
  irt_parameters?: IRTParameters | string;
  metadata?: Record<string, any> | string;
}

/**
 * Validation result for a batch of items
 */
export interface ValidationResult {
  valid: boolean;
  validItems: Item[];
  errors: Array<{
    itemId: string;
    errors: string[];
  }>;
}

/**
 * Import result with statistics
 */
export interface ImportResult {
  success: boolean;
  itemsImported: number;
  itemsSkipped: number;
  errors: string[];
}

/**
 * DataLoader Service
 * 
 * **Validates: Requirements 14.1-14.9, 15.3, 16.2**
 */
export class DataLoader {
  constructor(private db: Pool) {}

  /**
   * Parse CSV file and extract test items
   * 
   * **Validates: Requirement 14.1, 14.6**
   * THE Data_Loader SHALL extract item content, correct answers, distractors, 
   * and IRT parameters (a, b, c) from each dataset
   * 
   * @param filePath - Absolute path to CSV file
   * @returns Array of raw item data
   */
  parseCSV(filePath: string): RawItemData[] {
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: true,
        cast_date: false
      });

      console.log(`[DataLoader] Parsed ${records.length} items from CSV: ${filePath}`);
      
      return records as RawItemData[];
    } catch (error) {
      console.error(`[DataLoader] Failed to parse CSV file: ${filePath}`, error);
      throw new Error(`CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse JSON file and extract test items
   * 
   * **Validates: Requirement 14.1, 14.6**
   * THE Data_Loader SHALL extract item content, correct answers, distractors, 
   * and IRT parameters (a, b, c) from each dataset
   * 
   * @param filePath - Absolute path to JSON file
   * @returns Array of raw item data
   */
  parseJSON(filePath: string): RawItemData[] {
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileContent);

      // Handle both array and object with items property
      const items = Array.isArray(data) ? data : (data.items || []);

      console.log(`[DataLoader] Parsed ${items.length} items from JSON: ${filePath}`);
      
      return items as RawItemData[];
    } catch (error) {
      console.error(`[DataLoader] Failed to parse JSON file: ${filePath}`, error);
      throw new Error(`JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Normalize raw item data to Item interface
   * Handles various input formats and converts to standardized structure
   * 
   * @param rawItem - Raw item data from CSV or JSON
   * @returns Normalized Item object
   */
  private normalizeItem(rawItem: RawItemData): Item {
    // Parse options if string (CSV format)
    let options: string[] | undefined;
    if (rawItem.options) {
      if (typeof rawItem.options === 'string') {
        try {
          options = JSON.parse(rawItem.options);
        } catch {
          // If not JSON, split by delimiter
          options = rawItem.options.split('|').map(opt => opt.trim());
        }
      } else {
        options = rawItem.options;
      }
    }

    // Parse IRT parameters
    let irtParameters: IRTParameters;
    if (rawItem.irt_parameters) {
      if (typeof rawItem.irt_parameters === 'string') {
        irtParameters = JSON.parse(rawItem.irt_parameters);
      } else {
        irtParameters = rawItem.irt_parameters;
      }
    } else {
      // Build from separate fields
      irtParameters = {
        a: typeof rawItem.irt_a === 'string' ? parseFloat(rawItem.irt_a) : (rawItem.irt_a || 1.0),
        b: typeof rawItem.irt_b === 'string' ? parseFloat(rawItem.irt_b) : (rawItem.irt_b || 0.0),
        c: typeof rawItem.irt_c === 'string' ? parseFloat(rawItem.irt_c) : (rawItem.irt_c || 0.2)
      };
    }

    // Parse metadata
    let metadata: Record<string, any> | undefined;
    if (rawItem.metadata) {
      if (typeof rawItem.metadata === 'string') {
        try {
          metadata = JSON.parse(rawItem.metadata);
        } catch {
          metadata = { raw: rawItem.metadata };
        }
      } else {
        metadata = rawItem.metadata;
      }
    }

    // Parse stage if string
    const stage = rawItem.stage 
      ? (typeof rawItem.stage === 'string' ? parseInt(rawItem.stage) : rawItem.stage)
      : undefined;

    return {
      id: rawItem.id,
      section: rawItem.section as Section,
      type: rawItem.type,
      difficulty_level: rawItem.difficulty_level as DifficultyLevel | undefined,
      content: rawItem.content,
      options,
      correct_answer: rawItem.correct_answer,
      irt_parameters: irtParameters,
      metadata: {
        ...metadata,
        stage
      }
    };
  }

  /**
   * Validate items against database schema
   * 
   * **Validates: Requirements 14.8, 14.9**
   * - 14.8: WHEN parsing completes, THE Data_Loader SHALL validate that all 
   *         required fields are present for each item
   * - 14.9: IF validation fails for any item in a batch, THEN THE Data_Loader 
   *         SHALL reject the entire batch
   * 
   * @param rawItems - Array of raw item data
   * @returns Validation result with valid items and errors
   */
  validateItems(rawItems: RawItemData[]): ValidationResult {
    const validItems: Item[] = [];
    const errors: Array<{ itemId: string; errors: string[] }> = [];

    for (const rawItem of rawItems) {
      try {
        // Normalize item first
        const normalizedItem = this.normalizeItem(rawItem);
        
        // Validate with Zod schema
        const result = ItemSchema.safeParse(normalizedItem);

        if (result.success) {
          validItems.push(result.data);
        } else {
          const itemErrors = result.error.errors.map(err => 
            `${err.path.join('.')}: ${err.message}`
          );
          errors.push({
            itemId: rawItem.id || 'unknown',
            errors: itemErrors
          });
        }
      } catch (error) {
        errors.push({
          itemId: rawItem.id || 'unknown',
          errors: [error instanceof Error ? error.message : 'Unknown validation error']
        });
      }
    }

    const valid = errors.length === 0;

    console.log(`[DataLoader] Validation: ${validItems.length} valid, ${errors.length} errors`);

    return {
      valid,
      validItems,
      errors
    };
  }

  /**
   * Import items into database with transaction support
   * 
   * **Validates: Requirements 14.7, 14.9, 16.2**
   * - 14.7: THE Data_Loader SHALL store parsed items in PostgreSQL with 
   *         JSONB columns for adaptive module metadata
   * - 14.9: IF validation fails for any item in a batch, THEN THE Data_Loader 
   *         SHALL reject the entire batch
   * - 16.2: THE Test_Simulator SHALL store item content in a table with columns
   * 
   * @param items - Validated items to import
   * @param options - Import options (skipDuplicates, etc.)
   * @returns Import result with statistics
   */
  async importItems(
    items: Item[],
    options: { skipDuplicates?: boolean } = {}
  ): Promise<ImportResult> {
    const { skipDuplicates = false } = options;
    
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      let itemsImported = 0;
      let itemsSkipped = 0;
      const errors: string[] = [];

      for (const item of items) {
        try {
          const query = `
            INSERT INTO test_items (
              item_id,
              section,
              type,
              difficulty_level,
              stage,
              content,
              options,
              correct_answer,
              irt_parameters,
              metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ${skipDuplicates ? 'ON CONFLICT (item_id) DO NOTHING' : ''}
          `;

          const values = [
            item.id,
            item.section,
            item.type,
            item.difficulty_level || null,
            item.metadata?.stage || null,
            item.content,
            item.options ? JSON.stringify(item.options) : null,
            item.correct_answer,
            JSON.stringify(item.irt_parameters),
            JSON.stringify(item.metadata || {})
          ];

          const result = await client.query(query, values);

          if (result.rowCount && result.rowCount > 0) {
            itemsImported++;
          } else if (skipDuplicates) {
            itemsSkipped++;
          }
        } catch (error) {
          const errorMessage = `Failed to import item ${item.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMessage);
          console.error(`[DataLoader] ${errorMessage}`);
          
          if (!skipDuplicates) {
            throw error; // Rollback transaction
          }
        }
      }

      await client.query('COMMIT');

      console.log(`[DataLoader] Import complete: ${itemsImported} imported, ${itemsSkipped} skipped, ${errors.length} errors`);

      return {
        success: true,
        itemsImported,
        itemsSkipped,
        errors
      };
    } catch (error) {
      await client.query('ROLLBACK');
      
      console.error('[DataLoader] Import failed, transaction rolled back:', error);
      
      return {
        success: false,
        itemsImported: 0,
        itemsSkipped: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    } finally {
      client.release();
    }
  }

  /**
   * Load items from CSV file and import to database
   * 
   * **Validates: Requirements 14.1, 14.6, 14.7, 14.8, 14.9**
   * Complete workflow: parse → validate → import
   * 
   * @param filePath - Absolute path to CSV file
   * @param options - Import options
   * @returns Import result
   */
  async loadFromCSV(
    filePath: string,
    options: { skipDuplicates?: boolean } = {}
  ): Promise<ImportResult> {
    try {
      console.log(`[DataLoader] Loading items from CSV: ${filePath}`);

      // Parse CSV
      const rawItems = this.parseCSV(filePath);

      // Validate items
      const validation = this.validateItems(rawItems);

      if (!validation.valid) {
        // Requirement 14.9: Reject entire batch if validation fails
        console.error('[DataLoader] Validation failed, rejecting batch');
        return {
          success: false,
          itemsImported: 0,
          itemsSkipped: 0,
          errors: validation.errors.flatMap(err => 
            err.errors.map(e => `Item ${err.itemId}: ${e}`)
          )
        };
      }

      // Import validated items
      return await this.importItems(validation.validItems, options);
    } catch (error) {
      console.error('[DataLoader] Failed to load from CSV:', error);
      return {
        success: false,
        itemsImported: 0,
        itemsSkipped: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Load items from JSON file and import to database
   * 
   * **Validates: Requirements 14.1, 14.6, 14.7, 14.8, 14.9**
   * Complete workflow: parse → validate → import
   * 
   * @param filePath - Absolute path to JSON file
   * @param options - Import options
   * @returns Import result
   */
  async loadFromJSON(
    filePath: string,
    options: { skipDuplicates?: boolean } = {}
  ): Promise<ImportResult> {
    try {
      console.log(`[DataLoader] Loading items from JSON: ${filePath}`);

      // Parse JSON
      const rawItems = this.parseJSON(filePath);

      // Validate items
      const validation = this.validateItems(rawItems);

      if (!validation.valid) {
        // Requirement 14.9: Reject entire batch if validation fails
        console.error('[DataLoader] Validation failed, rejecting batch');
        return {
          success: false,
          itemsImported: 0,
          itemsSkipped: 0,
          errors: validation.errors.flatMap(err => 
            err.errors.map(e => `Item ${err.itemId}: ${e}`)
          )
        };
      }

      // Import validated items
      return await this.importItems(validation.validItems, options);
    } catch (error) {
      console.error('[DataLoader] Failed to load from JSON:', error);
      return {
        success: false,
        itemsImported: 0,
        itemsSkipped: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Format items to standardized JSON structure (Pretty Printer)
   * 
   * **Validates: Requirements 15.1, 15.2, 15.3**
   * - 15.1: THE Data_Loader SHALL format test items into a standardized JSON structure
   * - 15.2: THE Data_Loader SHALL include item ID, type, content, options, 
   *         correct answer, IRT parameters, and metadata in the output
   * - 15.3: FOR ALL valid test item objects, parsing then printing then parsing 
   *         SHALL produce an equivalent object (round-trip property)
   * 
   * @param items - Items to format
   * @param prettyPrint - Whether to use pretty printing
   * @returns Formatted JSON string
   */
  formatItems(items: Item[], prettyPrint: boolean = true): string {
    const formatted = items.map(item => ({
      id: item.id,
      section: item.section,
      type: item.type,
      difficulty_level: item.difficulty_level,
      stage: item.metadata?.stage,
      content: item.content,
      options: item.options,
      correct_answer: item.correct_answer,
      irt_parameters: item.irt_parameters,
      metadata: item.metadata
    }));

    return JSON.stringify(formatted, null, prettyPrint ? 2 : 0);
  }

  /**
   * Parse formatted JSON back to items (for round-trip testing)
   * 
   * **Validates: Requirement 15.3**
   * Round-trip property test: parse → print → parse
   * 
   * @param jsonString - Formatted JSON string
   * @returns Array of items
   */
  parseFormattedJSON(jsonString: string): Item[] {
    try {
      const data = JSON.parse(jsonString);
      const items = Array.isArray(data) ? data : [data];
      
      return items.map(item => ({
        id: item.id,
        section: item.section as Section,
        type: item.type,
        difficulty_level: item.difficulty_level as DifficultyLevel | undefined,
        content: item.content,
        options: item.options,
        correct_answer: item.correct_answer,
        irt_parameters: item.irt_parameters as IRTParameters,
        metadata: item.metadata
      }));
    } catch (error) {
      throw new Error(`Failed to parse formatted JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load test items from array of JSON objects with validation and batch insertion
   * 
   * **Validates: Requirements 10.1, 10.2, 10.3**
   * - 10.1: Batch loading of test items
   * - 10.2: Item validation (IRT parameters, difficulty levels)
   * - 10.3: Efficient database insertion
   * 
   * @param items - Array of test item JSON objects
   * @param options - Import options (skipDuplicates, updateOnConflict)
   * @returns Summary with inserted count and failed items
   */
  async loadTestItems(
    items: RawItemData[],
    options: { 
      skipDuplicates?: boolean;
      updateOnConflict?: boolean;
    } = {}
  ): Promise<{
    inserted: number;
    failed: Array<{ item: RawItemData; error: string }>;
  }> {
    const { skipDuplicates = true, updateOnConflict = false } = options;

    console.log(`[DataLoader] Starting batch load of ${items.length} test items`);

    // Validate all items first
    const validationResult = this.validateItems(items);
    
    const failed: Array<{ item: RawItemData; error: string }> = [];

    // Collect validation errors
    for (const error of validationResult.errors) {
      const originalItem = items.find(item => item.id === error.itemId);
      if (originalItem) {
        failed.push({
          item: originalItem,
          error: error.errors.join('; ')
        });
      }
    }

    // If no valid items, return early
    if (validationResult.validItems.length === 0) {
      console.log(`[DataLoader] No valid items to insert. All ${items.length} items failed validation.`);
      return {
        inserted: 0,
        failed
      };
    }

    console.log(`[DataLoader] Validated: ${validationResult.validItems.length} valid, ${failed.length} invalid`);

    // Perform batch insertion using multi-row INSERT
    const client = await this.db.connect();
    let inserted = 0;

    try {
      await client.query('BEGIN');

      // Build multi-row INSERT query
      // PostgreSQL supports efficient multi-row inserts
      const validItems = validationResult.validItems;
      const batchSize = 100; // Process in batches of 100 items
      
      for (let i = 0; i < validItems.length; i += batchSize) {
        const batch = validItems.slice(i, i + batchSize);
        
        // Build VALUES clause for batch
        const values: any[] = [];
        const valuePlaceholders: string[] = [];
        let paramIndex = 1;

        for (const item of batch) {
          const placeholders: string[] = [];
          
          // Add values for this item
          placeholders.push(`$${paramIndex++}`); // item_id
          placeholders.push(`$${paramIndex++}`); // section
          placeholders.push(`$${paramIndex++}`); // type
          placeholders.push(`$${paramIndex++}`); // difficulty_level
          placeholders.push(`$${paramIndex++}`); // stage
          placeholders.push(`$${paramIndex++}`); // content
          placeholders.push(`$${paramIndex++}`); // options
          placeholders.push(`$${paramIndex++}`); // correct_answer
          placeholders.push(`$${paramIndex++}`); // irt_parameters
          placeholders.push(`$${paramIndex++}`); // metadata

          valuePlaceholders.push(`(${placeholders.join(', ')})`);

          values.push(
            item.id,
            item.section,
            item.type,
            item.difficulty_level || null,
            item.metadata?.stage || null,
            item.content,
            item.options ? JSON.stringify(item.options) : null,
            item.correct_answer,
            JSON.stringify(item.irt_parameters),
            JSON.stringify(item.metadata || {})
          );
        }

        // Build conflict resolution clause
        let conflictClause = '';
        if (skipDuplicates && !updateOnConflict) {
          conflictClause = 'ON CONFLICT (item_id) DO NOTHING';
        } else if (updateOnConflict) {
          conflictClause = `
            ON CONFLICT (item_id) DO UPDATE SET
              section = EXCLUDED.section,
              type = EXCLUDED.type,
              difficulty_level = EXCLUDED.difficulty_level,
              stage = EXCLUDED.stage,
              content = EXCLUDED.content,
              options = EXCLUDED.options,
              correct_answer = EXCLUDED.correct_answer,
              irt_parameters = EXCLUDED.irt_parameters,
              metadata = EXCLUDED.metadata,
              updated_at = NOW()
          `;
        }

        const query = `
          INSERT INTO test_items (
            item_id,
            section,
            type,
            difficulty_level,
            stage,
            content,
            options,
            correct_answer,
            irt_parameters,
            metadata
          ) VALUES ${valuePlaceholders.join(', ')}
          ${conflictClause}
          RETURNING item_id
        `;

        try {
          const result = await client.query(query, values);
          inserted += result.rowCount || 0;
          
          console.log(`[DataLoader] Batch ${Math.floor(i / batchSize) + 1}: Inserted ${result.rowCount} items`);
        } catch (error) {
          // If batch fails and we're not skipping duplicates, add all items in batch to failed
          if (!skipDuplicates) {
            for (const item of batch) {
              const originalItem = items.find(raw => raw.id === item.id);
              if (originalItem) {
                failed.push({
                  item: originalItem,
                  error: `Database insertion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                });
              }
            }
          } else {
            // If skipping duplicates, try to identify which items failed
            console.error(`[DataLoader] Batch insertion failed for batch ${Math.floor(i / batchSize) + 1}:`, error);
            
            // Try individual insertion for this batch to identify failures
            for (const item of batch) {
              try {
                const singleQuery = `
                  INSERT INTO test_items (
                    item_id, section, type, difficulty_level, stage,
                    content, options, correct_answer, irt_parameters, metadata
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                  ${conflictClause}
                  RETURNING item_id
                `;
                
                const singleValues = [
                  item.id,
                  item.section,
                  item.type,
                  item.difficulty_level || null,
                  item.metadata?.stage || null,
                  item.content,
                  item.options ? JSON.stringify(item.options) : null,
                  item.correct_answer,
                  JSON.stringify(item.irt_parameters),
                  JSON.stringify(item.metadata || {})
                ];
                
                const singleResult = await client.query(singleQuery, singleValues);
                if (singleResult.rowCount && singleResult.rowCount > 0) {
                  inserted++;
                }
              } catch (singleError) {
                const originalItem = items.find(raw => raw.id === item.id);
                if (originalItem) {
                  failed.push({
                    item: originalItem,
                    error: `Database insertion failed: ${singleError instanceof Error ? singleError.message : 'Unknown error'}`
                  });
                }
              }
            }
          }
        }
      }

      await client.query('COMMIT');
      
      console.log(`[DataLoader] Batch load complete: ${inserted} inserted, ${failed.length} failed`);

      return {
        inserted,
        failed
      };
    } catch (error) {
      await client.query('ROLLBACK');
      
      console.error('[DataLoader] Batch load failed, transaction rolled back:', error);
      
      // All items failed
      const allFailed = validationResult.validItems.map(item => {
        const originalItem = items.find(raw => raw.id === item.id);
        return {
          item: originalItem || { id: item.id } as RawItemData,
          error: `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      });
      
      return {
        inserted: 0,
        failed: [...failed, ...allFailed]
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get item count by section and difficulty
   * Utility method for reporting
   * 
   * @returns Item statistics
   */
  async getItemStatistics(): Promise<Record<string, any>> {
    try {
      const query = `
        SELECT 
          section,
          difficulty_level,
          stage,
          COUNT(*) as count
        FROM test_items
        GROUP BY section, difficulty_level, stage
        ORDER BY section, stage, difficulty_level
      `;

      const result = await this.db.query(query);

      return {
        items: result.rows,
        total: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0)
      };
    } catch (error) {
      console.error('[DataLoader] Failed to get statistics:', error);
      throw error;
    }
  }

  /**
   * Pretty print test items to console with human-readable formatting
   * 
   * **Validates: Requirement 10.4**
   * Human-readable test item display for debugging and data verification
   * 
   * Features:
   * - Shows item ID, type, section, difficulty, content preview
   * - Displays IRT parameters (a, b, c) in scientific notation
   * - Color-coded output using ANSI codes
   * - Truncates long content fields
   * - Supports both single item and array of items
   * 
   * @param itemOrItems - Single item or array of items to print
   * @param options - Formatting options
   */
  prettyPrint(
    itemOrItems: Item | Item[],
    options: {
      maxContentLength?: number;
      useColors?: boolean;
      scientificNotation?: boolean;
    } = {}
  ): void {
    const {
      maxContentLength = 100,
      useColors = true,
      scientificNotation = true
    } = options;

    // ANSI color codes
    const colors = useColors ? {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      cyan: '\x1b[36m',
      yellow: '\x1b[33m',
      green: '\x1b[32m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      red: '\x1b[31m',
      gray: '\x1b[90m'
    } : {
      reset: '',
      bright: '',
      dim: '',
      cyan: '',
      yellow: '',
      green: '',
      blue: '',
      magenta: '',
      red: '',
      gray: ''
    };

    // Convert to array for uniform processing
    const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];

    console.log(`\n${colors.bright}${colors.cyan}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}║${colors.reset}  ${colors.bright}TEST ITEMS REPORT${colors.reset}  ${colors.dim}(${items.length} item${items.length !== 1 ? 's' : ''})${colors.reset}                      ${colors.bright}${colors.cyan}║${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}╚═══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    items.forEach((item, index) => {
      // Header
      console.log(`${colors.bright}${colors.blue}┌─ Item ${index + 1}/${items.length} ────────────────────────────────────────────┐${colors.reset}`);
      
      // Item ID
      console.log(`${colors.blue}│${colors.reset} ${colors.bright}ID:${colors.reset}         ${colors.yellow}${item.id}${colors.reset}`);
      
      // Section
      const sectionColor = this.getSectionColor(item.section, colors);
      console.log(`${colors.blue}│${colors.reset} ${colors.bright}Section:${colors.reset}    ${sectionColor}${item.section.toUpperCase()}${colors.reset}`);
      
      // Type
      console.log(`${colors.blue}│${colors.reset} ${colors.bright}Type:${colors.reset}       ${colors.cyan}${item.type}${colors.reset}`);
      
      // Difficulty
      if (item.difficulty_level) {
        const difficultyColor = this.getDifficultyColor(item.difficulty_level, colors);
        console.log(`${colors.blue}│${colors.reset} ${colors.bright}Difficulty:${colors.reset} ${difficultyColor}${item.difficulty_level.toUpperCase()}${colors.reset}`);
      }
      
      // Stage
      if (item.metadata?.stage) {
        console.log(`${colors.blue}│${colors.reset} ${colors.bright}Stage:${colors.reset}      ${colors.magenta}${item.metadata.stage}${colors.reset}`);
      }
      
      // Content preview
      const contentPreview = this.truncateContent(item.content, maxContentLength);
      console.log(`${colors.blue}│${colors.reset} ${colors.bright}Content:${colors.reset}    ${colors.gray}${contentPreview}${colors.reset}`);
      
      // Options
      if (item.options && item.options.length > 0) {
        console.log(`${colors.blue}│${colors.reset} ${colors.bright}Options:${colors.reset}    ${colors.dim}${item.options.length} choices${colors.reset}`);
        item.options.forEach((option, optIndex) => {
          const optionPreview = this.truncateContent(option, maxContentLength - 10);
          const isCorrect = option === item.correct_answer;
          const marker = isCorrect ? `${colors.green}✓${colors.reset}` : `${colors.gray}○${colors.reset}`;
          console.log(`${colors.blue}│${colors.reset}   ${marker} ${colors.gray}${String.fromCharCode(65 + optIndex)}.${colors.reset} ${optionPreview}`);
        });
      }
      
      // Correct answer
      const correctAnswerPreview = this.truncateContent(item.correct_answer, maxContentLength);
      console.log(`${colors.blue}│${colors.reset} ${colors.bright}Answer:${colors.reset}     ${colors.green}${correctAnswerPreview}${colors.reset}`);
      
      // IRT Parameters
      console.log(`${colors.blue}│${colors.reset}`);
      console.log(`${colors.blue}│${colors.reset} ${colors.bright}${colors.magenta}IRT Parameters (3PL Model):${colors.reset}`);
      
      const { a, b, c } = item.irt_parameters;
      
      if (scientificNotation) {
        console.log(`${colors.blue}│${colors.reset}   ${colors.bright}a${colors.reset} (discrimination): ${colors.yellow}${a.toExponential(4)}${colors.reset} ${colors.dim}(${a.toFixed(4)})${colors.reset}`);
        console.log(`${colors.blue}│${colors.reset}   ${colors.bright}b${colors.reset} (difficulty):     ${colors.yellow}${b.toExponential(4)}${colors.reset} ${colors.dim}(${b.toFixed(4)})${colors.reset}`);
        console.log(`${colors.blue}│${colors.reset}   ${colors.bright}c${colors.reset} (guessing):       ${colors.yellow}${c.toExponential(4)}${colors.reset} ${colors.dim}(${c.toFixed(4)})${colors.reset}`);
      } else {
        console.log(`${colors.blue}│${colors.reset}   ${colors.bright}a${colors.reset} (discrimination): ${colors.yellow}${a.toFixed(4)}${colors.reset}`);
        console.log(`${colors.blue}│${colors.reset}   ${colors.bright}b${colors.reset} (difficulty):     ${colors.yellow}${b.toFixed(4)}${colors.reset}`);
        console.log(`${colors.blue}│${colors.reset}   ${colors.bright}c${colors.reset} (guessing):       ${colors.yellow}${c.toFixed(4)}${colors.reset}`);
      }
      
      // Metadata
      if (item.metadata && Object.keys(item.metadata).length > 0) {
        console.log(`${colors.blue}│${colors.reset}`);
        console.log(`${colors.blue}│${colors.reset} ${colors.bright}Metadata:${colors.reset}   ${colors.dim}${JSON.stringify(item.metadata)}${colors.reset}`);
      }
      
      // Footer
      console.log(`${colors.bright}${colors.blue}└───────────────────────────────────────────────────────────────┘${colors.reset}\n`);
    });
  }

  /**
   * Helper: Get color for section
   */
  private getSectionColor(section: Section, colors: Record<string, string>): string {
    const sectionColors: Record<Section, string> = {
      reading: colors.green,
      listening: colors.blue,
      writing: colors.yellow,
      speaking: colors.magenta
    };
    return sectionColors[section] || colors.reset;
  }

  /**
   * Helper: Get color for difficulty level
   */
  private getDifficultyColor(difficulty: DifficultyLevel, colors: Record<string, string>): string {
    const difficultyColors: Record<DifficultyLevel, string> = {
      easy: colors.green,
      medium: colors.yellow,
      hard: colors.red
    };
    return difficultyColors[difficulty] || colors.reset;
  }

  /**
   * Helper: Truncate content with ellipsis
   */
  private truncateContent(content: string, maxLength: number): string {
    if (!content) return '';
    
    // Replace newlines and multiple spaces with single space
    const normalized = content.replace(/\s+/g, ' ').trim();
    
    if (normalized.length <= maxLength) {
      return normalized;
    }
    
    return normalized.substring(0, maxLength - 3) + '...';
  }
}
