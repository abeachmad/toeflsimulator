/**
 * Property-Based Tests for Navigation Module Boundary Enforcement
 * 
 * **Property 9: Navigation Module Boundary Enforcement**
 * **Validates: Requirements 13.1, 13.2, 13.3, 13.5**
 * 
 * Tests that navigation within the current module is allowed while navigation
 * to completed modules is blocked.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { useExamStore } from '../stores/examStore'
import { useUIStore } from '../stores/uiStore'

/**
 * Custom Arbitraries for Session State Generation
 */

// Generate module IDs
const moduleIdArb = fc.stringMatching(/^module-[0-9]+$/)

// Generate section names
const sectionArb = fc.constantFrom(
  'reading' as const,
  'listening' as const,
  'writing' as const,
  'speaking' as const
)

// Generate question index within valid range
const questionIndexArb = fc.integer({ min: 0, max: 50 })

// Generate a set of completed modules
const completedModulesArb = fc.array(
  fc.stringMatching(/^module-[0-9]+$/),
  { minLength: 0, maxLength: 10 }
)

// Generate session state with completed modules
const sessionStateArb = fc.record({
  currentModule: moduleIdArb,
  currentSection: sectionArb,
  currentQuestionIndex: questionIndexArb,
  completedModules: completedModulesArb,
})

// Helper to reset store state between property iterations
function resetStoreState() {
  useExamStore.getState().reset()
  useUIStore.getState().reset()
  localStorage.clear()
}

describe('Property-Based Tests: Navigation Module Boundary Enforcement', () => {
  beforeEach(() => {
    resetStoreState()
  })

  afterEach(() => {
    localStorage.clear()
  })

  /**
   * Property 9: Navigation Module Boundary Enforcement
   * 
   * **Validates: Requirements 13.1, 13.2, 13.3, 13.5**
   * 
   * WHILE a module is active, THE UI_Controller SHALL allow navigation to any 
   * question within that module.
   * 
   * THE UI_Controller SHALL allow skipping questions and returning to them 
   * later within the same module.
   * 
   * THE UI_Controller SHALL allow changing answers within the current module.
   * 
   * THE UI_Controller SHALL prevent navigation to previously completed modules.
   */
  it('should allow navigation within current module, block navigation to completed modules', () => {
    fc.assert(
      fc.property(
        sessionStateArb,
        fc.integer({ min: 0, max: 50 }), // target question index
        (sessionState, targetQuestionIndex) => {
          // Reset store state for each property iteration
          resetStoreState()
          
          const store = useExamStore.getState()

          // Setup session state
          store.setSession({
            sessionId: 'test-session',
            currentSection: sessionState.currentSection,
            currentModule: sessionState.currentModule,
            currentQuestionIndex: sessionState.currentQuestionIndex,
          })

          // Mark modules as completed
          for (const moduleId of sessionState.completedModules) {
            store.markModuleComplete(moduleId)
          }

          // Property 1: Navigation within current module is allowed (Requirement 13.1)
          const beforeNavigation = useExamStore.getState().currentQuestionIndex
          store.goToQuestion(targetQuestionIndex)
          const afterNavigation = useExamStore.getState().currentQuestionIndex

          // Should successfully navigate within current module
          expect(afterNavigation).toBe(targetQuestionIndex)

          // Property 2: Can navigate back to previous questions (Requirement 13.2)
          store.goToQuestion(beforeNavigation)
          expect(useExamStore.getState().currentQuestionIndex).toBe(beforeNavigation)

          // Property 3: Current module should remain unchanged during navigation
          expect(useExamStore.getState().currentModule).toBe(sessionState.currentModule)

          // Property 4: Cannot navigate to completed modules (Requirement 13.5)
          // completedModules should be immutable during navigation
          const completedBefore = new Set(useExamStore.getState().completedModules)

          // Attempt navigation within current module (should succeed)
          store.goToQuestion(targetQuestionIndex)

          const completedAfter = new Set(useExamStore.getState().completedModules)

          // Completed modules should not change during navigation
          expect(completedAfter).toEqual(completedBefore)

          // Property 5: Current module should NOT be in completed modules while active
          expect(useExamStore.getState().completedModules.has(sessionState.currentModule)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Navigation with Answer Changes
   * 
   * **Validates: Requirement 13.3**
   * 
   * THE UI_Controller SHALL allow changing answers within the current module.
   */
  it('should allow navigation and answer changes within current module', () => {
    fc.assert(
      fc.property(
        moduleIdArb,
        fc.array(fc.tuple(fc.integer({ min: 0, max: 30 }), fc.string()), { minLength: 1, maxLength: 10 }),
        (currentModule, questionAnswerPairs) => {
          // Reset for each iteration
          resetStoreState()
          
          const store = useExamStore.getState()

          // Setup session
          store.setSession({
            sessionId: 'test-session',
            currentModule,
            currentQuestionIndex: 0,
          })

          // Navigate and answer questions
          for (const [questionIndex, answer] of questionAnswerPairs) {
            // Navigate to question
            store.goToQuestion(questionIndex)
            expect(useExamStore.getState().currentQuestionIndex).toBe(questionIndex)

            // Update answer
            const questionId = `q${questionIndex}`
            store.updateAnswer(questionId, answer)

            // Verify answer was stored
            expect(useExamStore.getState().answers.get(questionId)).toBe(answer)

            // Module should remain unchanged
            expect(useExamStore.getState().currentModule).toBe(currentModule)
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property: Completed Modules Remain Immutable
   * 
   * **Validates: Requirement 13.5**
   * 
   * THE UI_Controller SHALL prevent navigation to previously completed modules.
   * Completed modules set should not change during navigation within active module.
   */
  it('should maintain completed modules as immutable during navigation', () => {
    fc.assert(
      fc.property(
        moduleIdArb,
        completedModulesArb,
        fc.array(fc.integer({ min: 0, max: 50 }), { minLength: 1, maxLength: 20 }),
        (currentModule, completedModules, navigationSequence) => {
          // Reset for each iteration
          resetStoreState()
          
          const store = useExamStore.getState()

          // Ensure current module is not in completed modules
          const filteredCompleted = completedModules.filter(m => m !== currentModule)

          // Setup session
          store.setSession({
            sessionId: 'test-session',
            currentModule,
            currentQuestionIndex: 0,
          })

          // Mark modules as completed
          for (const moduleId of filteredCompleted) {
            store.markModuleComplete(moduleId)
          }

          // Snapshot completed modules (re-read after mutations)
          const completedSnapshot = new Set(useExamStore.getState().completedModules)

          // Perform navigation sequence
          for (const questionIndex of navigationSequence) {
            store.goToQuestion(questionIndex)

            // Completed modules should not change
            expect(new Set(useExamStore.getState().completedModules)).toEqual(completedSnapshot)

            // Current module should remain the same
            expect(useExamStore.getState().currentModule).toBe(currentModule)

            // Current module should NOT be in completed modules
            expect(useExamStore.getState().completedModules.has(currentModule)).toBe(false)
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property: Module Submission Adds to Completed Modules
   * 
   * **Validates: Requirement 13.4**
   * 
   * WHEN the test taker submits a module, THE Session_Manager SHALL mark 
   * only the submitted module as completed.
   */
  it('should add current module to completed modules on submission', () => {
    fc.assert(
      fc.property(
        moduleIdArb,
        completedModulesArb,
        (currentModule, previouslyCompleted) => {
          // Reset for each iteration
          resetStoreState()
          
          const store = useExamStore.getState()

          // Ensure current module not in previously completed
          const filteredCompleted = previouslyCompleted.filter(m => m !== currentModule)

          // Setup session
          store.setSession({
            sessionId: 'test-session',
            currentModule,
          })

          // Mark previous modules as completed
          for (const moduleId of filteredCompleted) {
            store.markModuleComplete(moduleId)
          }

          const completedBeforeSubmit = new Set(useExamStore.getState().completedModules)

          // Submit current module
          store.submitModule()

          // Current module should now be in completed modules (re-read after mutation)
          expect(useExamStore.getState().completedModules.has(currentModule)).toBe(true)

          // All previous completed modules should still be there
          for (const moduleId of filteredCompleted) {
            if (completedBeforeSubmit.has(moduleId)) {
              expect(useExamStore.getState().completedModules.has(moduleId)).toBe(true)
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property: Navigation Allows Question Skipping
   * 
   * **Validates: Requirement 13.2**
   * 
   * THE UI_Controller SHALL allow skipping questions and returning to them 
   * later within the same module.
   */
  it('should allow skipping questions in any pattern within current module', () => {
    fc.assert(
      fc.property(
        moduleIdArb,
        fc.array(fc.integer({ min: 0, max: 50 }), { minLength: 3, maxLength: 20 }),
        (currentModule, skipPattern) => {
          // Reset for each iteration
          resetStoreState()
          
          const store = useExamStore.getState()

          // Setup session
          store.setSession({
            sessionId: 'test-session',
            currentModule,
            currentQuestionIndex: 0,
          })

          // Execute skip pattern
          for (const targetIndex of skipPattern) {
            store.goToQuestion(targetIndex)

            // Should navigate to target (re-read after mutation)
            expect(useExamStore.getState().currentQuestionIndex).toBe(targetIndex)

            // Module should remain unchanged
            expect(useExamStore.getState().currentModule).toBe(currentModule)
          }

          // After all skips, should be at last target in pattern
          expect(useExamStore.getState().currentQuestionIndex).toBe(skipPattern[skipPattern.length - 1])
        }
      ),
      { numRuns: 50 }
    )
  })
})
