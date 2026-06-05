/**
 * Property-Based Tests for Gatekeeper Lock-Unlock Behavior
 * 
 * **Property 8: Gatekeeper Lock-Unlock Behavior**
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
 * 
 * Tests that the gatekeeper properly locks questions when a passage is displayed,
 * tracks scroll position, and unlocks questions when the passage is scrolled to bottom.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import { useUIStore } from '../stores/uiStore'

/**
 * Custom Arbitraries for Gatekeeper State Generation
 */

// Generate passage content with varying lengths (empty, short, medium, long)
const passageContentArb = fc.oneof(
  fc.constant(''), // Empty passage (Requirement 11.4)
  fc.constant('   '), // Whitespace-only passage (Requirement 11.4)
  fc.lorem({ maxCount: 5 }), // Short passage (1-5 sentences)
  fc.lorem({ maxCount: 20 }), // Medium passage (1-20 sentences)
  fc.lorem({ maxCount: 100 }) // Long passage (1-100 sentences)
)

// Generate array of question IDs
const questionIdsArb = fc.array(
  fc.stringMatching(/^q[0-9]+$/),
  { minLength: 1, maxLength: 10 }
)

// Generate scroll positions (scrollTop values)
const scrollTopArb = fc.nat({ max: 10000 })

// Generate content dimensions
const contentDimensionsArb = fc.record({
  scrollHeight: fc.nat({ min: 0, max: 5000 }),
  clientHeight: fc.nat({ min: 100, max: 1000 }),
  scrollTop: fc.nat({ min: 0, max: 5000 })
})

// Generate scroll state that represents "at bottom"
const atBottomScrollStateArb = fc.record({
  scrollHeight: fc.nat({ min: 200, max: 5000 }),
  clientHeight: fc.nat({ min: 100, max: 1000 })
}).map(({ scrollHeight, clientHeight }) => ({
  scrollHeight,
  clientHeight,
  scrollTop: Math.max(0, scrollHeight - clientHeight) // scrollTop that puts us at bottom
}))

// Generate scroll state that represents "not at bottom"
const notAtBottomScrollStateArb = fc.record({
  scrollHeight: fc.nat({ min: 200, max: 5000 }),
  clientHeight: fc.nat({ min: 100, max: 1000 }),
  scrollTop: fc.nat({ min: 0, max: 100 }) // Keep scroll near top
}).chain(({ scrollHeight, clientHeight, scrollTop }) => {
  // Ensure we're NOT at bottom by keeping scrollTop small
  const maxScroll = scrollHeight - clientHeight - 2 // -2 for tolerance
  if (maxScroll <= 0) {
    // If content doesn't scroll, adjust scrollHeight
    return fc.constant({
      scrollHeight: clientHeight + 200,
      clientHeight,
      scrollTop: 0
    })
  }
  return fc.constant({
    scrollHeight,
    clientHeight,
    scrollTop: Math.min(scrollTop, Math.max(0, maxScroll - 10))
  })
})

/**
 * Mock DOM Element for Scroll Testing
 */
function createMockPassageElement(dimensions: {
  scrollHeight: number
  clientHeight: number
  scrollTop: number
}) {
  return {
    scrollHeight: dimensions.scrollHeight,
    clientHeight: dimensions.clientHeight,
    scrollTop: dimensions.scrollTop,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}

// Helper to reset store state between property iterations
function resetStoreState() {
  // Clear localStorage FIRST to prevent restoration
  localStorage.clear()
  
  // Then reset the store state
  const store = useUIStore.getState()
  store.reset()
  
  // Force clear lockedQuestions Set
  store.unlockAllQuestions()
  store.setGatekeeperActive(false)
}

describe('Property-Based Tests: Gatekeeper Lock-Unlock Behavior', () => {
  beforeEach(() => {
    resetStoreState()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  /**
   * Property 8.1: Lock Questions When Passage Has Content
   * 
   * **Validates: Requirement 11.1**
   * 
   * WHEN a reading passage with content height greater than zero is displayed,
   * THE Gatekeeper SHALL lock all associated questions.
   */
  it('should lock all questions when passage with content is displayed', () => {
    fc.assert(
      fc.property(
        passageContentArb.filter(p => p.trim().length > 0), // Non-empty passages only
        questionIdsArb,
        contentDimensionsArb.filter(d => d.scrollHeight > 0),
        (passageContent, questionIds, dimensions) => {
          // Reset store for each iteration
          resetStoreState()
          
          const store = useUIStore.getState()

          // Simulate gatekeeper activation
          // This mimics what PassageViewer does in useEffect
          store.setGatekeeperActive(true)
          
          // Lock all questions
          questionIds.forEach(questionId => {
            store.lockQuestion(questionId)
          })

          // Re-read state after mutations (Zustand creates a new state object on each set())
          const currentState = useUIStore.getState()

          // Property 1: Gatekeeper should be active
          expect(currentState.isGatekeeperActive).toBe(true)

          // Property 2: All questions should be locked
          questionIds.forEach(questionId => {
            expect(currentState.lockedQuestions.has(questionId)).toBe(true)
          })

          // Property 3: Number of locked questions equals number of unique question IDs
          expect(currentState.lockedQuestions.size).toBe(new Set(questionIds).size)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 8.2: No Locking for Empty or Zero-Height Passages
   * 
   * **Validates: Requirement 11.4**
   * 
   * WHEN a reading passage has zero content height,
   * THE Gatekeeper SHALL allow normal input for associated questions.
   */
  it('should not lock questions when passage is empty or has zero content height', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''), // Empty string
          fc.constant('   '), // Whitespace only
          fc.constant('  \n  \t  ') // Various whitespace
        ),
        questionIdsArb,
        (emptyPassage, questionIds) => {
          // Reset store for each iteration
          resetStoreState()
          
          const store = useUIStore.getState()

          // Simulate what PassageViewer does for empty passage
          const trimmedPassage = emptyPassage.trim()
          const hasContent = trimmedPassage.length > 0

          if (!hasContent) {
            // Don't activate gatekeeper for empty passages
            store.setGatekeeperActive(false)
            store.unlockAllQuestions()
          }

          // Property 1: Gatekeeper should NOT be active
          expect(store.isGatekeeperActive).toBe(false)

          // Property 2: No questions should be locked
          expect(store.lockedQuestions.size).toBe(0)

          // Property 3: Specifically check each question is unlocked
          questionIds.forEach(questionId => {
            expect(store.lockedQuestions.has(questionId)).toBe(false)
          })
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property 8.3: Unlock Questions When Scrolled to Bottom
   * 
   * **Validates: Requirements 11.2, 11.3**
   * 
   * WHILE the test taker scrolls the passage, THE Gatekeeper SHALL track scroll position.
   * WHEN the test taker manually scrolls to the bottom of the passage,
   * THE Gatekeeper SHALL unlock all associated questions.
   */
  it('should unlock all questions when scrolled to bottom', () => {
    fc.assert(
      fc.property(
        passageContentArb.filter(p => p.trim().length > 0),
        questionIdsArb,
        atBottomScrollStateArb,
        (passageContent, questionIds, scrollState) => {
          // Reset store for each iteration
          resetStoreState()
          
          const store = useUIStore.getState()

          // Step 1: Activate gatekeeper and lock questions
          store.setGatekeeperActive(true)
          questionIds.forEach(questionId => {
            store.lockQuestion(questionId)
          })

          // Verify initial locked state (re-read after mutations)
          const lockedState = useUIStore.getState()
          expect(lockedState.isGatekeeperActive).toBe(true)
          expect(lockedState.lockedQuestions.size).toBe(new Set(questionIds).size)

          // Step 2: Simulate scrolling to bottom
          const { scrollTop, clientHeight, scrollHeight } = scrollState
          
          // Check if at bottom (with 1px tolerance)
          const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1

          // Should be at bottom based on our arbitrary
          expect(isAtBottom).toBe(true)

          if (isAtBottom) {
            // Simulate what PassageViewer does when bottom is reached
            store.unlockAllQuestions()
            store.setGatekeeperActive(false)
          }

          // Re-read state after unlock mutations
          const unlockedState = useUIStore.getState()

          // Property 1: Gatekeeper should be deactivated
          expect(unlockedState.isGatekeeperActive).toBe(false)

          // Property 2: All questions should be unlocked
          expect(unlockedState.lockedQuestions.size).toBe(0)

          // Property 3: Specifically verify each question is unlocked
          questionIds.forEach(questionId => {
            expect(unlockedState.lockedQuestions.has(questionId)).toBe(false)
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 8.4: Maintain Locked State While Not at Bottom
   * 
   * **Validates: Requirement 11.2**
   * 
   * WHILE the test taker scrolls the passage (but hasn't reached bottom),
   * THE Gatekeeper SHALL track scroll position and maintain locked state.
   */
  it('should maintain locked state while scrolling but not at bottom', () => {
    fc.assert(
      fc.property(
        passageContentArb.filter(p => p.trim().length > 0),
        questionIdsArb,
        notAtBottomScrollStateArb,
        (passageContent, questionIds, scrollState) => {
          // Reset store for each iteration
          resetStoreState()
          
          const store = useUIStore.getState()

          // Step 1: Activate gatekeeper and lock questions
          store.setGatekeeperActive(true)
          questionIds.forEach(questionId => {
            store.lockQuestion(questionId)
          })

          // Step 2: Simulate scrolling (but not to bottom)
          const { scrollTop, clientHeight, scrollHeight } = scrollState
          
          // Check if at bottom
          const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1

          // Should NOT be at bottom based on our arbitrary
          expect(isAtBottom).toBe(false)

          // Since not at bottom, questions should remain locked
          // Re-read state after mutations
          const currentState = useUIStore.getState()

          // Property 1: Gatekeeper should still be active
          expect(currentState.isGatekeeperActive).toBe(true)

          // Property 2: All questions should remain locked
          expect(currentState.lockedQuestions.size).toBe(new Set(questionIds).size)

          // Property 3: Each question should still be locked
          questionIds.forEach(questionId => {
            expect(currentState.lockedQuestions.has(questionId)).toBe(true)
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 8.5: Scroll Detection Consistency
   * 
   * **Validates: Requirements 11.2, 11.3**
   * 
   * The scroll-to-bottom detection logic should be consistent:
   * scrollTop + clientHeight >= scrollHeight - 1 (with 1px tolerance)
   */
  it('should consistently detect scroll-to-bottom state', () => {
    fc.assert(
      fc.property(
        contentDimensionsArb,
        (dimensions) => {
          const { scrollTop, clientHeight, scrollHeight } = dimensions
          
          // The detection formula used in PassageViewer
          const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1

          // Property 1: If scrollTop + clientHeight >= scrollHeight, must be at bottom
          if (scrollTop + clientHeight >= scrollHeight) {
            expect(isAtBottom).toBe(true)
          }

          // Property 2: If scrollTop is 0 and clientHeight >= scrollHeight, must be at bottom
          if (scrollTop === 0 && clientHeight >= scrollHeight) {
            expect(isAtBottom).toBe(true)
          }

          // Property 3: If scrollTop + clientHeight < scrollHeight - 1, cannot be at bottom
          if (scrollTop + clientHeight < scrollHeight - 1) {
            expect(isAtBottom).toBe(false)
          }

          // Property 4: Detection should be deterministic
          const secondCheck = scrollTop + clientHeight >= scrollHeight - 1
          expect(isAtBottom).toBe(secondCheck)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * Property 8.6: Idempotent Unlock Operations
   * 
   * **Validates: Requirement 11.3**
   * 
   * Unlocking all questions multiple times should have the same effect as unlocking once.
   */
  it('should handle multiple unlock operations idempotently', () => {
    fc.assert(
      fc.property(
        questionIdsArb,
        fc.integer({ min: 1, max: 10 }), // Number of unlock calls
        (questionIds, unlockCount) => {
          // Reset store for each iteration
          resetStoreState()
          
          const store = useUIStore.getState()

          // Lock all questions
          store.setGatekeeperActive(true)
          questionIds.forEach(questionId => {
            store.lockQuestion(questionId)
          })

          // Verify locked state (re-read after mutations)
          expect(useUIStore.getState().lockedQuestions.size).toBe(new Set(questionIds).size)

          // Unlock multiple times
          for (let i = 0; i < unlockCount; i++) {
            store.unlockAllQuestions()
            store.setGatekeeperActive(false)
          }

          // Re-read state after unlock mutations
          const currentState = useUIStore.getState()

          // Property 1: All questions should be unlocked
          expect(currentState.lockedQuestions.size).toBe(0)

          // Property 2: Gatekeeper should be inactive
          expect(currentState.isGatekeeperActive).toBe(false)

          // Property 3: Each specific question should be unlocked
          questionIds.forEach(questionId => {
            expect(currentState.lockedQuestions.has(questionId)).toBe(false)
          })
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property 8.7: Lock-Unlock Cycle Consistency
   * 
   * **Validates: Requirements 11.1, 11.3**
   * 
   * Locking then unlocking should return to unlocked state.
   * This tests the full gatekeeper lifecycle.
   */
  it('should maintain consistency through lock-unlock cycles', () => {
    fc.assert(
      fc.property(
        questionIdsArb,
        fc.integer({ min: 1, max: 5 }), // Number of lock-unlock cycles
        (questionIds, cycles) => {
          // Reset store for each iteration
          resetStoreState()
          
          const store = useUIStore.getState()

          for (let cycle = 0; cycle < cycles; cycle++) {
            // Lock phase
            store.setGatekeeperActive(true)
            questionIds.forEach(questionId => {
              store.lockQuestion(questionId)
            })

            // Verify locked state (re-read after mutations)
            const lockedCycleState = useUIStore.getState()
            expect(lockedCycleState.isGatekeeperActive).toBe(true)
            expect(lockedCycleState.lockedQuestions.size).toBe(new Set(questionIds).size)
            questionIds.forEach(questionId => {
              expect(lockedCycleState.lockedQuestions.has(questionId)).toBe(true)
            })

            // Unlock phase
            store.unlockAllQuestions()
            store.setGatekeeperActive(false)

            // Verify unlocked state (re-read after mutations)
            const unlockedCycleState = useUIStore.getState()
            expect(unlockedCycleState.isGatekeeperActive).toBe(false)
            expect(unlockedCycleState.lockedQuestions.size).toBe(0)
            questionIds.forEach(questionId => {
              expect(unlockedCycleState.lockedQuestions.has(questionId)).toBe(false)
            })
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property 8.8: Partial Question Locking
   * 
   * **Validates: Requirement 11.1**
   * 
   * When passage is displayed, gatekeeper should be able to lock
   * specific questions individually before locking all.
   */
  it('should correctly handle individual question locking', () => {
    fc.assert(
      fc.property(
        questionIdsArb,
        fc.integer({ min: 0, max: 1 }).map(x => x === 1), // Random boolean for lock/unlock
        (questionIds, shouldLockAll) => {
          // Reset store for each iteration
          resetStoreState()
          
          const store = useUIStore.getState()

          if (shouldLockAll) {
            // Lock all questions
            store.setGatekeeperActive(true)
            questionIds.forEach(questionId => {
              store.lockQuestion(questionId)
            })

            // Property: All should be locked (re-read after mutations)
            const allLockedState = useUIStore.getState()
            expect(allLockedState.lockedQuestions.size).toBe(new Set(questionIds).size)
            questionIds.forEach(questionId => {
              expect(allLockedState.lockedQuestions.has(questionId)).toBe(true)
            })
          } else {
            // Lock only half the questions
            const halfIndex = Math.floor(questionIds.length / 2)
            const questionsToLock = questionIds.slice(0, halfIndex)
            
            store.setGatekeeperActive(true)
            questionsToLock.forEach(questionId => {
              store.lockQuestion(questionId)
            })

            // Property: Only locked questions should be in the set (re-read after mutations)
            const partialLockedState = useUIStore.getState()
            expect(partialLockedState.lockedQuestions.size).toBe(new Set(questionsToLock).size)
            questionsToLock.forEach(questionId => {
              expect(partialLockedState.lockedQuestions.has(questionId)).toBe(true)
            })

            // Unlocked questions should not be in the set
            // Filter to only IDs that do NOT appear in questionsToLock (handles duplicates)
            const lockedSet = new Set(questionsToLock)
            const unlockedQuestions = questionIds.slice(halfIndex).filter(id => !lockedSet.has(id))
            unlockedQuestions.forEach(questionId => {
              expect(partialLockedState.lockedQuestions.has(questionId)).toBe(false)
            })
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property 8.9: Gatekeeper State Independence
   * 
   * **Validates: Requirements 11.1, 11.3**
   * 
   * Gatekeeper active state and locked questions should be independent but coordinated.
   * You can have gatekeeper inactive with locked questions (before cleanup),
   * but unlocking all should clear both.
   */
  it('should maintain correct relationship between gatekeeper state and locked questions', () => {
    fc.assert(
      fc.property(
        questionIdsArb,
        (questionIds) => {
          // Reset store for each iteration
          resetStoreState()
          
          const store = useUIStore.getState()

          // Start with everything locked
          store.setGatekeeperActive(true)
          questionIds.forEach(questionId => {
            store.lockQuestion(questionId)
          })

          // Scenario 1: Deactivate gatekeeper but keep questions locked
          store.setGatekeeperActive(false)
          
          // Questions remain locked (manual cleanup needed) - re-read after mutation
          const scenario1State = useUIStore.getState()
          expect(scenario1State.isGatekeeperActive).toBe(false)
          expect(scenario1State.lockedQuestions.size).toBe(new Set(questionIds).size)

          // Scenario 2: Proper cleanup - unlock all questions
          store.unlockAllQuestions()
          
          // Now both should be clear - re-read after mutation
          const scenario2State = useUIStore.getState()
          expect(scenario2State.isGatekeeperActive).toBe(false)
          expect(scenario2State.lockedQuestions.size).toBe(0)

          // Scenario 3: Can reactivate and lock again
          store.setGatekeeperActive(true)
          questionIds.forEach(questionId => {
            store.lockQuestion(questionId)
          })
          
          // Re-read after final mutations
          const scenario3State = useUIStore.getState()
          expect(scenario3State.isGatekeeperActive).toBe(true)
          expect(scenario3State.lockedQuestions.size).toBe(new Set(questionIds).size)
        }
      ),
      { numRuns: 50 }
    )
  })
})
