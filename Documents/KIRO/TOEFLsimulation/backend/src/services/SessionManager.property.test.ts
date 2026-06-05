/**
 * SessionManager Property-Based Tests
 * 
 * Property-based tests using fast-check to verify session state round-trip preservation
 * 
 * **Validates: Requirements 1.2, 1.3, 1.4, 1.6**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { Pool } from 'pg';
import { 
  SessionManager, 
  SessionState, 
  SessionStatus, 
  ModuleName,
  UpdateSessionRequest 
} from './SessionManager.js';

/**
 * Custom arbitraries for session state generation
 */

// Generate valid session status values
const sessionStatusArb = fc.constantFrom<SessionStatus>(
  'not_started',
  'in_progress',
  'paused',
  'completed',
  'expired'
);

// Generate valid module names
const moduleNameArb = fc.constantFrom<ModuleName>(
  'reading',
  'writing',
  'listening',
  'speaking'
);

// Generate nullable module names
const nullableModuleNameArb = fc.oneof(
  moduleNameArb,
  fc.constant(null)
);

// Generate answers object (JSONB field)
const answersArb = fc.oneof(
  fc.constant({}), // Empty answers
  fc.dictionary(
    fc.stringMatching(/^q[0-9]+$/), // Keys like "q1", "q2", etc.
    fc.oneof(
      fc.string(), // Simple string answer
      fc.integer(), // Numeric answer
      fc.constant(null), // Null answer
      fc.array(fc.string()) // Multiple choice answers
    ),
    { minKeys: 0, maxKeys: 20 }
  )
);

// Generate ability estimates (JSONB field)
const abilityEstimatesArb = fc.oneof(
  fc.constant({}), // Empty estimates
  fc.record({
    reading: fc.float({ min: -3, max: 3 }),
    writing: fc.float({ min: -3, max: 3 }),
    listening: fc.float({ min: -3, max: 3 }),
    speaking: fc.float({ min: -3, max: 3 })
  }, { requiredKeys: [] }) // Allow partial estimates
);

// Generate completed modules array
const completedModulesArb = fc.oneof(
  fc.constant([]), // No completed modules
  fc.array(fc.stringMatching(/^module-[0-9]+$/), { minLength: 1, maxLength: 10 }) // Module IDs like "module-1", "module-2"
);

// Generate update request with various field combinations
const updateRequestArb = fc.record({
  moduleName: fc.option(moduleNameArb, { nil: undefined }),
  status: fc.option(sessionStatusArb, { nil: undefined }),
  currentQuestion: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  answers: fc.option(answersArb, { nil: undefined }),
  score: fc.option(fc.oneof(
    fc.float({ min: 0, max: 120 }),
    fc.constant(null)
  ), { nil: undefined }),
  completedAt: fc.option(fc.oneof(
    fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
    fc.constant(null)
  ), { nil: undefined }),
  currentSection: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  currentModule: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined })
}, { requiredKeys: [] }).filter((req): req is UpdateSessionRequest => {
  // Ensure at least one field is present for valid update
  return Object.keys(req).length > 0;
});

describe('Property-Based Tests: Session State Round-Trip Preservation', () => {
  let pool: Pool;
  let sessionManager: SessionManager;

  beforeEach(async () => {
    // Connect to test database
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'toefl_simulator_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres'
    });

    sessionManager = new SessionManager(pool);

    // Clean up any existing test sessions
    await pool.query('DELETE FROM exam_sessions WHERE user_id LIKE $1', ['test-user-%']);
  });

  afterEach(async () => {
    // Clean up test sessions
    await pool.query('DELETE FROM exam_sessions WHERE user_id LIKE $1', ['test-user-%']);
    await pool.end();
  });

  /**
   * Property 1: Session State Round-Trip Preservation
   * 
   * **Validates: Requirements 1.2, 1.3, 1.4, 1.6**
   * 
   * FOR ALL session state changes, persisting then restoring SHALL produce 
   * equivalent session state (round-trip property)
   */
  it('should preserve all fields after createSession → persistSession → restoreSession cycle', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        nullableModuleNameArb, // moduleName
        updateRequestArb, // update fields
        async (userId, moduleName, updateFields) => {
          // Step 1: Create session
          const created = await sessionManager.createSession({
            userId: `test-user-${userId}`,
            moduleName: moduleName ?? undefined
          });

          // Verify initial state
          expect(created.sessionId).toBeDefined();
          expect(created.userId).toBe(`test-user-${userId}`);
          expect(created.status).toBe('not_started');

          // Step 2: Persist session with update
          const persisted = await sessionManager.persistSession(created.sessionId, updateFields);

          // Step 3: Restore session
          const restored = await sessionManager.restoreSession(created.sessionId);

          // Verify round-trip preservation
          expect(restored.sessionId).toBe(persisted.sessionId);
          expect(restored.userId).toBe(persisted.userId);
          expect(restored.status).toBe(persisted.status);
          expect(restored.currentQuestion).toBe(persisted.currentQuestion);
          expect(restored.currentSection).toBe(persisted.currentSection);
          expect(restored.currentModule).toBe(persisted.currentModule);
          expect(restored.score).toBe(persisted.score);
          
          // JSONB fields - deep equality
          expect(restored.answers).toEqual(persisted.answers);
          expect(restored.abilityEstimates).toEqual(persisted.abilityEstimates);
          expect(restored.completedModules).toEqual(persisted.completedModules);
          
          // Date fields - timestamp equality
          expect(restored.startedAt.getTime()).toBe(persisted.startedAt.getTime());
          
          if (persisted.completedAt) {
            expect(restored.completedAt).toBeDefined();
            expect(restored.completedAt!.getTime()).toBe(persisted.completedAt.getTime());
          } else {
            expect(restored.completedAt).toBeNull();
          }

          // Cleanup
          await sessionManager.deleteSession(created.sessionId);
        }
      ),
      { numRuns: 100, endOnFailure: true }
    );
  }, 60000); // 60 second timeout for property test

  /**
   * Property: Session state with different status values preserves correctly
   * 
   * Tests all valid session statuses through round-trip
   */
  it('should preserve session status through round-trip for all valid statuses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        sessionStatusArb,
        async (userId, status) => {
          // Create session
          const created = await sessionManager.createSession({
            userId: `test-user-${userId}`
          });

          // Update with specific status
          const persisted = await sessionManager.persistSession(created.sessionId, {
            status
          });

          // Restore and verify
          const restored = await sessionManager.restoreSession(created.sessionId);

          expect(restored.status).toBe(status);
          expect(restored.status).toBe(persisted.status);

          // Cleanup
          await sessionManager.deleteSession(created.sessionId);
        }
      ),
      { numRuns: 20, endOnFailure: true }
    );
  }, 30000);

  /**
   * Property: JSONB answer field serialization/deserialization
   * 
   * Tests various answer structures including:
   * - Empty objects
   * - Simple key-value pairs
   * - Nested structures
   * - Arrays
   * - Null values
   * - Special characters
   */
  it('should correctly serialize/deserialize JSONB answers field', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        answersArb,
        async (userId, answers) => {
          // Create session
          const created = await sessionManager.createSession({
            userId: `test-user-${userId}`
          });

          // Persist with answers
          const persisted = await sessionManager.persistSession(created.sessionId, {
            answers
          });

          // Restore and verify
          const restored = await sessionManager.restoreSession(created.sessionId);

          expect(restored.answers).toEqual(answers);
          expect(restored.answers).toEqual(persisted.answers);

          // Cleanup
          await sessionManager.deleteSession(created.sessionId);
        }
      ),
      { numRuns: 100, endOnFailure: true }
    );
  }, 60000);

  /**
   * Property: JSONB ability estimates field serialization/deserialization
   * 
   * Tests ability estimates with:
   * - Empty estimates
   * - Single section estimate
   * - Multiple section estimates
   * - Floating point precision
   * - Edge values (-3, 3)
   */
  it('should correctly serialize/deserialize JSONB ability_estimates field', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        abilityEstimatesArb,
        async (userId, abilityEstimates) => {
          // Create session
          const created = await sessionManager.createSession({
            userId: `test-user-${userId}`
          });

          // Update ability estimates using updateAbilityEstimate
          for (const [section, theta] of Object.entries(abilityEstimates)) {
            await sessionManager.updateAbilityEstimate(created.sessionId, section, theta);
          }

          // Restore and verify
          const restored = await sessionManager.restoreSession(created.sessionId);

          // Compare each section's ability estimate
          for (const [section, expectedTheta] of Object.entries(abilityEstimates)) {
            expect(restored.abilityEstimates[section]).toBeCloseTo(expectedTheta, 10);
          }

          // Cleanup
          await sessionManager.deleteSession(created.sessionId);
        }
      ),
      { numRuns: 100, endOnFailure: true }
    );
  }, 60000);

  /**
   * Property: Completed modules array preservation
   * 
   * Tests:
   * - Empty array
   * - Single module
   * - Multiple modules
   * - Duplicate prevention
   */
  it('should preserve completed modules through round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        completedModulesArb,
        async (userId, modules) => {
          // Create session
          const created = await sessionManager.createSession({
            userId: `test-user-${userId}`
          });

          // Mark modules as completed
          for (const moduleId of modules) {
            await sessionManager.markModuleCompleted(created.sessionId, moduleId);
          }

          // Restore and verify
          const restored = await sessionManager.restoreSession(created.sessionId);

          // Should contain all modules (no duplicates)
          const uniqueModules = Array.from(new Set(modules));
          expect(restored.completedModules).toHaveLength(uniqueModules.length);
          
          for (const moduleId of uniqueModules) {
            expect(restored.completedModules).toContain(moduleId);
          }

          // Cleanup
          await sessionManager.deleteSession(created.sessionId);
        }
      ),
      { numRuns: 50, endOnFailure: true }
    );
  }, 40000);

  /**
   * Property: Timestamp precision preservation
   * 
   * Verifies that timestamps (startedAt, completedAt) maintain precision
   * through persistence and restoration
   */
  it('should preserve timestamp precision through round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.option(fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') })),
        async (userId, completedAt) => {
          // Create session
          const created = await sessionManager.createSession({
            userId: `test-user-${userId}`
          });

          // Record original startedAt
          const originalStartedAt = created.startedAt;

          // Update with completedAt if provided
          if (completedAt) {
            await sessionManager.persistSession(created.sessionId, {
              completedAt,
              status: 'completed'
            });
          }

          // Restore and verify timestamp precision
          const restored = await sessionManager.restoreSession(created.sessionId);

          // startedAt should be preserved with millisecond precision
          expect(restored.startedAt.getTime()).toBe(originalStartedAt.getTime());

          // completedAt should match if provided
          if (completedAt) {
            expect(restored.completedAt).toBeDefined();
            expect(restored.completedAt!.getTime()).toBe(completedAt.getTime());
          }

          // Cleanup
          await sessionManager.deleteSession(created.sessionId);
        }
      ),
      { numRuns: 50, endOnFailure: true }
    );
  }, 40000);

  /**
   * Property: Module name validation and preservation
   * 
   * Tests all valid module names and null value
   */
  it('should preserve moduleName including null through round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        nullableModuleNameArb,
        async (userId, moduleName) => {
          // Create session
          const created = await sessionManager.createSession({
            userId: `test-user-${userId}`,
            moduleName: moduleName ?? undefined
          });

          // Restore and verify
          const restored = await sessionManager.restoreSession(created.sessionId);

          expect(restored.moduleName).toBe(moduleName);
          expect(restored.currentSection).toBe(moduleName);

          // Cleanup
          await sessionManager.deleteSession(created.sessionId);
        }
      ),
      { numRuns: 30, endOnFailure: true }
    );
  }, 30000);

  /**
   * Property: Current question number preservation
   * 
   * Tests question indices from 0 to 100
   */
  it('should preserve currentQuestion number through round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 0, max: 100 }),
        async (userId, currentQuestion) => {
          // Create session
          const created = await sessionManager.createSession({
            userId: `test-user-${userId}`
          });

          // Update current question
          await sessionManager.persistSession(created.sessionId, {
            currentQuestion
          });

          // Restore and verify
          const restored = await sessionManager.restoreSession(created.sessionId);

          expect(restored.currentQuestion).toBe(currentQuestion);

          // Cleanup
          await sessionManager.deleteSession(created.sessionId);
        }
      ),
      { numRuns: 50, endOnFailure: true }
    );
  }, 40000);

  /**
   * Property: Edge cases with large answer objects
   * 
   * Tests session state with large nested answer structures
   */
  it('should handle large answer objects through round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.dictionary(
          fc.stringMatching(/^q[0-9]+$/),
          fc.record({
            answer: fc.string({ minLength: 10, maxLength: 1000 }),
            timestamp: fc.integer({ min: 0, max: Date.now() }),
            metadata: fc.record({
              flagged: fc.boolean(),
              timeSpent: fc.integer({ min: 0, max: 3600 })
            })
          }),
          { minKeys: 10, maxKeys: 50 }
        ),
        async (userId, largeAnswers) => {
          // Create session
          const created = await sessionManager.createSession({
            userId: `test-user-${userId}`
          });

          // Persist large answer object
          await sessionManager.persistSession(created.sessionId, {
            answers: largeAnswers
          });

          // Restore and verify
          const restored = await sessionManager.restoreSession(created.sessionId);

          expect(restored.answers).toEqual(largeAnswers);

          // Cleanup
          await sessionManager.deleteSession(created.sessionId);
        }
      ),
      { numRuns: 20, endOnFailure: true }
    );
  }, 30000);

  /**
   * Property: Special characters in string fields
   * 
   * Tests handling of special characters, unicode, etc. in JSONB fields
   */
  it('should handle special characters in answers through round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.dictionary(
          fc.string(),
          fc.fullUnicodeString({ minLength: 0, maxLength: 100 })
        ),
        async (userId, specialAnswers) => {
          // Create session
          const created = await sessionManager.createSession({
            userId: `test-user-${userId}`
          });

          // Persist answers with special characters
          await sessionManager.persistSession(created.sessionId, {
            answers: specialAnswers
          });

          // Restore and verify
          const restored = await sessionManager.restoreSession(created.sessionId);

          expect(restored.answers).toEqual(specialAnswers);

          // Cleanup
          await sessionManager.deleteSession(created.sessionId);
        }
      ),
      { numRuns: 30, endOnFailure: true }
    );
  }, 30000);

  /**
   * Property: Module Completion Duplicate Prevention
   * 
   * **Validates: Requirement 13.4**
   * 
   * WHEN the test taker submits a module, THE Session_Manager SHALL mark 
   * only the submitted module as completed (no duplicates)
   * 
   * Property: Marking the same module as completed multiple times should NOT 
   * create duplicates. The completedModules array should remain a SET.
   * 
   * Tests:
   * - Marking module A, then B, then A again → should contain [A, B] (no duplicate A)
   * - Random sequences of module completions with intentional duplicates
   * - Idempotence: calling markModuleCompleted(id) N times = calling it once
   * - Order preservation: first occurrence order is maintained
   */
  it('should prevent duplicate modules in completedModules array', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(fc.stringMatching(/^module-[0-9]+$/), { minLength: 1, maxLength: 20 }),
        async (userId, moduleSequence) => {
          // Create session
          const created = await sessionManager.createSession({
            userId: `test-user-${userId}`
          });

          // Mark modules in sequence (may contain duplicates)
          for (const moduleId of moduleSequence) {
            await sessionManager.markModuleCompleted(created.sessionId, moduleId);
          }

          // Restore and verify
          const restored = await sessionManager.restoreSession(created.sessionId);

          // Property 1: No duplicates - completedModules is a SET
          const uniqueModules = Array.from(new Set(moduleSequence));
          expect(restored.completedModules).toHaveLength(uniqueModules.length);

          // Property 2: All unique modules are present
          for (const moduleId of uniqueModules) {
            expect(restored.completedModules).toContain(moduleId);
          }

          // Property 3: No extra modules
          for (const moduleId of restored.completedModules) {
            expect(uniqueModules).toContain(moduleId);
          }

          // Property 4: Order preservation (first occurrence order)
          const expectedOrder: string[] = [];
          const seen = new Set<string>();
          for (const moduleId of moduleSequence) {
            if (!seen.has(moduleId)) {
              expectedOrder.push(moduleId);
              seen.add(moduleId);
            }
          }
          expect(restored.completedModules).toEqual(expectedOrder);

          // Cleanup
          await sessionManager.deleteSession(created.sessionId);
        }
      ),
      { numRuns: 100, endOnFailure: true }
    );
  }, 60000);

  /**
   * Property: Module Completion Idempotence
   * 
   * **Validates: Requirement 13.4**
   * 
   * Calling markModuleCompleted(id) N times should be the same as calling it once.
   * This is the idempotence property.
   */
  it('should be idempotent - marking same module N times = marking once', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.stringMatching(/^module-[0-9]+$/),
        fc.integer({ min: 1, max: 10 }),
        async (userId, moduleId, repeatCount) => {
          // Create session
          const created = await sessionManager.createSession({
            userId: `test-user-${userId}`
          });

          // Mark the same module N times
          for (let i = 0; i < repeatCount; i++) {
            await sessionManager.markModuleCompleted(created.sessionId, moduleId);
          }

          // Restore and verify
          const restored = await sessionManager.restoreSession(created.sessionId);

          // Should appear exactly once
          expect(restored.completedModules).toHaveLength(1);
          expect(restored.completedModules[0]).toBe(moduleId);

          // Cleanup
          await sessionManager.deleteSession(created.sessionId);
        }
      ),
      { numRuns: 50, endOnFailure: true }
    );
  }, 40000);

  /**
   * Property: Module Completion with Alternating Pattern
   * 
   * **Validates: Requirement 13.4**
   * 
   * Tests specific pattern: A → B → A → C → B → A
   * Should result in: [A, B, C] (no duplicates, first occurrence order)
   */
  it('should handle alternating module completion patterns', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.tuple(
          fc.stringMatching(/^module-[0-9]+$/),
          fc.stringMatching(/^module-[0-9]+$/),
          fc.stringMatching(/^module-[0-9]+$/)
        ),
        async (userId, [moduleA, moduleB, moduleC]) => {
          // Create session
          const created = await sessionManager.createSession({
            userId: `test-user-${userId}`
          });

          // Mark in alternating pattern: A → B → A → C → B → A
          await sessionManager.markModuleCompleted(created.sessionId, moduleA);
          await sessionManager.markModuleCompleted(created.sessionId, moduleB);
          await sessionManager.markModuleCompleted(created.sessionId, moduleA);
          await sessionManager.markModuleCompleted(created.sessionId, moduleC);
          await sessionManager.markModuleCompleted(created.sessionId, moduleB);
          await sessionManager.markModuleCompleted(created.sessionId, moduleA);

          // Restore and verify
          const restored = await sessionManager.restoreSession(created.sessionId);

          // Build expected order (first occurrence)
          const expectedOrder = [moduleA, moduleB, moduleC].filter((val, idx, arr) => 
            arr.indexOf(val) === idx
          );

          // Should contain unique modules in first occurrence order
          expect(restored.completedModules).toEqual(expectedOrder);
          
          // Count occurrences - each should appear exactly once
          for (const module of expectedOrder) {
            const count = restored.completedModules.filter(m => m === module).length;
            expect(count).toBe(1);
          }

          // Cleanup
          await sessionManager.deleteSession(created.sessionId);
        }
      ),
      { numRuns: 50, endOnFailure: true }
    );
  }, 40000);

  /**
   * Property: Large Sequences with High Duplicate Rate
   * 
   * **Validates: Requirement 13.4**
   * 
   * Tests with sequences containing many duplicates to stress-test 
   * duplicate prevention mechanism.
   */
  it('should handle large sequences with high duplicate rate', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(
          fc.stringMatching(/^module-[1-5]$/), // Small set of modules (high collision)
          { minLength: 20, maxLength: 100 }
        ),
        async (userId, moduleSequence) => {
          // Create session
          const created = await sessionManager.createSession({
            userId: `test-user-${userId}`
          });

          // Mark all modules in sequence
          for (const moduleId of moduleSequence) {
            await sessionManager.markModuleCompleted(created.sessionId, moduleId);
          }

          // Restore and verify
          const restored = await sessionManager.restoreSession(created.sessionId);

          // Extract unique modules
          const uniqueModules = Array.from(new Set(moduleSequence));

          // No duplicates
          expect(restored.completedModules).toHaveLength(uniqueModules.length);

          // All unique modules present
          for (const moduleId of uniqueModules) {
            const count = restored.completedModules.filter(m => m === moduleId).length;
            expect(count).toBe(1);
          }

          // Cleanup
          await sessionManager.deleteSession(created.sessionId);
        }
      ),
      { numRuns: 50, endOnFailure: true }
    );
  }, 60000);

  /**
   * Property: Empty and Single Module Cases
   * 
   * **Validates: Requirement 13.4**
   * 
   * Edge cases: no modules, single module
   */
  it('should handle empty and single module cases', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.oneof(
          fc.constant([]), // Empty case
          fc.array(fc.stringMatching(/^module-[0-9]+$/), { minLength: 1, maxLength: 1 }) // Single module
        ),
        async (userId, modules) => {
          // Create session
          const created = await sessionManager.createSession({
            userId: `test-user-${userId}`
          });

          // Mark modules
          for (const moduleId of modules) {
            await sessionManager.markModuleCompleted(created.sessionId, moduleId);
          }

          // Restore and verify
          const restored = await sessionManager.restoreSession(created.sessionId);

          expect(restored.completedModules).toHaveLength(modules.length);
          
          if (modules.length > 0) {
            expect(restored.completedModules).toContain(modules[0]);
          }

          // Cleanup
          await sessionManager.deleteSession(created.sessionId);
        }
      ),
      { numRuns: 20, endOnFailure: true }
    );
  }, 20000);
});
