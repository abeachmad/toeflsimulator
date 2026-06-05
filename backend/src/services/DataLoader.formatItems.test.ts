/**
 * Unit tests for DataLoader.formatItems method
 * 
 * **Validates: Requirements 15.1, 15.2**
 * 
 * These tests explicitly verify that:
 * - 15.1: THE Data_Loader SHALL format test items into a standardized JSON structure
 * - 15.2: THE Data_Loader SHALL include item ID, type, content, options, correct answer, 
 *         IRT parameters, and metadata in the output
 */

import { describe, it, expect } from 'vitest';
import { DataLoader } from './DataLoader.js';
import { Item } from '../models/irt.types.js';

describe('DataLoader.formatItems - Requirements 15.1 and 15.2', () => {
  const dataLoader = new DataLoader(null as any); // No DB needed for formatting

  /**
   * Test for Requirement 15.1:
   * THE Data_Loader SHALL format test items into a standardized JSON structure
   */
  describe('Requirement 15.1: Standardized JSON structure', () => {
    it('should format a single item into valid JSON structure', () => {
      const item: Item = {
        id: 'test-item-001',
        section: 'reading',
        type: 'multiple-choice',
        difficulty_level: 'medium',
        content: 'What is the main idea?',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correct_answer: 'Option B',
        irt_parameters: {
          a: 1.2,
          b: -0.5,
          c: 0.2
        },
        metadata: {
          stage: 1
        }
      };

      const jsonString = dataLoader.formatItems([item], true);

      // Verify it's valid JSON
      expect(() => JSON.parse(jsonString)).not.toThrow();

      // Verify it's an array
      const parsed = JSON.parse(jsonString);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
    });

    it('should format multiple items into JSON array structure', () => {
      const items: Item[] = [
        {
          id: 'item-001',
          section: 'reading',
          type: 'multiple-choice',
          content: 'Question 1',
          correct_answer: 'A',
          irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
        },
        {
          id: 'item-002',
          section: 'listening',
          type: 'audio-response',
          content: 'Question 2',
          correct_answer: 'B',
          irt_parameters: { a: 1.5, b: -1.0, c: 0.25 }
        }
      ];

      const jsonString = dataLoader.formatItems(items, true);

      // Verify it's valid JSON
      const parsed = JSON.parse(jsonString);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });

    it('should support both pretty-printed and compact JSON formats', () => {
      const item: Item = {
        id: 'item-format-test',
        section: 'writing',
        type: 'essay',
        content: 'Write an essay',
        correct_answer: 'Sample answer',
        irt_parameters: { a: 1.0, b: 0.5, c: 0.15 }
      };

      // Pretty printed (with formatting)
      const prettyJson = dataLoader.formatItems([item], true);
      expect(prettyJson).toContain('\n'); // Should have newlines
      expect(prettyJson).toContain('  '); // Should have indentation

      // Compact (no formatting)
      const compactJson = dataLoader.formatItems([item], false);
      expect(compactJson).not.toContain('\n'); // Should not have newlines from formatting
      expect(compactJson.length).toBeLessThan(prettyJson.length);

      // Both should parse to the same structure
      expect(JSON.parse(prettyJson)).toEqual(JSON.parse(compactJson));
    });

    it('should produce consistent JSON structure across multiple calls', () => {
      const item: Item = {
        id: 'consistency-test',
        section: 'speaking',
        type: 'simulated-interview',
        content: 'Speak about...',
        correct_answer: 'Transcription',
        irt_parameters: { a: 1.3, b: 0.2, c: 0.2 }
      };

      // Format the same item multiple times
      const json1 = dataLoader.formatItems([item], true);
      const json2 = dataLoader.formatItems([item], true);
      const json3 = dataLoader.formatItems([item], true);

      // All should be identical
      expect(json1).toBe(json2);
      expect(json2).toBe(json3);

      // All should parse to the same object
      expect(JSON.parse(json1)).toEqual(JSON.parse(json2));
      expect(JSON.parse(json2)).toEqual(JSON.parse(json3));
    });
  });

  /**
   * Test for Requirement 15.2:
   * THE Data_Loader SHALL include item ID, type, content, options, correct answer, 
   * IRT parameters, and metadata in the output
   */
  describe('Requirement 15.2: All required fields in output', () => {
    it('should include item ID in formatted output', () => {
      const item: Item = {
        id: 'test-id-12345',
        section: 'reading',
        type: 'test',
        content: 'Test content',
        correct_answer: 'Answer',
        irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
      };

      const jsonString = dataLoader.formatItems([item], true);
      const parsed = JSON.parse(jsonString);

      expect(parsed[0]).toHaveProperty('id');
      expect(parsed[0].id).toBe('test-id-12345');
    });

    it('should include item type in formatted output', () => {
      const item: Item = {
        id: 'test-type',
        section: 'listening',
        type: 'audio-multiple-choice',
        content: 'Listen and select',
        correct_answer: 'Option C',
        irt_parameters: { a: 1.2, b: -0.3, c: 0.25 }
      };

      const jsonString = dataLoader.formatItems([item], true);
      const parsed = JSON.parse(jsonString);

      expect(parsed[0]).toHaveProperty('type');
      expect(parsed[0].type).toBe('audio-multiple-choice');
    });

    it('should include content in formatted output', () => {
      const item: Item = {
        id: 'test-content',
        section: 'reading',
        type: 'test',
        content: 'This is the question content that should be preserved',
        correct_answer: 'Answer',
        irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
      };

      const jsonString = dataLoader.formatItems([item], true);
      const parsed = JSON.parse(jsonString);

      expect(parsed[0]).toHaveProperty('content');
      expect(parsed[0].content).toBe('This is the question content that should be preserved');
    });

    it('should include options in formatted output when present', () => {
      const item: Item = {
        id: 'test-options',
        section: 'reading',
        type: 'multiple-choice',
        content: 'Which is correct?',
        options: ['First option', 'Second option', 'Third option', 'Fourth option'],
        correct_answer: 'Second option',
        irt_parameters: { a: 1.1, b: 0.5, c: 0.2 }
      };

      const jsonString = dataLoader.formatItems([item], true);
      const parsed = JSON.parse(jsonString);

      expect(parsed[0]).toHaveProperty('options');
      expect(Array.isArray(parsed[0].options)).toBe(true);
      expect(parsed[0].options).toHaveLength(4);
      expect(parsed[0].options).toEqual(['First option', 'Second option', 'Third option', 'Fourth option']);
    });

    it('should handle undefined options (for non-multiple-choice items)', () => {
      const item: Item = {
        id: 'test-no-options',
        section: 'writing',
        type: 'essay',
        content: 'Write an essay about...',
        correct_answer: 'Sample essay text',
        irt_parameters: { a: 1.0, b: 0.0, c: 0.15 }
      };

      const jsonString = dataLoader.formatItems([item], true);
      const parsed = JSON.parse(jsonString);

      // Options is undefined, which JSON.stringify omits (standard JSON behavior)
      // This is correct - undefined fields are not included in JSON output
      expect(parsed[0].options).toBeUndefined();
    });

    it('should include correct answer in formatted output', () => {
      const item: Item = {
        id: 'test-answer',
        section: 'reading',
        type: 'multiple-choice',
        content: 'Question?',
        options: ['A', 'B', 'C', 'D'],
        correct_answer: 'B',
        irt_parameters: { a: 1.0, b: 0.0, c: 0.25 }
      };

      const jsonString = dataLoader.formatItems([item], true);
      const parsed = JSON.parse(jsonString);

      expect(parsed[0]).toHaveProperty('correct_answer');
      expect(parsed[0].correct_answer).toBe('B');
    });

    it('should include IRT parameters in formatted output', () => {
      const item: Item = {
        id: 'test-irt',
        section: 'reading',
        type: 'test',
        content: 'Content',
        correct_answer: 'Answer',
        irt_parameters: {
          a: 1.5678,
          b: -0.9876,
          c: 0.2345
        }
      };

      const jsonString = dataLoader.formatItems([item], true);
      const parsed = JSON.parse(jsonString);

      expect(parsed[0]).toHaveProperty('irt_parameters');
      expect(parsed[0].irt_parameters).toHaveProperty('a');
      expect(parsed[0].irt_parameters).toHaveProperty('b');
      expect(parsed[0].irt_parameters).toHaveProperty('c');
      
      // Verify the values are preserved (with floating point tolerance)
      expect(parsed[0].irt_parameters.a).toBeCloseTo(1.5678, 4);
      expect(parsed[0].irt_parameters.b).toBeCloseTo(-0.9876, 4);
      expect(parsed[0].irt_parameters.c).toBeCloseTo(0.2345, 4);
    });

    it('should include metadata in formatted output when present', () => {
      const item: Item = {
        id: 'test-metadata',
        section: 'reading',
        type: 'test',
        content: 'Content',
        correct_answer: 'Answer',
        irt_parameters: { a: 1.0, b: 0.0, c: 0.2 },
        metadata: {
          stage: 2,
          passage_id: 'passage-123',
          custom_field: 'custom value'
        }
      };

      const jsonString = dataLoader.formatItems([item], true);
      const parsed = JSON.parse(jsonString);

      expect(parsed[0]).toHaveProperty('metadata');
      expect(parsed[0].metadata).toHaveProperty('stage');
      expect(parsed[0].metadata).toHaveProperty('passage_id');
      expect(parsed[0].metadata).toHaveProperty('custom_field');
      expect(parsed[0].metadata.stage).toBe(2);
      expect(parsed[0].metadata.passage_id).toBe('passage-123');
      expect(parsed[0].metadata.custom_field).toBe('custom value');
    });

    it('should handle undefined metadata', () => {
      const item: Item = {
        id: 'test-no-metadata',
        section: 'speaking',
        type: 'test',
        content: 'Content',
        correct_answer: 'Answer',
        irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
      };

      const jsonString = dataLoader.formatItems([item], true);
      const parsed = JSON.parse(jsonString);

      // Metadata is undefined, which JSON.stringify omits (standard JSON behavior)
      // This is correct - undefined fields are not included in JSON output
      expect(parsed[0].metadata).toBeUndefined();
    });

    it('should include ALL required fields in a single formatted item', () => {
      const item: Item = {
        id: 'comprehensive-test',
        section: 'reading',
        type: 'multiple-choice',
        difficulty_level: 'hard',
        content: 'What is the author\'s purpose?',
        options: ['To inform', 'To persuade', 'To entertain', 'To describe'],
        correct_answer: 'To persuade',
        irt_parameters: {
          a: 1.8,
          b: 1.2,
          c: 0.18
        },
        metadata: {
          stage: 2,
          passage_id: 'academic-passage-042',
          word_count: 350,
          time_limit: 120
        }
      };

      const jsonString = dataLoader.formatItems([item], true);
      const parsed = JSON.parse(jsonString);

      // Verify ALL required fields from Requirement 15.2 are present
      const formattedItem = parsed[0];

      // Required field: ID
      expect(formattedItem).toHaveProperty('id');
      expect(formattedItem.id).toBe('comprehensive-test');

      // Required field: type
      expect(formattedItem).toHaveProperty('type');
      expect(formattedItem.type).toBe('multiple-choice');

      // Required field: content
      expect(formattedItem).toHaveProperty('content');
      expect(formattedItem.content).toBe('What is the author\'s purpose?');

      // Required field: options
      expect(formattedItem).toHaveProperty('options');
      expect(formattedItem.options).toEqual(['To inform', 'To persuade', 'To entertain', 'To describe']);

      // Required field: correct answer
      expect(formattedItem).toHaveProperty('correct_answer');
      expect(formattedItem.correct_answer).toBe('To persuade');

      // Required field: IRT parameters
      expect(formattedItem).toHaveProperty('irt_parameters');
      expect(formattedItem.irt_parameters).toHaveProperty('a');
      expect(formattedItem.irt_parameters).toHaveProperty('b');
      expect(formattedItem.irt_parameters).toHaveProperty('c');
      expect(formattedItem.irt_parameters.a).toBeCloseTo(1.8, 4);
      expect(formattedItem.irt_parameters.b).toBeCloseTo(1.2, 4);
      expect(formattedItem.irt_parameters.c).toBeCloseTo(0.18, 4);

      // Required field: metadata
      expect(formattedItem).toHaveProperty('metadata');
      expect(formattedItem.metadata.stage).toBe(2);
      expect(formattedItem.metadata.passage_id).toBe('academic-passage-042');
      expect(formattedItem.metadata.word_count).toBe(350);
      expect(formattedItem.metadata.time_limit).toBe(120);
    });

    it('should include section and difficulty_level fields (additional context)', () => {
      const item: Item = {
        id: 'test-section-difficulty',
        section: 'listening',
        type: 'conversations',
        difficulty_level: 'easy',
        content: 'Listen to the conversation',
        correct_answer: 'Option A',
        irt_parameters: { a: 0.8, b: -1.5, c: 0.25 }
      };

      const jsonString = dataLoader.formatItems([item], true);
      const parsed = JSON.parse(jsonString);

      // These fields provide important context for test items
      expect(parsed[0]).toHaveProperty('section');
      expect(parsed[0].section).toBe('listening');

      expect(parsed[0]).toHaveProperty('difficulty_level');
      expect(parsed[0].difficulty_level).toBe('easy');
    });

    it('should preserve stage information in metadata (for MST routing)', () => {
      const stage1Item: Item = {
        id: 'stage-1-item',
        section: 'reading',
        type: 'test',
        content: 'Stage 1 question',
        correct_answer: 'Answer',
        irt_parameters: { a: 1.0, b: 0.0, c: 0.2 },
        metadata: { stage: 1 }
      };

      const stage2Item: Item = {
        id: 'stage-2-item',
        section: 'reading',
        type: 'test',
        content: 'Stage 2 question',
        correct_answer: 'Answer',
        irt_parameters: { a: 1.5, b: 1.0, c: 0.2 },
        metadata: { stage: 2 }
      };

      const jsonString = dataLoader.formatItems([stage1Item, stage2Item], true);
      const parsed = JSON.parse(jsonString);

      expect(parsed[0].metadata.stage).toBe(1);
      expect(parsed[1].metadata.stage).toBe(2);
    });
  });

  /**
   * Edge cases and robustness tests
   */
  describe('Edge cases', () => {
    it('should handle empty items array', () => {
      const jsonString = dataLoader.formatItems([], true);
      const parsed = JSON.parse(jsonString);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(0);
    });

    it('should handle items with special characters in content', () => {
      const item: Item = {
        id: 'special-chars',
        section: 'reading',
        type: 'test',
        content: 'Question with "quotes", \'apostrophes\', and special chars: é, ñ, 中文, 😊',
        correct_answer: 'Answer with special: é, ñ, 中文',
        irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
      };

      const jsonString = dataLoader.formatItems([item], true);
      const parsed = JSON.parse(jsonString);

      expect(parsed[0].content).toBe('Question with "quotes", \'apostrophes\', and special chars: é, ñ, 中文, 😊');
      expect(parsed[0].correct_answer).toBe('Answer with special: é, ñ, 中文');
    });

    it('should handle items with very long content', () => {
      const longContent = 'A'.repeat(10000);
      const item: Item = {
        id: 'long-content',
        section: 'reading',
        type: 'test',
        content: longContent,
        correct_answer: 'Answer',
        irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
      };

      const jsonString = dataLoader.formatItems([item], true);
      const parsed = JSON.parse(jsonString);

      expect(parsed[0].content).toBe(longContent);
      expect(parsed[0].content.length).toBe(10000);
    });

    it('should handle complex nested metadata', () => {
      const item: Item = {
        id: 'nested-metadata',
        section: 'writing',
        type: 'essay',
        content: 'Essay prompt',
        correct_answer: 'Sample essay',
        irt_parameters: { a: 1.0, b: 0.0, c: 0.15 },
        metadata: {
          stage: 1,
          rubric: {
            criteria: ['grammar', 'coherence', 'vocabulary'],
            weights: [0.3, 0.4, 0.3]
          },
          tags: ['academic', 'argumentative'],
          difficulty_factors: {
            vocabulary_level: 'advanced',
            topic_familiarity: 'medium'
          }
        }
      };

      const jsonString = dataLoader.formatItems([item], true);
      const parsed = JSON.parse(jsonString);

      expect(parsed[0].metadata).toEqual(item.metadata);
      expect(parsed[0].metadata.rubric.criteria).toEqual(['grammar', 'coherence', 'vocabulary']);
      expect(parsed[0].metadata.difficulty_factors.vocabulary_level).toBe('advanced');
    });
  });
});
