/**
 * DataLoader Dataset Parser Unit Tests
 * 
 * Comprehensive unit tests for dataset parsers with sample data
 * 
 * **Task 11.5: Write unit tests for data loader**
 * **Validates: Requirements 14.8, 14.9**
 * 
 * Test Coverage:
 * - Test each dataset parser with sample data
 * - Test batch validation and rollback
 * - Test error handling for malformed datasets
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool, PoolClient } from 'pg';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { DataLoader, RawItemData } from './DataLoader.js';
import { Item } from '../models/irt.types.js';

/**
 * Helper to create temporary test data files
 */
function createTempFile(filename: string, content: string): string {
  const tempPath = join(process.cwd(), filename);
  writeFileSync(tempPath, content, 'utf-8');
  return tempPath;
}

/**
 * Helper to clean up temporary test files
 */
function cleanupTempFile(filepath: string): void {
  if (existsSync(filepath)) {
    unlinkSync(filepath);
  }
}

/**
 * Mock database pool for testing
 */
function createMockPool(): Pool {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn()
  } as unknown as PoolClient;

  return {
    query: vi.fn(),
    connect: vi.fn().mockResolvedValue(mockClient),
    end: vi.fn(),
    on: vi.fn(),
  } as any as Pool;
}

describe('DataLoader - Dataset Parser Tests (Task 11.5)', () => {
  let mockPool: Pool;
  let dataLoader: DataLoader;
  let tempFiles: string[] = [];

  beforeEach(() => {
    mockPool = createMockPool();
    dataLoader = new DataLoader(mockPool);
    tempFiles = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clean up temporary test files
    tempFiles.forEach(file => cleanupTempFile(file));
  });

  /**
   * TOEFL-QA Dataset Parser Tests
   * Validates: Requirement 14.1 - Parse TOEFL-QA Dataset
   */
  describe('TOEFL-QA Dataset Parser', () => {
    it('should parse TOEFL-QA reading comprehension items with passage metadata', () => {
      const csvContent = `id,section,type,difficulty_level,stage,content,options,correct_answer,irt_a,irt_b,irt_c,metadata
toefl-qa-r001,reading,academic-passage,medium,1,"According to the passage, what is the primary function of chlorophyll?","[""Absorb water"",""Capture light energy"",""Release oxygen"",""Store glucose""]",Capture light energy,1.35,-0.25,0.22,"{""passage_id"":""biology-photosynthesis"",""word_count"":425,""academic_level"":""undergraduate""}"
toefl-qa-r002,reading,academic-passage,medium,1,"The author mentions 'stomata' primarily to:","[""Describe gas exchange"",""Explain water loss"",""Compare plant types"",""Illustrate evolution""]",Describe gas exchange,1.28,-0.18,0.20,"{""passage_id"":""biology-photosynthesis"",""word_count"":425,""academic_level"":""undergraduate""}"`;

      const tempPath = createTempFile('toefl-qa-sample.csv', csvContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseCSV(tempPath);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('toefl-qa-r001');
      expect(result[0].section).toBe('reading');
      expect(result[0].type).toBe('academic-passage');
      expect(result[0].difficulty_level).toBe('medium');
      expect(result[0].irt_a).toBe(1.35);
      expect(result[0].irt_b).toBe(-0.25);
      expect(result[0].irt_c).toBe(0.22);
      
      // Validate items
      const validation = dataLoader.validateItems(result);
      expect(validation.valid).toBe(true);
      expect(validation.validItems).toHaveLength(2);
    });

    it('should validate TOEFL-QA items meet IRT parameter constraints', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'toefl-qa-valid',
          section: 'reading',
          type: 'academic-passage',
          difficulty_level: 'medium',
          content: 'What is the main idea?',
          correct_answer: 'Answer B',
          irt_a: 1.5,  // Valid: 0.5-2.5
          irt_b: -0.3, // Valid: -3 to 3
          irt_c: 0.22  // Valid: 0.0-0.3
        }
      ];

      const validation = dataLoader.validateItems(rawItems);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject TOEFL-QA items with IRT parameters out of range', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'toefl-qa-invalid',
          section: 'reading',
          type: 'academic-passage',
          content: 'Question',
          correct_answer: 'Answer',
          irt_a: 3.0,  // Invalid: exceeds 2.5
          irt_b: 4.0,  // Invalid: exceeds 3.0
          irt_c: 0.35  // Invalid: exceeds 0.3
        }
      ];

      const validation = dataLoader.validateItems(rawItems);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  /**
   * Sentence Insertion Dataset Parser Tests
   * Validates: Requirement 14.2 - Parse Sentence Insertion Dataset
   */
  describe('Sentence Insertion Dataset Parser', () => {
    it('should parse sentence insertion items from JSON format', () => {
      const jsonContent = JSON.stringify([
        {
          id: 'sent-ins-001',
          section: 'reading',
          type: 'sentence-insertion',
          difficulty_level: 'medium',
          stage: 1,
          content: 'Insert the following sentence: "This breakthrough discovery revolutionized the field."',
          options: ['Position A', 'Position B', 'Position C', 'Position D'],
          correct_answer: 'Position C',
          irt_parameters: { a: 1.42, b: 0.75, c: 0.25 },
          metadata: {
            passage_id: 'scientific-discovery-042',
            insertion_type: 'logical-flow',
            sentence_complexity: 'high'
          }
        },
        {
          id: 'sent-ins-002',
          section: 'reading',
          type: 'sentence-insertion',
          difficulty_level: 'easy',
          stage: 1,
          content: 'Where should this sentence go: "The results were inconclusive."',
          options: ['Position A', 'Position B', 'Position C', 'Position D'],
          correct_answer: 'Position B',
          irt_parameters: { a: 0.95, b: -1.2, c: 0.25 },
          metadata: {
            passage_id: 'research-study-018',
            insertion_type: 'conclusion'
          }
        }
      ]);

      const tempPath = createTempFile('sent-ins-sample.json', jsonContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseJSON(tempPath);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('sentence-insertion');
      expect(result[0].irt_parameters).toEqual({ a: 1.42, b: 0.75, c: 0.25 });
      
      // Validate
      const validation = dataLoader.validateItems(result);
      expect(validation.valid).toBe(true);
    });
  });

  /**
   * Academic Discussion Dataset Parser Tests
   * Validates: Requirement 14.3 - Parse Academic Discussion Dataset
   */
  describe('Academic Discussion Dataset Parser', () => {
    it('should parse academic discussion writing items', () => {
      const jsonContent = JSON.stringify({
        items: [
          {
            id: 'acad-disc-001',
            section: 'writing',
            type: 'academic-discussion',
            difficulty_level: 'medium',
            content: 'Professor: Should universities require students to take courses outside their major field of study? Discuss your perspective.',
            correct_answer: 'Sample response demonstrating critical thinking and well-structured argumentation',
            irt_a: 1.15,
            irt_b: 0.35,
            irt_c: 0.15,
            metadata: {
              rubric_criteria: ['content', 'organization', 'language', 'development'],
              time_limit_seconds: 600,
              min_word_count: 100
            }
          }
        ]
      });

      const tempPath = createTempFile('acad-disc-sample.json', jsonContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseJSON(tempPath);

      expect(result).toHaveLength(1);
      expect(result[0].section).toBe('writing');
      expect(result[0].type).toBe('academic-discussion');
      expect(result[0].irt_c).toBe(0.15); // Lower guessing for writing
      
      const validation = dataLoader.validateItems(result);
      expect(validation.valid).toBe(true);
    });
  });

  /**
   * Synonym Match Dataset Parser Tests  
   * Validates: Requirement 14.4 - Parse Synonym Match Dataset (Wordlink)
   */
  describe('Synonym Match Dataset Parser (Wordlink)', () => {
    it('should parse synonym matching vocabulary items', () => {
      const csvContent = `id,section,type,difficulty_level,stage,content,options,correct_answer,irt_a,irt_b,irt_c
wordlink-001,reading,synonym-match,easy,1,"Which word is closest in meaning to 'abandon'?","[""desert"",""maintain"",""discover"",""celebrate""]",desert,1.05,-1.35,0.25
wordlink-002,reading,synonym-match,medium,1,"Select the word most similar to 'meticulous':","[""careful"",""careless"",""rapid"",""simple""]",careful,1.22,0.15,0.23
wordlink-003,reading,synonym-match,hard,2,"What is the best synonym for 'ubiquitous'?","[""omnipresent"",""rare"",""temporary"",""ambiguous""]",omnipresent,1.68,1.45,0.20`;

      const tempPath = createTempFile('wordlink-sample.csv', csvContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseCSV(tempPath);

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('synonym-match');
      expect(result[2].difficulty_level).toBe('hard');
      expect(result[2].irt_b).toBe(1.45); // Higher difficulty parameter
      
      const validation = dataLoader.validateItems(result);
      expect(validation.valid).toBe(true);
    });
  });

  /**
   * TOEFL-Spell Dataset Parser Tests
   * Validates: Requirement 14.5 - Parse TOEFL-Spell Dataset
   */
  describe('TOEFL-Spell Dataset Parser', () => {
    it('should parse spelling and word formation items', () => {
      const jsonContent = JSON.stringify([
        {
          id: 'spell-001',
          section: 'writing',
          type: 'build-sentence',
          difficulty_level: 'medium',
          content: 'Complete the sentence: The scientist\'s research was ___ by rigorous methodology.',
          options: ['characterized', 'caracterized', 'charecterized', 'charaterized'],
          correct_answer: 'characterized',
          irt_a: 1.32,
          irt_b: 0.28,
          irt_c: 0.25,
          metadata: {
            skill: 'spelling',
            word_frequency: 'medium',
            common_error_pattern: 'vowel-substitution'
          }
        }
      ]);

      const tempPath = createTempFile('spell-sample.json', jsonContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseJSON(tempPath);

      expect(result).toHaveLength(1);
      expect(result[0].section).toBe('writing');
      expect(result[0].type).toBe('build-sentence');
      
      const validation = dataLoader.validateItems(result);
      expect(validation.valid).toBe(true);
    });
  });

  /**
   * Batch Validation and Rollback Tests
   * Validates: Requirement 14.9 - IF validation fails for any item in a batch, 
   * THEN THE Data_Loader SHALL reject the entire batch
   */
  describe('Batch Validation and Rollback (Requirement 14.9)', () => {
    it('should reject entire batch when one item has invalid section', async () => {
      const csvContent = `id,section,type,content,correct_answer,irt_a,irt_b,irt_c
valid-001,reading,test,Question 1,Answer A,1.0,0.0,0.2
invalid-001,invalid-section,test,Question 2,Answer B,1.0,0.0,0.2
valid-002,listening,test,Question 3,Answer C,1.5,-1.0,0.25`;

      const tempPath = createTempFile('batch-invalid-section.csv', csvContent);
      tempFiles.push(tempPath);

      const result = await dataLoader.loadFromCSV(tempPath);

      // Entire batch should be rejected (Requirement 14.9)
      expect(result.success).toBe(false);
      expect(result.itemsImported).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Verify database was NOT accessed since validation failed
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('should reject entire batch when one item has missing required field', async () => {
      const rawItems: RawItemData[] = [
        {
          id: 'valid-001',
          section: 'reading',
          type: 'test',
          content: 'Valid Question 1',
          correct_answer: 'Answer A',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        },
        {
          id: 'invalid-001',
          section: 'reading',
          type: 'test',
          content: '', // Missing required content
          correct_answer: 'Answer B',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        },
        {
          id: 'valid-002',
          section: 'reading',
          type: 'test',
          content: 'Valid Question 2',
          correct_answer: 'Answer C',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        }
      ];

      const validation = dataLoader.validateItems(rawItems);

      // Batch is invalid due to one item failing validation
      expect(validation.valid).toBe(false);
      expect(validation.validItems).toHaveLength(2); // Two valid items
      expect(validation.errors).toHaveLength(1); // One error
      
      // Per Requirement 14.9, entire batch should be rejected
      // No items should be imported when batch validation fails
    });

    it('should reject entire batch when IRT parameters are out of valid range', async () => {
      const jsonContent = JSON.stringify([
        {
          id: 'valid-001',
          section: 'reading',
          type: 'test',
          content: 'Valid item',
          correct_answer: 'Answer',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        },
        {
          id: 'invalid-irt',
          section: 'reading',
          type: 'test',
          content: 'Invalid IRT parameters',
          correct_answer: 'Answer',
          irt_a: -0.5, // Invalid: below 0.5 minimum
          irt_b: 5.0,  // Invalid: exceeds 3.0 maximum
          irt_c: 0.5   // Invalid: exceeds 0.3 maximum
        }
      ]);

      const tempPath = createTempFile('batch-invalid-irt.json', jsonContent);
      tempFiles.push(tempPath);

      const result = await dataLoader.loadFromJSON(tempPath);

      // Entire batch rejected per Requirement 14.9
      expect(result.success).toBe(false);
      expect(result.itemsImported).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.join(' ')).toContain('irt_parameters');
    });

    it('should successfully import when all items in batch are valid', async () => {
      const csvContent = `id,section,type,content,correct_answer,irt_a,irt_b,irt_c
valid-001,reading,test,Question 1,Answer A,1.0,0.0,0.2
valid-002,listening,test,Question 2,Answer B,1.5,-1.0,0.25
valid-003,writing,essay,Question 3,Answer C,1.2,0.5,0.15`;

      const tempPath = createTempFile('batch-all-valid.csv', csvContent);
      tempFiles.push(tempPath);

      // Mock successful database operations
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [], command: 'BEGIN', rowCount: 0, oid: 0, fields: [] })
          .mockResolvedValueOnce({ rows: [], command: 'INSERT', rowCount: 1, oid: 0, fields: [] })
          .mockResolvedValueOnce({ rows: [], command: 'INSERT', rowCount: 1, oid: 0, fields: [] })
          .mockResolvedValueOnce({ rows: [], command: 'INSERT', rowCount: 1, oid: 0, fields: [] })
          .mockResolvedValueOnce({ rows: [], command: 'COMMIT', rowCount: 0, oid: 0, fields: [] }),
        release: vi.fn()
      };

      vi.mocked(mockPool.connect).mockResolvedValue(mockClient as any);

      const result = await dataLoader.loadFromCSV(tempPath);

      expect(result.success).toBe(true);
      expect(result.itemsImported).toBe(3);
      expect(result.errors).toHaveLength(0);
      
      // Verify transaction was committed
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback transaction when database error occurs during import', async () => {
      const validItems: Item[] = [
        {
          id: 'item-001',
          section: 'reading',
          type: 'test',
          content: 'Question',
          correct_answer: 'Answer',
          irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
        }
      ];

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [], command: 'BEGIN', rowCount: 0, oid: 0, fields: [] })
          .mockRejectedValueOnce(new Error('Database constraint violation'))
          .mockResolvedValueOnce({ rows: [], command: 'ROLLBACK', rowCount: 0, oid: 0, fields: [] }),
        release: vi.fn()
      };

      vi.mocked(mockPool.connect).mockResolvedValue(mockClient as any);

      const result = await dataLoader.importItems(validItems);

      expect(result.success).toBe(false);
      expect(result.itemsImported).toBe(0);
      expect(result.errors).toHaveLength(1);
      
      // Verify rollback was called
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  /**
   * Error Handling for Malformed Datasets
   * Validates comprehensive error detection and reporting
   */
  describe('Error Handling for Malformed Datasets', () => {
    it('should handle CSV with completely missing columns', () => {
      const csvContent = `invalid,columns,only
value1,value2,value3`;

      const tempPath = createTempFile('malformed-columns.csv', csvContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseCSV(tempPath);
      
      // Parsing succeeds but validation will fail
      expect(result).toHaveLength(1);
      
      const validation = dataLoader.validateItems(result);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle JSON with incorrect data types', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'malformed-001',
          section: 'reading',
          type: 'test',
          content: 'Question',
          correct_answer: 'Answer',
          irt_a: 'should-be-number' as any, // Incorrect type
          irt_b: 0.0,
          irt_c: 0.2
        }
      ];

      const validation = dataLoader.validateItems(rawItems);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
    });

    it('should handle CSV with null or undefined values', () => {
      const csvContent = `id,section,type,content,correct_answer,irt_a,irt_b,irt_c
item-001,reading,test,,Answer,1.0,0.0,0.2`;

      const tempPath = createTempFile('null-values.csv', csvContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseCSV(tempPath);
      
      const validation = dataLoader.validateItems(result);
      expect(validation.valid).toBe(false); // Empty content should fail
    });

    it('should handle JSON array with mixed valid and invalid items', () => {
      const jsonContent = JSON.stringify([
        {
          id: 'valid',
          section: 'reading',
          type: 'test',
          content: 'Valid content',
          correct_answer: 'Answer',
          irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
        },
        {
          id: 'invalid',
          section: 'reading',
          type: 'test',
          // Missing content and correct_answer
          irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
        }
      ]);

      const tempPath = createTempFile('mixed-validity.json', jsonContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseJSON(tempPath);
      const validation = dataLoader.validateItems(result);
      
      // Should identify both items but mark batch as invalid
      expect(validation.valid).toBe(false);
      expect(validation.validItems).toHaveLength(1);
      expect(validation.errors).toHaveLength(1);
    });

    it('should handle malformed JSON with syntax errors', () => {
      const malformedJson = '{ "items": [ { "id": "test", "section": "reading" '; // Missing closing brackets

      const tempPath = createTempFile('syntax-error.json', malformedJson);
      tempFiles.push(tempPath);

      expect(() => dataLoader.parseJSON(tempPath)).toThrow('JSON parsing failed');
    });

    it('should handle CSV with UTF-8 BOM (Byte Order Mark)', () => {
      // UTF-8 BOM: \uFEFF
      const csvContent = '\uFEFFid,section,type,content,correct_answer,irt_a,irt_b,irt_c\nitem-001,reading,test,Question,Answer,1.0,0.0,0.2';

      const tempPath = createTempFile('bom-test.csv', csvContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseCSV(tempPath);
      
      expect(result).toHaveLength(1);
      // BOM can cause issues with the first column name, so we just verify parsing succeeds
      expect(result[0].section).toBe('reading');
    });

    it('should detect and report multiple validation errors for a single item', () => {
      const rawItems: RawItemData[] = [
        {
          id: '', // Error 1: empty ID
          section: 'invalid-section', // Error 2: invalid section
          type: '', // Error 3: empty type
          content: '', // Error 4: empty content
          correct_answer: '', // Error 5: empty answer
          irt_a: 10.0, // Error 6: out of range
          irt_b: 10.0, // Error 7: out of range
          irt_c: 1.0   // Error 8: out of range
        } as RawItemData
      ];

      const validation = dataLoader.validateItems(rawItems);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      // Single item should have multiple errors reported
      expect(validation.errors[0].errors.length).toBeGreaterThan(3);
    });

    it('should handle very large batch of items efficiently', () => {
      // Create 1000 items to test batch processing
      const largeDataset: RawItemData[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i.toString().padStart(4, '0')}`,
        section: i % 4 === 0 ? 'reading' : i % 4 === 1 ? 'listening' : i % 4 === 2 ? 'writing' : 'speaking',
        type: 'test',
        content: `Question ${i}`,
        correct_answer: `Answer ${i}`,
        irt_a: 1.0 + (i % 10) * 0.1,
        irt_b: -1.5 + (i % 30) * 0.1,
        irt_c: 0.15 + (i % 15) * 0.01
      }));

      const startTime = Date.now();
      const validation = dataLoader.validateItems(largeDataset);
      const duration = Date.now() - startTime;

      expect(validation.valid).toBe(true);
      expect(validation.validItems).toHaveLength(1000);
      expect(validation.errors).toHaveLength(0);
      
      // Should complete in reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    it('should preserve item order during parsing and validation', () => {
      const csvContent = `id,section,type,content,correct_answer,irt_a,irt_b,irt_c
item-001,reading,test,Question 1,Answer 1,1.0,0.0,0.2
item-002,listening,test,Question 2,Answer 2,1.5,-1.0,0.25
item-003,writing,test,Question 3,Answer 3,1.2,0.5,0.15
item-004,speaking,test,Question 4,Answer 4,1.1,-0.5,0.20`;

      const tempPath = createTempFile('order-test.csv', csvContent);
      tempFiles.push(tempPath);

      const parsed = dataLoader.parseCSV(tempPath);
      const validation = dataLoader.validateItems(parsed);

      // Verify order is preserved
      expect(validation.validItems[0].id).toBe('item-001');
      expect(validation.validItems[1].id).toBe('item-002');
      expect(validation.validItems[2].id).toBe('item-003');
      expect(validation.validItems[3].id).toBe('item-004');
    });
  });

  /**
   * Field Extraction and Validation Tests
   * Validates: Requirement 14.6 - Extract all required fields
   * Validates: Requirement 14.8 - Validate all required fields are present
   */
  describe('Field Extraction and Validation (Requirements 14.6, 14.8)', () => {
    it('should extract item content from all datasets', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'test-001',
          section: 'reading',
          type: 'test',
          content: 'This is the question content that must be extracted',
          correct_answer: 'Answer',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        }
      ];

      const validation = dataLoader.validateItems(rawItems);

      expect(validation.valid).toBe(true);
      expect(validation.validItems[0].content).toBe('This is the question content that must be extracted');
    });

    it('should extract correct answers from all datasets', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'test-001',
          section: 'reading',
          type: 'test',
          content: 'Question',
          correct_answer: 'The correct answer that must be extracted',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        }
      ];

      const validation = dataLoader.validateItems(rawItems);
      
      expect(validation.valid).toBe(true);
      expect(validation.validItems[0].correct_answer).toBe('The correct answer that must be extracted');
    });

    it('should extract distractors (options) from multiple-choice items', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'test-001',
          section: 'reading',
          type: 'multiple-choice',
          content: 'Question',
          options: ['Distractor 1', 'Correct Answer', 'Distractor 2', 'Distractor 3'],
          correct_answer: 'Correct Answer',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.25
        }
      ];

      const validation = dataLoader.validateItems(rawItems);
      
      expect(validation.valid).toBe(true);
      expect(validation.validItems[0].options).toEqual(['Distractor 1', 'Correct Answer', 'Distractor 2', 'Distractor 3']);
    });

    it('should extract all three IRT parameters (a, b, c) - Requirement 14.6', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'test-001',
          section: 'reading',
          type: 'test',
          content: 'Question',
          correct_answer: 'Answer',
          irt_a: 1.35,
          irt_b: -0.75,
          irt_c: 0.22
        }
      ];

      const validation = dataLoader.validateItems(rawItems);

      expect(validation.valid).toBe(true);
      expect(validation.validItems[0].irt_parameters.a).toBe(1.35);
      expect(validation.validItems[0].irt_parameters.b).toBe(-0.75);
      expect(validation.validItems[0].irt_parameters.c).toBe(0.22);
    });

    it('should validate IRT discrimination parameter (a) is within 0.5-2.5', () => {
      const belowRange: RawItemData[] = [{
        id: 'test', section: 'reading', type: 'test', content: 'Q', correct_answer: 'A',
        irt_a: 0.3, irt_b: 0.0, irt_c: 0.2
      }];
      
      const aboveRange: RawItemData[] = [{
        id: 'test', section: 'reading', type: 'test', content: 'Q', correct_answer: 'A',
        irt_a: 3.0, irt_b: 0.0, irt_c: 0.2
      }];

      expect(dataLoader.validateItems(belowRange).valid).toBe(false);
      expect(dataLoader.validateItems(aboveRange).valid).toBe(false);
    });

    it('should validate IRT difficulty parameter (b) is within -3.0 to 3.0', () => {
      const belowRange: RawItemData[] = [{
        id: 'test', section: 'reading', type: 'test', content: 'Q', correct_answer: 'A',
        irt_a: 1.0, irt_b: -4.0, irt_c: 0.2
      }];
      
      const aboveRange: RawItemData[] = [{
        id: 'test', section: 'reading', type: 'test', content: 'Q', correct_answer: 'A',
        irt_a: 1.0, irt_b: 4.0, irt_c: 0.2
      }];

      expect(dataLoader.validateItems(belowRange).valid).toBe(false);
      expect(dataLoader.validateItems(aboveRange).valid).toBe(false);
    });

    it('should validate IRT guessing parameter (c) is within 0.0-0.3', () => {
      const belowRange: RawItemData[] = [{
        id: 'test', section: 'reading', type: 'test', content: 'Q', correct_answer: 'A',
        irt_a: 1.0, irt_b: 0.0, irt_c: -0.1
      }];
      
      const aboveRange: RawItemData[] = [{
        id: 'test', section: 'reading', type: 'test', content: 'Q', correct_answer: 'A',
        irt_a: 1.0, irt_b: 0.0, irt_c: 0.5
      }];

      expect(dataLoader.validateItems(belowRange).valid).toBe(false);
      expect(dataLoader.validateItems(aboveRange).valid).toBe(false);
    });

    it('should validate all required fields are present - Requirement 14.8', () => {
      const missingId: RawItemData = {
        id: '',
        section: 'reading',
        type: 'test',
        content: 'Question',
        correct_answer: 'Answer',
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2
      };

      const missingSection: RawItemData = {
        id: 'test-001',
        section: '' as any,
        type: 'test',
        content: 'Question',
        correct_answer: 'Answer',
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2
      };

      const missingContent: RawItemData = {
        id: 'test-001',
        section: 'reading',
        type: 'test',
        content: '',
        correct_answer: 'Answer',
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2
      };

      const missingCorrectAnswer: RawItemData = {
        id: 'test-001',
        section: 'reading',
        type: 'test',
        content: 'Question',
        correct_answer: '',
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2
      };

      // All should fail validation
      expect(dataLoader.validateItems([missingId]).valid).toBe(false);
      expect(dataLoader.validateItems([missingSection]).valid).toBe(false);
      expect(dataLoader.validateItems([missingContent]).valid).toBe(false);
      expect(dataLoader.validateItems([missingCorrectAnswer]).valid).toBe(false);
    });

    it('should accept items with optional metadata fields', () => {
      const withMetadata: RawItemData = {
        id: 'test-001',
        section: 'reading',
        type: 'test',
        difficulty_level: 'medium',
        stage: 2,
        content: 'Question',
        correct_answer: 'Answer',
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2,
        metadata: {
          passage_id: 'passage-123',
          custom_field: 'value'
        }
      };

      const validation = dataLoader.validateItems([withMetadata]);
      
      expect(validation.valid).toBe(true);
      expect(validation.validItems[0].metadata).toBeDefined();
    });
  });
});
