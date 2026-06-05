/**
 * DataLoader Serialization Property-Based Tests
 * 
 * Property-based tests using fast-check to verify test item serialization round-trip
 * 
 * **Validates: Requirements 15.3**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DataLoader } from './DataLoader.js';
import { Item, Section, DifficultyLevel, IRTParameters } from '../models/irt.types.js';

/**
 * Custom arbitraries for test item generation
 */

// Generate valid section values
const sectionArb = fc.constantFrom<Section>(
  'reading',
  'listening',
  'writing',
  'speaking'
);

// Generate valid difficulty level values
const difficultyLevelArb = fc.constantFrom<DifficultyLevel>(
  'easy',
  'medium',
  'hard'
);

// Generate valid item types based on section
const itemTypeArb = (section: Section): fc.Arbitrary<string> => {
  const typesBySection: Record<Section, string[]> = {
    reading: ['multiple-choice', 'sentence-insertion', 'complete-words', 'daily-life', 'academic-passage'],
    listening: ['multiple-choice', 'choose-response', 'conversations', 'academic-talks'],
    writing: ['build-sentence', 'email', 'academic-discussion', 'essay'],
    speaking: ['listen-repeat', 'simulated-interview', 'read-aloud']
  };
  
  return fc.constantFrom(...typesBySection[section]);
};

// Generate IRT parameters within valid ranges
// a: discrimination (0.5 to 2.5)
// b: difficulty (-3 to +3)
// c: guessing (0.0 to 0.3)
const irtParametersArb = fc.record({
  a: fc.float({ min: Math.fround(0.5), max: Math.fround(2.5), noNaN: true }),
  b: fc.float({ min: Math.fround(-3.0), max: Math.fround(3.0), noNaN: true }),
  c: fc.float({ min: Math.fround(0.0), max: Math.fround(0.3), noNaN: true })
}) as fc.Arbitrary<IRTParameters>;

// Generate multiple choice options (array of strings)
const optionsArb = fc.array(
  fc.string({ minLength: 1, maxLength: 200 }),
  { minLength: 2, maxLength: 5 }
);

// Generate metadata objects with various structures
const metadataArb = fc.oneof(
  fc.constant(undefined), // No metadata
  fc.constant({}), // Empty metadata
  fc.record({
    stage: fc.option(fc.integer({ min: 1, max: 2 }), { nil: undefined }),
    passageId: fc.option(fc.uuid(), { nil: undefined }),
    audioUrl: fc.option(fc.webUrl(), { nil: undefined }),
    wordCount: fc.option(fc.integer({ min: 0, max: 500 }), { nil: undefined }),
    timeLimit: fc.option(fc.integer({ min: 30, max: 600 }), { nil: undefined }),
    tags: fc.option(fc.array(fc.string(), { maxLength: 5 }), { nil: undefined }),
    customField: fc.option(fc.anything(), { nil: undefined })
  }, { requiredKeys: [] })
);

// Generate item content with various text patterns
const contentArb = fc.oneof(
  fc.string({ minLength: 10, maxLength: 500 }), // Normal content
  fc.string({ minLength: 10, maxLength: 200 }), // Unicode characters (string handles unicode)
  fc.constant('What is the main idea of the passage?'), // Common question pattern
  fc.constant('Select the sentence that best completes the text.'),
  fc.constant(''), // Edge case: empty string (should fail validation but test serialization)
);

// Generate correct answer in various formats
const correctAnswerArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 200 }), // Text answer
  fc.constant('A'), // Multiple choice letter
  fc.constant('B'),
  fc.constant('C'),
  fc.constant('D'),
  fc.integer({ min: 0, max: 4 }).map(n => n.toString()), // Numeric answer as string
  fc.string({ minLength: 1, maxLength: 100 }) // Unicode answer
);

// Generate complete Item objects
const itemArb: fc.Arbitrary<Item> = fc
  .tuple(sectionArb, fc.uuid())
  .chain(([section, uuid]) => 
    fc.record({
      id: fc.constant(`item-${uuid}`),
      section: fc.constant(section),
      type: itemTypeArb(section),
      difficulty_level: difficultyLevelArb,
      content: contentArb,
      options: fc.option(optionsArb, { nil: undefined }),
      correct_answer: correctAnswerArb,
      irt_parameters: irtParametersArb,
      metadata: metadataArb
    })
  ) as fc.Arbitrary<Item>;

// Generate array of items
const itemsArrayArb = fc.array(itemArb, { minLength: 1, maxLength: 10 });

describe('Property 10: Test Item Serialization Round-Trip', () => {
  const dataLoader = new DataLoader(null as any); // No DB needed for serialization tests

  /**
   * Property 10: Test Item Serialization Round-Trip
   * 
   * **Validates: Requirements 15.3**
   * 
   * FOR ALL valid test item objects, parsing then printing then parsing 
   * SHALL produce an equivalent object (round-trip property)
   * 
   * Test Strategy:
   * 1. Generate random test item objects with all fields
   * 2. Format to JSON using formatItems()
   * 3. Parse back using parseFormattedJSON()
   * 4. Verify all fields are preserved and equivalent
   */
  it('should preserve all fields through format → parse round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        itemArb,
        async (originalItem) => {
          // Step 1: Format item to JSON
          const jsonString = dataLoader.formatItems([originalItem], true);

          // Verify JSON is valid
          expect(jsonString).toBeDefined();
          expect(jsonString.length).toBeGreaterThan(0);

          // Step 2: Parse JSON back to item
          const parsedItems = dataLoader.parseFormattedJSON(jsonString);

          // Verify we got exactly one item back
          expect(parsedItems).toHaveLength(1);
          const parsedItem = parsedItems[0];

          // Step 3: Verify all fields are preserved
          expect(parsedItem.id).toBe(originalItem.id);
          expect(parsedItem.section).toBe(originalItem.section);
          expect(parsedItem.type).toBe(originalItem.type);
          expect(parsedItem.difficulty_level).toBe(originalItem.difficulty_level);
          expect(parsedItem.content).toBe(originalItem.content);
          expect(parsedItem.correct_answer).toBe(originalItem.correct_answer);

          // Options array comparison (deep equality)
          if (originalItem.options === undefined) {
            expect(parsedItem.options).toBeUndefined();
          } else {
            expect(parsedItem.options).toEqual(originalItem.options);
          }

          // IRT parameters comparison (floating point with tolerance)
          expect(parsedItem.irt_parameters.a).toBeCloseTo(originalItem.irt_parameters.a, 10);
          expect(parsedItem.irt_parameters.b).toBeCloseTo(originalItem.irt_parameters.b, 10);
          expect(parsedItem.irt_parameters.c).toBeCloseTo(originalItem.irt_parameters.c, 10);

          // Metadata comparison (deep equality, ignoring prototype)
          if (originalItem.metadata === undefined) {
            expect(parsedItem.metadata).toBeUndefined();
          } else {
            // Convert both to plain objects for comparison (ignore __proto__)
            const originalMeta = JSON.parse(JSON.stringify(originalItem.metadata));
            const parsedMeta = JSON.parse(JSON.stringify(parsedItem.metadata));
            expect(parsedMeta).toEqual(originalMeta);
          }
        }
      ),
      { numRuns: 100, endOnFailure: true }
    );
  });

  /**
   * Property: Batch serialization preserves all items
   * 
   * Tests that multiple items can be serialized and deserialized
   * without data loss or corruption
   */
  it('should preserve all items in batch through format → parse round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        itemsArrayArb,
        async (originalItems) => {
          // Format all items to JSON
          const jsonString = dataLoader.formatItems(originalItems, true);

          // Parse back
          const parsedItems = dataLoader.parseFormattedJSON(jsonString);

          // Verify count
          expect(parsedItems).toHaveLength(originalItems.length);

          // Verify each item
          for (let i = 0; i < originalItems.length; i++) {
            const original = originalItems[i];
            const parsed = parsedItems[i];

            expect(parsed.id).toBe(original.id);
            expect(parsed.section).toBe(original.section);
            expect(parsed.type).toBe(original.type);
            expect(parsed.difficulty_level).toBe(original.difficulty_level);
            expect(parsed.content).toBe(original.content);
            expect(parsed.correct_answer).toBe(original.correct_answer);

            // IRT parameters
            expect(parsed.irt_parameters.a).toBeCloseTo(original.irt_parameters.a, 10);
            expect(parsed.irt_parameters.b).toBeCloseTo(original.irt_parameters.b, 10);
            expect(parsed.irt_parameters.c).toBeCloseTo(original.irt_parameters.c, 10);

            // Options
            if (original.options === undefined) {
              expect(parsed.options).toBeUndefined();
            } else {
              expect(parsed.options).toEqual(original.options);
            }

            // Metadata
            if (original.metadata === undefined) {
              expect(parsed.metadata).toBeUndefined();
            } else {
              // Convert both to plain objects for comparison (ignore __proto__)
              const originalMeta = JSON.parse(JSON.stringify(original.metadata));
              const parsedMeta = JSON.parse(JSON.stringify(parsed.metadata));
              expect(parsedMeta).toEqual(originalMeta);
            }
          }
        }
      ),
      { numRuns: 50, endOnFailure: true }
    );
  });

  /**
   * Property: Pretty print vs compact format equivalence
   * 
   * Both pretty printed and compact JSON should parse to the same items
   */
  it('should produce equivalent items for pretty and compact formats', async () => {
    await fc.assert(
      fc.asyncProperty(
        itemArb,
        async (originalItem) => {
          // Format with pretty print
          const prettyJson = dataLoader.formatItems([originalItem], true);

          // Format compact
          const compactJson = dataLoader.formatItems([originalItem], false);

          // Parse both
          const prettyParsed = dataLoader.parseFormattedJSON(prettyJson);
          const compactParsed = dataLoader.parseFormattedJSON(compactJson);

          // Both should produce equivalent items
          expect(prettyParsed).toHaveLength(1);
          expect(compactParsed).toHaveLength(1);

          const prettyItem = prettyParsed[0];
          const compactItem = compactParsed[0];

          // All fields should match
          expect(prettyItem.id).toBe(compactItem.id);
          expect(prettyItem.section).toBe(compactItem.section);
          expect(prettyItem.type).toBe(compactItem.type);
          expect(prettyItem.difficulty_level).toBe(compactItem.difficulty_level);
          expect(prettyItem.content).toBe(compactItem.content);
          expect(prettyItem.correct_answer).toBe(compactItem.correct_answer);
          expect(prettyItem.options).toEqual(compactItem.options);
          expect(prettyItem.irt_parameters).toEqual(compactItem.irt_parameters);
          expect(prettyItem.metadata).toEqual(compactItem.metadata);
        }
      ),
      { numRuns: 50, endOnFailure: true }
    );
  });

  /**
   * Property: Special characters and unicode preservation
   * 
   * Tests that special characters, unicode, and edge case strings
   * are preserved through serialization
   */
  it('should preserve special characters and unicode through round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid().map(u => `item-${u}`),
          section: sectionArb,
          type: fc.constant('multiple-choice'),
          difficulty_level: difficultyLevelArb,
          content: fc.string({ minLength: 10, maxLength: 200 }),
          options: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 2, maxLength: 4 }),
          correct_answer: fc.string({ minLength: 1, maxLength: 100 }),
          irt_parameters: irtParametersArb,
          metadata: fc.option(
            fc.record({
              note: fc.string({ minLength: 0, maxLength: 100 }),
              tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 3 })
            }),
            { nil: undefined }
          )
        }) as fc.Arbitrary<Item>,
        async (originalItem) => {
          // Format and parse
          const jsonString = dataLoader.formatItems([originalItem], true);
          const parsedItems = dataLoader.parseFormattedJSON(jsonString);

          expect(parsedItems).toHaveLength(1);
          const parsedItem = parsedItems[0];

          // Verify unicode content preserved
          expect(parsedItem.content).toBe(originalItem.content);
          expect(parsedItem.correct_answer).toBe(originalItem.correct_answer);
          expect(parsedItem.options).toEqual(originalItem.options);
          
          // Verify unicode in metadata
          if (originalItem.metadata) {
            expect(parsedItem.metadata).toEqual(originalItem.metadata);
          }
        }
      ),
      { numRuns: 50, endOnFailure: true }
    );
  });

  /**
   * Property: Empty metadata handling
   * 
   * Tests that empty, undefined, and various metadata structures
   * are handled correctly
   */
  it('should handle empty and undefined metadata correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(itemArb, fc.constantFrom(undefined, {}, { stage: 1 }, { custom: null })),
        async ([baseItem, metadata]) => {
          const item = { ...baseItem, metadata };

          // Format and parse
          const jsonString = dataLoader.formatItems([item], true);
          const parsedItems = dataLoader.parseFormattedJSON(jsonString);

          expect(parsedItems).toHaveLength(1);
          const parsedItem = parsedItems[0];

          // Metadata should be preserved
          expect(parsedItem.metadata).toEqual(metadata);
        }
      ),
      { numRuns: 30, endOnFailure: true }
    );
  });

  /**
   * Property: Options array edge cases
   * 
   * Tests undefined options, empty arrays, single option, many options
   */
  it('should handle options array edge cases', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          itemArb,
          fc.oneof(
            fc.constant(undefined),
            fc.constant([]),
            fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 1 }),
            fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 10, maxLength: 20 })
          )
        ),
        async ([baseItem, options]) => {
          const item = { ...baseItem, options };

          // Format and parse
          const jsonString = dataLoader.formatItems([item], true);
          const parsedItems = dataLoader.parseFormattedJSON(jsonString);

          expect(parsedItems).toHaveLength(1);
          const parsedItem = parsedItems[0];

          // Options should be preserved exactly
          if (options === undefined) {
            expect(parsedItem.options).toBeUndefined();
          } else {
            expect(parsedItem.options).toEqual(options);
          }
        }
      ),
      { numRuns: 40, endOnFailure: true }
    );
  });

  /**
   * Property: IRT parameters precision
   * 
   * Tests that IRT parameters maintain sufficient precision
   * through JSON serialization (important for psychometric accuracy)
   */
  it('should maintain IRT parameter precision through round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid().map(u => `item-${u}`),
          section: sectionArb,
          type: fc.constant('multiple-choice'),
          difficulty_level: difficultyLevelArb,
          content: fc.constant('Test question'),
          correct_answer: fc.constant('A'),
          // Test precise floating point values
          irt_parameters: fc.record({
            a: fc.float({ min: Math.fround(0.5), max: Math.fround(2.5), noNaN: true, noDefaultInfinity: true }),
            b: fc.float({ min: Math.fround(-3.0), max: Math.fround(3.0), noNaN: true, noDefaultInfinity: true }),
            c: fc.float({ min: Math.fround(0.0), max: Math.fround(0.3), noNaN: true, noDefaultInfinity: true })
          }) as fc.Arbitrary<IRTParameters>,
          metadata: fc.constant(undefined)
        }) as fc.Arbitrary<Item>,
        async (originalItem) => {
          // Format and parse
          const jsonString = dataLoader.formatItems([originalItem], true);
          const parsedItems = dataLoader.parseFormattedJSON(jsonString);

          expect(parsedItems).toHaveLength(1);
          const parsedItem = parsedItems[0];

          // IRT parameters should maintain high precision
          // JSON.stringify/parse should maintain ~15 decimal digits for floats
          expect(parsedItem.irt_parameters.a).toBeCloseTo(originalItem.irt_parameters.a, 10);
          expect(parsedItem.irt_parameters.b).toBeCloseTo(originalItem.irt_parameters.b, 10);
          expect(parsedItem.irt_parameters.c).toBeCloseTo(originalItem.irt_parameters.c, 10);

          // Verify parameters stay within valid ranges (with small tolerance for floating point)
          expect(parsedItem.irt_parameters.a).toBeGreaterThanOrEqual(0.49);
          expect(parsedItem.irt_parameters.a).toBeLessThanOrEqual(2.51);
          expect(parsedItem.irt_parameters.b).toBeGreaterThanOrEqual(-3.01);
          expect(parsedItem.irt_parameters.b).toBeLessThanOrEqual(3.01);
          expect(parsedItem.irt_parameters.c).toBeGreaterThanOrEqual(-0.01);
          expect(parsedItem.irt_parameters.c).toBeLessThanOrEqual(0.31);
        }
      ),
      { numRuns: 100, endOnFailure: true }
    );
  });

  /**
   * Property: Multiple round-trips preserve data
   * 
   * Tests that data remains stable through multiple serialize/deserialize cycles
   */
  it('should remain stable through multiple round-trips', async () => {
    await fc.assert(
      fc.asyncProperty(
        itemArb,
        async (originalItem) => {
          let currentItems = [originalItem];

          // Perform 5 round-trips
          for (let i = 0; i < 5; i++) {
            const jsonString = dataLoader.formatItems(currentItems, true);
            currentItems = dataLoader.parseFormattedJSON(jsonString);
          }

          // After 5 round-trips, data should still match original
          expect(currentItems).toHaveLength(1);
          const finalItem = currentItems[0];

          expect(finalItem.id).toBe(originalItem.id);
          expect(finalItem.section).toBe(originalItem.section);
          expect(finalItem.type).toBe(originalItem.type);
          expect(finalItem.difficulty_level).toBe(originalItem.difficulty_level);
          expect(finalItem.content).toBe(originalItem.content);
          expect(finalItem.correct_answer).toBe(originalItem.correct_answer);
          expect(finalItem.options).toEqual(originalItem.options);
          
          // IRT parameters should remain within tolerance
          expect(finalItem.irt_parameters.a).toBeCloseTo(originalItem.irt_parameters.a, 10);
          expect(finalItem.irt_parameters.b).toBeCloseTo(originalItem.irt_parameters.b, 10);
          expect(finalItem.irt_parameters.c).toBeCloseTo(originalItem.irt_parameters.c, 10);
          
          // Metadata comparison - handle undefined case
          if (originalItem.metadata === undefined && finalItem.metadata === undefined) {
            // Both undefined, ok
          } else if (originalItem.metadata !== undefined && finalItem.metadata !== undefined) {
            // Convert both to plain objects for comparison (ignore __proto__)
            const originalMeta = JSON.parse(JSON.stringify(originalItem.metadata));
            const finalMeta = JSON.parse(JSON.stringify(finalItem.metadata));
            expect(finalMeta).toEqual(originalMeta);
          } else {
            // One is undefined, the other is not - fail
            expect(finalItem.metadata).toEqual(originalItem.metadata);
          }
        }
      ),
      { numRuns: 30, endOnFailure: true }
    );
  });

  /**
   * Property: JSON parse-ability
   * 
   * Tests that formatItems() always produces valid JSON
   */
  it('should always produce valid parseable JSON', async () => {
    await fc.assert(
      fc.asyncProperty(
        itemsArrayArb,
        async (items) => {
          // Format items
          const jsonString = dataLoader.formatItems(items, true);

          // Should be valid JSON (this will throw if invalid)
          expect(() => JSON.parse(jsonString)).not.toThrow();

          // Parsed JSON should be an array
          const parsed = JSON.parse(jsonString);
          expect(Array.isArray(parsed)).toBe(true);
          expect(parsed).toHaveLength(items.length);
        }
      ),
      { numRuns: 50, endOnFailure: true }
    );
  });

  /**
   * Property: Stage metadata preservation
   * 
   * Tests that stage field in metadata (important for MST routing)
   * is preserved correctly
   */
  it('should preserve stage metadata for MST routing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          itemArb,
          fc.integer({ min: 1, max: 2 }) // MST stages 1 or 2
        ),
        async ([baseItem, stage]) => {
          const item = {
            ...baseItem,
            metadata: {
              ...baseItem.metadata,
              stage
            }
          };

          // Format and parse
          const jsonString = dataLoader.formatItems([item], true);
          const parsedItems = dataLoader.parseFormattedJSON(jsonString);

          expect(parsedItems).toHaveLength(1);
          const parsedItem = parsedItems[0];

          // Stage should be preserved
          expect(parsedItem.metadata?.stage).toBe(stage);
        }
      ),
      { numRuns: 40, endOnFailure: true }
    );
  });

  /**
   * Property: All sections have valid item types
   * 
   * Tests that generated items have section-appropriate types
   */
  it('should generate items with section-appropriate types', async () => {
    await fc.assert(
      fc.asyncProperty(
        itemArb,
        async (item) => {
          // Define valid types per section
          const validTypesBySection: Record<Section, string[]> = {
            reading: ['multiple-choice', 'sentence-insertion', 'complete-words', 'daily-life', 'academic-passage'],
            listening: ['multiple-choice', 'choose-response', 'conversations', 'academic-talks'],
            writing: ['build-sentence', 'email', 'academic-discussion', 'essay'],
            speaking: ['listen-repeat', 'simulated-interview', 'read-aloud']
          };

          // Verify type is valid for section
          const validTypes = validTypesBySection[item.section];
          expect(validTypes).toContain(item.type);

          // Round-trip should preserve this relationship
          const jsonString = dataLoader.formatItems([item], true);
          const parsedItems = dataLoader.parseFormattedJSON(jsonString);
          
          expect(parsedItems[0].section).toBe(item.section);
          expect(parsedItems[0].type).toBe(item.type);
          expect(validTypes).toContain(parsedItems[0].type);
        }
      ),
      { numRuns: 100, endOnFailure: true }
    );
  });
});
