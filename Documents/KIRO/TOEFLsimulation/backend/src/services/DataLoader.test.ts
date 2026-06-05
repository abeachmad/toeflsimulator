/**
 * DataLoader Unit Tests
 * 
 * Comprehensive unit tests for DataLoader class
 * 
 * **Validates: Requirements 14.8, 14.9**
 * 
 * Task 11.5: Write unit tests for data loader
 * - Test each dataset parser with sample data
 * - Test batch validation and rollback
 * - Test error handling for malformed datasets
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Pool, PoolClient } from 'pg';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { DataLoader, RawItemData, ValidationResult, ImportResult } from './DataLoader.js';
import { Item } from '../models/irt.types.js';

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

describe('DataLoader - Unit Tests', () => {
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
   * CSV Parser Tests
   * Validates: Requirement 14.1, 14.6
   */
  describe('parseCSV - CSV Dataset Parser', () => {
    it('should parse valid CSV file with all required fields', () => {
      const csvContent = `id,section,type,difficulty_level,stage,content,options,correct_answer,irt_a,irt_b,irt_c,metadata
item-001,reading,multiple-choice,medium,1,"What is the main idea?","[""Option A"",""Option B"",""Option C"",""Option D""]",Option B,1.2,-0.5,0.2,"{""passage_id"":""passage-001""}"`;

      const tempPath = createTempFile('test-valid.csv', csvContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseCSV(tempPath);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item-001');
      expect(result[0].section).toBe('reading');
      expect(result[0].type).toBe('multiple-choice');
      expect(result[0].difficulty_level).toBe('medium');
      expect(result[0].stage).toBe(1);
      expect(result[0].content).toBe('What is the main idea?');
      expect(result[0].correct_answer).toBe('Option B');
      expect(result[0].irt_a).toBe(1.2);
      expect(result[0].irt_b).toBe(-0.5);
      expect(result[0].irt_c).toBe(0.2);
    });

    it('should parse CSV with multiple items', () => {
      const csvContent = `id,section,type,content,correct_answer,irt_a,irt_b,irt_c
item-001,reading,multiple-choice,"Question 1",Answer A,1.0,0.0,0.2
item-002,listening,audio-response,"Question 2",Answer B,1.5,-1.0,0.25
item-003,writing,essay,"Question 3",Answer C,1.2,0.5,0.15`;

      const tempPath = createTempFile('test-multiple.csv', csvContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseCSV(tempPath);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('item-001');
      expect(result[1].id).toBe('item-002');
      expect(result[2].id).toBe('item-003');
    });

    it('should parse CSV with pipe-delimited options', () => {
      const csvContent = `id,section,type,content,options,correct_answer,irt_a,irt_b,irt_c
item-001,reading,multiple-choice,"Question",Option A|Option B|Option C,Option B,1.0,0.0,0.2`;

      const tempPath = createTempFile('test-pipe-options.csv', csvContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseCSV(tempPath);

      expect(result).toHaveLength(1);
      expect(result[0].options).toBe('Option A|Option B|Option C');
    });

    it('should throw error for non-existent CSV file', () => {
      expect(() => dataLoader.parseCSV('/non/existent/file.csv'))
        .toThrow('CSV parsing failed');
    });

    it('should throw error for malformed CSV', () => {
      const malformedCsv = `id,section,type
item-001,reading
item-002,listening,audio,extra-field`;

      const tempPath = createTempFile('test-malformed.csv', malformedCsv);
      tempFiles.push(tempPath);

      expect(() => dataLoader.parseCSV(tempPath))
        .toThrow('CSV parsing failed');
    });

    it('should handle CSV with special characters in content', () => {
      const csvContent = `id,section,type,content,correct_answer,irt_a,irt_b,irt_c
item-001,reading,test,"Question with ""quotes"" and commas, semicolons;",Answer,1.0,0.0,0.2`;

      const tempPath = createTempFile('test-special-chars.csv', csvContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseCSV(tempPath);

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('quotes');
      expect(result[0].content).toContain(',');
    });

    it('should handle empty lines in CSV', () => {
      const csvContent = `id,section,type,content,correct_answer,irt_a,irt_b,irt_c

item-001,reading,test,Question 1,Answer 1,1.0,0.0,0.2

item-002,reading,test,Question 2,Answer 2,1.0,0.0,0.2`;

      const tempPath = createTempFile('test-empty-lines.csv', csvContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseCSV(tempPath);

      expect(result).toHaveLength(2);
    });
  });

  /**
   * JSON Parser Tests
   * Validates: Requirement 14.1, 14.6
   */
  describe('parseJSON - JSON Dataset Parser', () => {
    it('should parse valid JSON array format', () => {
      const jsonContent = JSON.stringify([
        {
          id: 'item-001',
          section: 'reading',
          type: 'multiple-choice',
          content: 'Question 1',
          correct_answer: 'Answer A',
          irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
        }
      ]);

      const tempPath = createTempFile('test-valid.json', jsonContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseJSON(tempPath);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item-001');
      expect(result[0].section).toBe('reading');
    });

    it('should parse JSON object with items property', () => {
      const jsonContent = JSON.stringify({
        items: [
          {
            id: 'item-001',
            section: 'listening',
            type: 'audio',
            content: 'Listen',
            correct_answer: 'A',
            irt_a: 1.5,
            irt_b: -0.5,
            irt_c: 0.25
          }
        ]
      });

      const tempPath = createTempFile('test-object.json', jsonContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseJSON(tempPath);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item-001');
    });

    it('should parse JSON with nested IRT parameters object', () => {
      const jsonContent = JSON.stringify([
        {
          id: 'item-001',
          section: 'writing',
          type: 'essay',
          content: 'Write an essay',
          correct_answer: 'Sample',
          irt_parameters: { a: 1.2, b: 0.5, c: 0.15 }
        }
      ]);

      const tempPath = createTempFile('test-nested-irt.json', jsonContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseJSON(tempPath);

      expect(result).toHaveLength(1);
      expect(result[0].irt_parameters).toEqual({ a: 1.2, b: 0.5, c: 0.15 });
    });

    it('should throw error for non-existent JSON file', () => {
      expect(() => dataLoader.parseJSON('/non/existent/file.json'))
        .toThrow('JSON parsing failed');
    });

    it('should throw error for malformed JSON', () => {
      const malformedJson = '{ "items": [ { "id": "test", missing bracket';

      const tempPath = createTempFile('test-malformed.json', malformedJson);
      tempFiles.push(tempPath);

      expect(() => dataLoader.parseJSON(tempPath))
        .toThrow('JSON parsing failed');
    });
  });

  /**
   * Validation Tests
   * Validates: Requirement 14.8
   * WHEN parsing completes, THE Data_Loader SHALL validate that all 
   * required fields are present for each item
   */
  describe('validateItems - Item Validation', () => {
    it('should validate item with all required fields', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'item-001',
          section: 'reading',
          type: 'multiple-choice',
          content: 'Question text',
          correct_answer: 'Answer',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        }
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(true);
      expect(result.validItems).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject item with missing ID', () => {
      const rawItems: RawItemData[] = [
        {
          id: '',
          section: 'reading',
          type: 'test',
          content: 'Question',
          correct_answer: 'Answer',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        } as RawItemData
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].errors.some(e => e.includes('id'))).toBe(true);
    });

    it('should reject item with invalid section', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'item-001',
          section: 'invalid-section',
          type: 'test',
          content: 'Question',
          correct_answer: 'Answer',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        } as RawItemData
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].errors.some(e => e.includes('section'))).toBe(true);
    });

    it('should reject item with missing content', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'item-001',
          section: 'reading',
          type: 'test',
          content: '',
          correct_answer: 'Answer',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        } as RawItemData
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should reject item with invalid IRT discrimination parameter (a)', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'item-001',
          section: 'reading',
          type: 'test',
          content: 'Question',
          correct_answer: 'Answer',
          irt_a: 5.0, // Invalid: must be 0.5-2.5
          irt_b: 0.0,
          irt_c: 0.2
        }
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].errors.some(e => e.includes('irt_parameters.a'))).toBe(true);
    });

    it('should reject item with invalid IRT difficulty parameter (b)', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'item-001',
          section: 'reading',
          type: 'test',
          content: 'Question',
          correct_answer: 'Answer',
          irt_a: 1.0,
          irt_b: 5.0, // Invalid: must be -3 to 3
          irt_c: 0.2
        }
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].errors.some(e => e.includes('irt_parameters.b'))).toBe(true);
    });

    it('should reject item with invalid IRT guessing parameter (c)', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'item-001',
          section: 'reading',
          type: 'test',
          content: 'Question',
          correct_answer: 'Answer',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.5 // Invalid: must be 0.0-0.3
        }
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].errors.some(e => e.includes('irt_parameters.c'))).toBe(true);
    });

    it('should validate multiple items and separate valid from invalid', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'valid-001',
          section: 'reading',
          type: 'test',
          content: 'Valid question',
          correct_answer: 'Answer',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        },
        {
          id: '',
          section: 'reading',
          type: 'test',
          content: 'Invalid - no ID',
          correct_answer: 'Answer',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        } as RawItemData,
        {
          id: 'valid-002',
          section: 'listening',
          type: 'audio',
          content: 'Valid question 2',
          correct_answer: 'Answer',
          irt_a: 1.5,
          irt_b: -0.5,
          irt_c: 0.25
        }
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(false); // Batch is invalid due to one error
      expect(result.validItems).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
    });
  });

  /**
   * Batch Import and Rollback Tests
   * Validates: Requirement 14.9
   * IF validation fails for any item in a batch, THEN THE Data_Loader 
   * SHALL reject the entire batch
   */
  describe('importItems - Batch Import with Rollback', () => {
    it('should import valid items successfully', async () => {
      const validItems: Item[] = [
        {
          id: 'item-001',
          section: 'reading',
          type: 'multiple-choice',
          content: 'Question 1',
          correct_answer: 'Answer A',
          irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
        }
      ];

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [], command: 'BEGIN', rowCount: 0, oid: 0, fields: [] })
          .mockResolvedValueOnce({ rows: [], command: 'INSERT', rowCount: 1, oid: 0, fields: [] })
          .mockResolvedValueOnce({ rows: [], command: 'COMMIT', rowCount: 0, oid: 0, fields: [] }),
        release: vi.fn()
      };

      vi.mocked(mockPool.connect).mockResolvedValue(mockClient as any);

      const result = await dataLoader.importItems(validItems);

      expect(result.success).toBe(true);
      expect(result.itemsImported).toBe(1);
      expect(result.itemsSkipped).toBe(0);
      expect(result.errors).toHaveLength(0);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction when import fails', async () => {
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
          .mockRejectedValueOnce(new Error('Database error'))
          .mockResolvedValueOnce({ rows: [], command: 'ROLLBACK', rowCount: 0, oid: 0, fields: [] }),
        release: vi.fn()
      };

      vi.mocked(mockPool.connect).mockResolvedValue(mockClient as any);

      const result = await dataLoader.importItems(validItems);

      expect(result.success).toBe(false);
      expect(result.itemsImported).toBe(0);
      expect(result.errors).toHaveLength(1);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle skipDuplicates option', async () => {
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
          .mockResolvedValueOnce({ rows: [], command: 'INSERT', rowCount: 0, oid: 0, fields: [] }) // Duplicate skipped
          .mockResolvedValueOnce({ rows: [], command: 'COMMIT', rowCount: 0, oid: 0, fields: [] }),
        release: vi.fn()
      };

      vi.mocked(mockPool.connect).mockResolvedValue(mockClient as any);

      const result = await dataLoader.importItems(validItems, { skipDuplicates: true });

      expect(result.success).toBe(true);
      expect(result.itemsImported).toBe(0);
      expect(result.itemsSkipped).toBe(1);

      // Verify ON CONFLICT clause was used
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array)
      );
    });
  });

  /**
   * Complete Workflow Tests (Parse → Validate → Import)
   * Tests the full data loading pipeline with validation and rollback
   */
  describe('loadFromCSV - Complete CSV Workflow', () => {
    it('should load valid CSV file successfully', async () => {
      const csvContent = `id,section,type,content,correct_answer,irt_a,irt_b,irt_c
item-001,reading,multiple-choice,Question 1,Answer A,1.0,0.0,0.2
item-002,listening,audio-response,Question 2,Answer B,1.5,-1.0,0.25`;

      const tempPath = createTempFile('test-load.csv', csvContent);
      tempFiles.push(tempPath);

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [], command: 'BEGIN', rowCount: 0, oid: 0, fields: [] })
          .mockResolvedValueOnce({ rows: [], command: 'INSERT', rowCount: 1, oid: 0, fields: [] })
          .mockResolvedValueOnce({ rows: [], command: 'INSERT', rowCount: 1, oid: 0, fields: [] })
          .mockResolvedValueOnce({ rows: [], command: 'COMMIT', rowCount: 0, oid: 0, fields: [] }),
        release: vi.fn()
      };

      vi.mocked(mockPool.connect).mockResolvedValue(mockClient as any);

      const result = await dataLoader.loadFromCSV(tempPath);

      expect(result.success).toBe(true);
      expect(result.itemsImported).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject entire batch when validation fails (Requirement 14.9)', async () => {
      const csvContent = `id,section,type,content,correct_answer,irt_a,irt_b,irt_c
item-001,reading,test,Valid Question,Answer,1.0,0.0,0.2
,reading,test,Invalid - no ID,Answer,1.0,0.0,0.2
item-003,reading,test,Valid Question 2,Answer,1.0,0.0,0.2`;

      const tempPath = createTempFile('test-invalid-batch.csv', csvContent);
      tempFiles.push(tempPath);

      const result = await dataLoader.loadFromCSV(tempPath);

      // Entire batch should be rejected (Requirement 14.9)
      expect(result.success).toBe(false);
      expect(result.itemsImported).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);

      // Database connection should not have been used
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('should handle CSV parsing errors', async () => {
      const result = await dataLoader.loadFromCSV('/non/existent/file.csv');

      expect(result.success).toBe(false);
      expect(result.itemsImported).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('CSV parsing failed');
    });
  });

  describe('loadFromJSON - Complete JSON Workflow', () => {
    it('should load valid JSON file successfully', async () => {
      const jsonContent = JSON.stringify([
        {
          id: 'item-001',
          section: 'writing',
          type: 'essay',
          content: 'Write an essay',
          correct_answer: 'Sample essay',
          irt_a: 1.0,
          irt_b: 0.5,
          irt_c: 0.15
        }
      ]);

      const tempPath = createTempFile('test-load.json', jsonContent);
      tempFiles.push(tempPath);

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [], command: 'BEGIN', rowCount: 0, oid: 0, fields: [] })
          .mockResolvedValueOnce({ rows: [], command: 'INSERT', rowCount: 1, oid: 0, fields: [] })
          .mockResolvedValueOnce({ rows: [], command: 'COMMIT', rowCount: 0, oid: 0, fields: [] }),
        release: vi.fn()
      };

      vi.mocked(mockPool.connect).mockResolvedValue(mockClient as any);

      const result = await dataLoader.loadFromJSON(tempPath);

      expect(result.success).toBe(true);
      expect(result.itemsImported).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject entire batch when JSON validation fails', async () => {
      const jsonContent = JSON.stringify([
        {
          id: 'item-001',
          section: 'invalid-section',
          type: 'test',
          content: 'Question',
          correct_answer: 'Answer',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        }
      ]);

      const tempPath = createTempFile('test-invalid.json', jsonContent);
      tempFiles.push(tempPath);

      const result = await dataLoader.loadFromJSON(tempPath);

      expect(result.success).toBe(false);
      expect(result.itemsImported).toBe(0);
    });
  });

  /**
   * Error Handling Tests for Malformed Datasets
   * Tests various malformed input scenarios
   */
  describe('Error Handling - Malformed Datasets', () => {
    it('should handle CSV with missing required columns', () => {
      const csvContent = `id,section
item-001,reading`;

      const tempPath = createTempFile('test-missing-columns.csv', csvContent);
      tempFiles.push(tempPath);

      // CSV parses successfully but validation should fail due to missing fields
      const result = dataLoader.parseCSV(tempPath);
      expect(result).toHaveLength(1);
      
      // Validation should fail due to missing required fields
      const validation = dataLoader.validateItems(result);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle JSON with missing required fields', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'item-001',
          section: 'reading',
          type: 'test'
          // Missing content, correct_answer, irt_parameters
        } as RawItemData
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle items with invalid data types', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'item-001',
          section: 'reading',
          type: 'test',
          content: 'Question',
          correct_answer: 'Answer',
          irt_a: 'not-a-number' as any,
          irt_b: 0.0,
          irt_c: 0.2
        }
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle empty CSV file', () => {
      const csvContent = 'id,section,type,content,correct_answer,irt_a,irt_b,irt_c';

      const tempPath = createTempFile('test-empty.csv', csvContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseCSV(tempPath);

      expect(result).toHaveLength(0);
    });

    it('should handle empty JSON array', () => {
      const jsonContent = '[]';

      const tempPath = createTempFile('test-empty.json', jsonContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseJSON(tempPath);

      expect(result).toHaveLength(0);
    });

    it('should handle CSV with inconsistent number of columns per row', () => {
      const csvContent = `id,section,type,content,correct_answer,irt_a,irt_b,irt_c
item-001,reading,test,Question,Answer,1.0,0.0
item-002,listening,audio,Question 2,Answer,1.5,-1.0,0.25,extra-field`;

      const tempPath = createTempFile('test-inconsistent.csv', csvContent);
      tempFiles.push(tempPath);

      expect(() => dataLoader.parseCSV(tempPath)).toThrow('CSV parsing failed');
    });

    it('should handle items with out-of-range IRT parameters', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'item-001',
          section: 'reading',
          type: 'test',
          content: 'Question',
          correct_answer: 'Answer',
          irt_a: -1.0, // Out of range (must be 0.5-2.5)
          irt_b: 10.0, // Out of range (must be -3 to 3)
          irt_c: 1.0 // Out of range (must be 0.0-0.3)
        }
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].errors.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle CSV with Unicode characters correctly', () => {
      const csvContent = `id,section,type,content,correct_answer,irt_a,irt_b,irt_c
item-001,reading,test,"Question with 中文 and émojis 😊","Answer with ñ",1.0,0.0,0.2`;

      const tempPath = createTempFile('test-unicode.csv', csvContent);
      tempFiles.push(tempPath);

      const result = dataLoader.parseCSV(tempPath);

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('中文');
      expect(result[0].content).toContain('😊');
      expect(result[0].correct_answer).toContain('ñ');
    });
  });

  /**
   * Dataset-Specific Parser Tests
   * Tests parsers for different dataset formats
   */
  describe('Dataset-Specific Parsers', () => {
    describe('TOEFL-QA Dataset Format', () => {
      it('should parse TOEFL-QA reading comprehension items', () => {
        const csvContent = `id,section,type,difficulty_level,stage,content,options,correct_answer,irt_a,irt_b,irt_c,metadata
toefl-qa-001,reading,academic-passage,medium,1,"What is the primary purpose of the passage?","[""To describe a process"",""To argue a position"",""To compare theories"",""To narrate events""]",To argue a position,1.3,-0.2,0.2,"{""passage_id"":""academic-001"",""word_count"":450}"`;

        const tempPath = createTempFile('toefl-qa-test.csv', csvContent);
        tempFiles.push(tempPath);

        const result = dataLoader.parseCSV(tempPath);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('toefl-qa-001');
        expect(result[0].section).toBe('reading');
        expect(result[0].type).toBe('academic-passage');
        expect(result[0].difficulty_level).toBe('medium');
      });
    });

    describe('Sentence Insertion Dataset Format', () => {
      it('should parse sentence insertion items', () => {
        const jsonContent = JSON.stringify([
          {
            id: 'sent-ins-001',
            section: 'reading',
            type: 'sentence-insertion',
            content: 'Insert the following sentence: "This discovery changed everything."',
            options: ['Position A', 'Position B', 'Position C', 'Position D'],
            correct_answer: 'Position C',
            irt_parameters: { a: 1.4, b: 0.8, c: 0.25 },
            metadata: { passage_id: 'passage-042', insertion_type: 'logical-flow' }
          }
        ]);

        const tempPath = createTempFile('sent-ins-test.json', jsonContent);
        tempFiles.push(tempPath);

        const result = dataLoader.parseJSON(tempPath);

        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('sentence-insertion');
        expect(result[0].irt_parameters).toEqual({ a: 1.4, b: 0.8, c: 0.25 });
      });
    });

    describe('Academic Discussion Dataset Format', () => {
      it('should parse academic discussion writing items', () => {
        const jsonContent = JSON.stringify({
          items: [
            {
              id: 'acad-disc-001',
              section: 'writing',
              type: 'academic-discussion',
              content: 'Professor: Should universities require foreign language courses?',
              correct_answer: 'Sample response demonstrating critical thinking',
              irt_a: 1.0,
              irt_b: 0.3,
              irt_c: 0.15,
              metadata: {
                rubric_criteria: ['content', 'organization', 'language'],
                time_limit: 600
              }
            }
          ]
        });

        const tempPath = createTempFile('acad-disc-test.json', jsonContent);
        tempFiles.push(tempPath);

        const result = dataLoader.parseJSON(tempPath);

        expect(result).toHaveLength(1);
        expect(result[0].section).toBe('writing');
        expect(result[0].type).toBe('academic-discussion');
      });
    });

    describe('Wordlink/Synonym Dataset Format', () => {
      it('should parse synonym matching items', () => {
        const csvContent = `id,section,type,content,options,correct_answer,irt_a,irt_b,irt_c
wordlink-001,reading,complete-words,"The word 'abundant' most nearly means:","Plentiful|Scarce|Moderate|Sufficient",Plentiful,1.1,-0.8,0.25`;

        const tempPath = createTempFile('wordlink-test.csv', csvContent);
        tempFiles.push(tempPath);

        const result = dataLoader.parseCSV(tempPath);

        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('complete-words');
        expect(result[0].options).toBe('Plentiful|Scarce|Moderate|Sufficient');
      });
    });

    describe('TOEFL-Spell Dataset Format', () => {
      it('should parse spelling/grammar items', () => {
        const jsonContent = JSON.stringify([
          {
            id: 'spell-001',
            section: 'writing',
            type: 'build-sentence',
            content: 'Arrange these words to form a correct sentence: ["the", "quickly", "ran", "dog"]',
            correct_answer: 'the dog ran quickly',
            irt_parameters: { a: 0.9, b: -1.2, c: 0.2 }
          }
        ]);

        const tempPath = createTempFile('spell-test.json', jsonContent);
        tempFiles.push(tempPath);

        const result = dataLoader.parseJSON(tempPath);

        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('build-sentence');
      });
    });
  });

  /**
   * Edge Cases and Boundary Conditions
   */
  describe('Edge Cases', () => {
    it('should handle items with optional fields', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'item-001',
          section: 'speaking',
          type: 'simulated-interview',
          content: 'Describe your hometown',
          correct_answer: 'Transcription',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
          // No difficulty_level, stage, options, metadata
        }
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(true);
      expect(result.validItems).toHaveLength(1);
    });

    it('should handle items with boundary IRT parameter values', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'boundary-test',
          section: 'reading',
          type: 'test',
          content: 'Question',
          correct_answer: 'Answer',
          irt_a: 0.5, // Minimum valid
          irt_b: -3.0, // Minimum valid
          irt_c: 0.0 // Minimum valid
        },
        {
          id: 'boundary-test-2',
          section: 'reading',
          type: 'test',
          content: 'Question 2',
          correct_answer: 'Answer 2',
          irt_a: 2.5, // Maximum valid
          irt_b: 3.0, // Maximum valid
          irt_c: 0.3 // Maximum valid
        }
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(true);
      expect(result.validItems).toHaveLength(2);
    });

    it('should handle very long content strings', () => {
      const longContent = 'A'.repeat(5000);
      const rawItems: RawItemData[] = [
        {
          id: 'long-content',
          section: 'reading',
          type: 'test',
          content: longContent,
          correct_answer: 'Answer',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        }
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(true);
      expect(result.validItems[0].content.length).toBe(5000);
    });

    it('should handle items with many options', () => {
      const manyOptions = Array.from({ length: 10 }, (_, i) => `Option ${i + 1}`);
      const rawItems: RawItemData[] = [
        {
          id: 'many-options',
          section: 'reading',
          type: 'test',
          content: 'Question',
          options: manyOptions,
          correct_answer: 'Option 5',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        }
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(true);
      expect(result.validItems[0].options).toHaveLength(10);
    });

    it('should handle complex nested metadata structures', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'complex-metadata',
          section: 'writing',
          type: 'essay',
          content: 'Write an essay',
          correct_answer: 'Sample',
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.15,
          metadata: {
            rubric: {
              dimensions: ['content', 'organization', 'language'],
              weights: [0.4, 0.3, 0.3],
              scoring_guide: {
                high: 'Demonstrates mastery',
                medium: 'Demonstrates competence',
                low: 'Demonstrates basic understanding'
              }
            },
            tags: ['argumentative', 'academic'],
            difficulty_factors: {
              vocabulary_level: 'advanced',
              cognitive_complexity: 'high'
            }
          }
        }
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(true);
      expect(result.validItems[0].metadata).toBeDefined();
    });

    it('should handle stage values correctly (1 or 2 for MST)', () => {
      const rawItems: RawItemData[] = [
        {
          id: 'stage-1-item',
          section: 'reading',
          type: 'test',
          content: 'Question',
          correct_answer: 'Answer',
          stage: 1,
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        },
        {
          id: 'stage-2-item',
          section: 'reading',
          type: 'test',
          content: 'Question',
          correct_answer: 'Answer',
          stage: 2,
          irt_a: 1.5,
          irt_b: 1.0,
          irt_c: 0.2
        }
      ];

      const result = dataLoader.validateItems(rawItems);

      expect(result.valid).toBe(true);
      expect(result.validItems[0].metadata?.stage).toBe(1);
      expect(result.validItems[1].metadata?.stage).toBe(2);
    });
  });
});
