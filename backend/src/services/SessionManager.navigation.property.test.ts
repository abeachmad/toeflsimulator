/**
 * SessionManager Navigation Property-Based Tests
 * 
 * Property 9: Navigation Module Boundary Enforcement
 * 
 * **Validates: Requirements 13.1, 13.2, 13.3, 13.5**
 * 
 * This test verifies that:
 * - Navigation to any question within the current module M is allowed
 * - Navigation to any question in completed modules C is blocked
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { Pool } from 'pg';
import { SessionManager } from './SessionManager.js';

/**
 * Custom arbitraries for navigation testing
 */

// Generate module IDs
const moduleIdArb = fc.stringMatching(/^module-[0-9]+$/);

// Generate question indices within a module (0-99)
const questionIndexArb = fc.integer({ min: 0, max: 99 });

// Generate a list of completed module IDs
const completedModulesArb = fc.array(
  fc.stringMatching(/^module-[0-9]+$/),
  { minLength: 0, maxLength: 10 }
).map(modules => Array.from(new Set(modules))); // Ensure uniqueness

// Generate a current module that's NOT in completed modules
const currentModuleArb = (completedModules: string[]) => 
  fc.stringMatching(/^module-[0-9]+$/)
    .filter(moduleId => !completedModules.includes(moduleId));

describe('Property 9: Navigation Module Boundary Enforcement', () => {
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
    await pool.query('DELETE FROM exam_sessions WHERE user_id LIKE $1', ['test-nav-user-%']);
  });

  afterEach(async () => {
    // Clean up test sessions
    await pool.query('DELETE FROM exam_sessions WHERE user_id LIKE $1', ['test-nav-user-%']);
    await pool.end();
  });

  /**
   * Property 9: Navigation Module Boundary Enforcement
   * 
   * **Validates: Requirements 13.1, 13.2, 13.3, 13.5**
   * 
   * For any exam session with completed modules C and current module M:
   * - Navigation to any question within M SHALL be allowed
   * - Navigation to any question within any module in C SHALL be blocked
   */
  it('should allow navigation within current module and block navigation to completed modules', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        completedModulesArb, // completed modules list
        questionIndexArb, // target question within current module
        async (userId, completedModules, questionIndex) => {
          // Generate a current module that's NOT in completed modules
          const currentModuleNumber = 99; // Use a high number to avoid collision
          const currentModuleId = `module-${currentModuleNumber}`;
          
          // Ensure current module is not in completed modules
          const filteredCompletedModules = completedModules.filter(
            m => m !== currentModuleId
          );
          
          // Step 1: Create session
          const session = await sessionManager.createSession({
            userId: `test-nav-user-${userId}`
          });

          // Step 2: Set current module
          await sessionManager.persistSession(session.sessionId, {
            currentModule: currentModuleNumber,
            currentSection: 'reading'
          });

          // Step 3: Mark some modules as completed
          for (const moduleId of filteredCompletedModules) {
            await sessionManager.markModuleCompleted(session.sessionId, moduleId);
          }

          // Step 4: Test navigation within current module (should be allowed)
          const canNavigateToCurrent = await sessionManager.canNavigateToQuestion(
            session.sessionId,
            currentModuleId,
            questionIndex
          );

          // Property 1: Navigation within current module SHALL be allowed
          expect(canNavigateToCurrent).toBe(true);

          // Step 5: Test navigation to completed modules (should be blocked)
          for (const completedModuleId of filteredCompletedModules) {
            const canNavigateToCompleted = await sessionManager.canNavigateToQuestion(
              session.sessionId,
              completedModuleId,
              questionIndex
            );

            // Property 2: Navigation to completed modules SHALL be blocked
            expect(canNavigateToCompleted).toBe(false);
          }

          // Cleanup
          await sessionManager.deleteSession(session.sessionId);
        }
      ),
      { numRuns: 100, endOnFailure: true }
    );
  }, 120000); // 2 minute timeout

  /**
   * Property: Navigation to any question index within current module is allowed
   * 
   * **Validates: Requirements 13.1, 13.2, 13.3**
   * - 13.1: Navigation to any question within current module
   * - 13.2: Skipping questions and returning to them later
   * - 13.3: Changing answers within current module
   */
  it('should allow navigation to any question index within current module', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 0, max: 20 }), // current module number
        fc.array(fc.integer({ min: 0, max: 50 }), { minLength: 5, maxLength: 20 }), // question indices to test
        async (userId, currentModuleNumber, questionIndices) => {
          // Create session
          const session = await sessionManager.createSession({
            userId: `test-nav-user-${userId}`
          });

          // Set current module
          await sessionManager.persistSession(session.sessionId, {
            currentModule: currentModuleNumber
          });

          const currentModuleId = `module-${currentModuleNumber}`;

          // Test navigation to each question index
          for (const questionIndex of questionIndices) {
            const canNavigate = await sessionManager.canNavigateToQuestion(
              session.sessionId,
              currentModuleId,
              questionIndex
            );

            // Property: ANY question index within current module is allowed
            expect(canNavigate).toBe(true);
          }

          // Cleanup
          await sessionManager.deleteSession(session.sessionId);
        }
      ),
      { numRuns: 50, endOnFailure: true }
    );
  }, 60000);

  /**
   * Property: Navigation to ALL completed modules is blocked
   * 
   * **Validates: Requirement 13.5**
   * THE UI_Controller SHALL prevent navigation to previously completed modules
   */
  it('should block navigation to all completed modules regardless of question index', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(fc.stringMatching(/^module-[0-9]+$/), { minLength: 1, maxLength: 15 }), // completed modules
        fc.array(fc.integer({ min: 0, max: 50 }), { minLength: 1, maxLength: 10 }), // question indices
        async (userId, completedModules, questionIndices) => {
          // Ensure unique completed modules
          const uniqueCompletedModules = Array.from(new Set(completedModules));

          // Create session
          const session = await sessionManager.createSession({
            userId: `test-nav-user-${userId}`
          });

          // Set current module (use a high number to avoid collision)
          const currentModuleNumber = 999;
          await sessionManager.persistSession(session.sessionId, {
            currentModule: currentModuleNumber
          });

          // Mark modules as completed
          for (const moduleId of uniqueCompletedModules) {
            await sessionManager.markModuleCompleted(session.sessionId, moduleId);
          }

          // Test navigation to each completed module with each question index
          for (const completedModuleId of uniqueCompletedModules) {
            for (const questionIndex of questionIndices) {
              const canNavigate = await sessionManager.canNavigateToQuestion(
                session.sessionId,
                completedModuleId,
                questionIndex
              );

              // Property: Navigation to completed modules is ALWAYS blocked
              expect(canNavigate).toBe(false);
            }
          }

          // Cleanup
          await sessionManager.deleteSession(session.sessionId);
        }
      ),
      { numRuns: 50, endOnFailure: true }
    );
  }, 90000);

  /**
   * Property: Boundary enforcement with sequential module completion
   * 
   * Tests the property dynamically as modules are completed one by one:
   * - Initially, current module is navigable, completed list is empty
   * - After completing module 1, it becomes blocked, next module becomes current and navigable
   * - After completing module 2, both 1 and 2 are blocked, next module is navigable
   * - And so on...
   */
  it('should enforce boundaries dynamically as modules are completed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 2, maxLength: 10 }),
        async (userId, moduleNumbers) => {
          // Ensure unique module numbers
          const uniqueModuleNumbers = Array.from(new Set(moduleNumbers)).sort((a, b) => a - b);

          // Create session
          const session = await sessionManager.createSession({
            userId: `test-nav-user-${userId}`
          });

          const completedModuleIds: string[] = [];

          // Sequentially go through modules
          for (let i = 0; i < uniqueModuleNumbers.length; i++) {
            const currentModuleNumber = uniqueModuleNumbers[i];
            const currentModuleId = `module-${currentModuleNumber}`;

            // Set as current module
            await sessionManager.persistSession(session.sessionId, {
              currentModule: currentModuleNumber
            });

            // Verify navigation to current module is allowed
            const canNavigateToCurrent = await sessionManager.canNavigateToQuestion(
              session.sessionId,
              currentModuleId
            );
            expect(canNavigateToCurrent).toBe(true);

            // Verify navigation to all previously completed modules is blocked
            for (const completedModuleId of completedModuleIds) {
              const canNavigateToCompleted = await sessionManager.canNavigateToQuestion(
                session.sessionId,
                completedModuleId
              );
              expect(canNavigateToCompleted).toBe(false);
            }

            // Complete current module
            await sessionManager.markModuleCompleted(session.sessionId, currentModuleId);
            completedModuleIds.push(currentModuleId);

            // After completion, navigation should now be blocked
            const canNavigateAfterCompletion = await sessionManager.canNavigateToQuestion(
              session.sessionId,
              currentModuleId
            );
            expect(canNavigateAfterCompletion).toBe(false);
          }

          // Cleanup
          await sessionManager.deleteSession(session.sessionId);
        }
      ),
      { numRuns: 30, endOnFailure: true }
    );
  }, 90000);

  /**
   * Property: Module boundary enforcement with empty completed modules
   * 
   * Edge case: When no modules are completed yet
   */
  it('should allow navigation to current module when no modules are completed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 50 }),
        async (userId, currentModuleNumber, questionIndex) => {
          // Create session
          const session = await sessionManager.createSession({
            userId: `test-nav-user-${userId}`
          });

          // Set current module (no completed modules)
          await sessionManager.persistSession(session.sessionId, {
            currentModule: currentModuleNumber
          });

          const currentModuleId = `module-${currentModuleNumber}`;

          // Navigation to current module should be allowed
          const canNavigate = await sessionManager.canNavigateToQuestion(
            session.sessionId,
            currentModuleId,
            questionIndex
          );

          expect(canNavigate).toBe(true);

          // Verify completed modules is empty
          const restored = await sessionManager.restoreSession(session.sessionId);
          expect(restored.completedModules).toHaveLength(0);

          // Cleanup
          await sessionManager.deleteSession(session.sessionId);
        }
      ),
      { numRuns: 30, endOnFailure: true }
    );
  }, 45000);

  /**
   * Property: Module boundary enforcement with many completed modules
   * 
   * Stress test: Many completed modules, single current module
   */
  it('should block navigation to all completed modules even with large lists', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 10, maxLength: 50 }),
        async (userId, completedModuleNumbers) => {
          // Ensure unique module numbers
          const uniqueModuleNumbers = Array.from(new Set(completedModuleNumbers));
          const completedModuleIds = uniqueModuleNumbers.map(n => `module-${n}`);

          // Create session
          const session = await sessionManager.createSession({
            userId: `test-nav-user-${userId}`
          });

          // Set current module (use a number not in the list)
          const currentModuleNumber = 999;
          await sessionManager.persistSession(session.sessionId, {
            currentModule: currentModuleNumber
          });

          // Mark all modules as completed
          for (const moduleId of completedModuleIds) {
            await sessionManager.markModuleCompleted(session.sessionId, moduleId);
          }

          const currentModuleId = `module-${currentModuleNumber}`;

          // Current module should be navigable
          const canNavigateToCurrent = await sessionManager.canNavigateToQuestion(
            session.sessionId,
            currentModuleId
          );
          expect(canNavigateToCurrent).toBe(true);

          // All completed modules should be blocked
          for (const completedModuleId of completedModuleIds) {
            const canNavigateToCompleted = await sessionManager.canNavigateToQuestion(
              session.sessionId,
              completedModuleId
            );
            expect(canNavigateToCompleted).toBe(false);
          }

          // Cleanup
          await sessionManager.deleteSession(session.sessionId);
        }
      ),
      { numRuns: 20, endOnFailure: true }
    );
  }, 90000);

  /**
   * Property: Navigation to future modules (not current, not completed) is blocked
   * 
   * Tests that modules that are neither current nor completed cannot be navigated to
   */
  it('should block navigation to future modules (not current, not completed)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1, max: 10 }), // current module
        fc.integer({ min: 11, max: 20 }), // future module
        async (userId, currentModuleNumber, futureModuleNumber) => {
          // Create session
          const session = await sessionManager.createSession({
            userId: `test-nav-user-${userId}`
          });

          // Set current module
          await sessionManager.persistSession(session.sessionId, {
            currentModule: currentModuleNumber
          });

          const futureModuleId = `module-${futureModuleNumber}`;

          // Navigation to future module should be blocked
          const canNavigateToFuture = await sessionManager.canNavigateToQuestion(
            session.sessionId,
            futureModuleId
          );

          expect(canNavigateToFuture).toBe(false);

          // Cleanup
          await sessionManager.deleteSession(session.sessionId);
        }
      ),
      { numRuns: 30, endOnFailure: true }
    );
  }, 45000);
});
