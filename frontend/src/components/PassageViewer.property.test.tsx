import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import * as fc from 'fast-check'
import { PassageViewer } from './PassageViewer'
import { useUIStore } from '../stores/uiStore'

/**
 * Property-Based Tests for PassageViewer Gatekeeper Lock-Unlock Behavior
 * 
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
 */

// Mock the uiStore
vi.mock('../stores/uiStore', () => ({
  useUIStore: vi.fn(),
}))

describe('PassageViewer - Property 8: Gatekeeper Lock-Unlock Behavior', () => {
  const mockSetGatekeeperActive = vi.fn()
  const mockUnlockAllQuestions = vi.fn()
  const mockLockQuestion = vi.fn()

  beforeEach(() => {
    mockSetGatekeeperActive.mockClear()
    mockUnlockAllQuestions.mockClear()
    mockLockQuestion.mockClear()

    // Setup default mock implementation
    ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      setGatekeeperActive: mockSetGatekeeperActive,
      unlockAllQuestions: mockUnlockAllQuestions,
      lockQuestion: mockLockQuestion,
    })
  })

  /**
   * Property 8.1: Questions locked when content height > 0 and not scrolled to bottom
   * 
   * For any reading passage with content height H > 0 and scroll position P:
   * WHEN P < H (not scrolled to bottom), all associated questions SHALL be locked
   * 
   * **Validates: Requirements 11.1, 11.2**
   */
  it('Property 8.1: should lock all questions when passage has content and not scrolled to bottom', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate passage content (non-empty string)
        fc.string({ minLength: 10, maxLength: 500 }),
        // Generate question IDs (array of strings)
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 10 }),
        // Generate scroll position where P < H (not at bottom)
        fc.record({
          scrollTop: fc.integer({ min: 0, max: 500 }),
          clientHeight: fc.integer({ min: 100, max: 1000 }),
          scrollHeight: fc.integer({ min: 200, max: 2000 }),
        }).filter(({ scrollTop, clientHeight, scrollHeight }) => {
          // Ensure scroll position is NOT at bottom: scrollTop + clientHeight < scrollHeight - 1
          return scrollTop + clientHeight < scrollHeight - 1
        }),
        async (passage, questionIds, scrollMetrics) => {
          // Reset mocks for this iteration
          mockSetGatekeeperActive.mockClear()
          mockLockQuestion.mockClear()

          // Render component with passage content
          const { container } = render(
            <PassageViewer passage={passage} questionIds={questionIds}>
              <div>Questions</div>
            </PassageViewer>
          )

          // Wait for useEffect to execute (gatekeeper initialization)
          await waitFor(() => {
            expect(mockSetGatekeeperActive).toHaveBeenCalled()
          })

          // Verify gatekeeper is activated for non-empty passage
          expect(mockSetGatekeeperActive).toHaveBeenCalledWith(true)

          // Verify all questions are locked
          await waitFor(() => {
            questionIds.forEach((qId) => {
              expect(mockLockQuestion).toHaveBeenCalledWith(qId)
            })
          })

          // Simulate scrolling but NOT to bottom
          const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement
          if (passageContainer) {
            Object.defineProperty(passageContainer, 'scrollTop', {
              value: scrollMetrics.scrollTop,
              writable: true,
            })
            Object.defineProperty(passageContainer, 'clientHeight', {
              value: scrollMetrics.clientHeight,
              writable: true,
            })
            Object.defineProperty(passageContainer, 'scrollHeight', {
              value: scrollMetrics.scrollHeight,
              writable: true,
            })

            // Reset unlock mock before scroll event
            mockUnlockAllQuestions.mockClear()
            mockSetGatekeeperActive.mockClear()

            // Trigger scroll event
            passageContainer.dispatchEvent(new Event('scroll'))

            // Since we're not at bottom, questions should remain locked
            // unlockAllQuestions should NOT be called
            expect(mockUnlockAllQuestions).not.toHaveBeenCalled()
            // Gatekeeper should NOT be deactivated
            expect(mockSetGatekeeperActive).not.toHaveBeenCalledWith(false)
          }
        }
      ),
      {
        numRuns: 50, // Run 50 test iterations with different inputs
        verbose: true,
      }
    )
  })

  /**
   * Property 8.2: Questions unlocked when scrolled to bottom
   * 
   * For any reading passage with content height H > 0 and scroll position P:
   * WHEN P ≥ H (scrolled to bottom), all associated questions SHALL be unlocked
   * 
   * **Validates: Requirements 11.3**
   */
  it('Property 8.2: should unlock all questions when scrolled to bottom', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate passage content (non-empty string)
        fc.string({ minLength: 10, maxLength: 500 }),
        // Generate question IDs (array of strings)
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 10 }),
        // Generate scroll position where P ≥ H (at bottom)
        fc.record({
          clientHeight: fc.integer({ min: 100, max: 1000 }),
          scrollHeight: fc.integer({ min: 200, max: 2000 }),
        }).chain(({ clientHeight, scrollHeight }) => {
          // Calculate scrollTop such that scrollTop + clientHeight >= scrollHeight - 1
          const minScrollTop = Math.max(0, scrollHeight - clientHeight - 1)
          const maxScrollTop = Math.max(minScrollTop, scrollHeight - clientHeight + 10)
          return fc.record({
            scrollTop: fc.integer({ min: minScrollTop, max: maxScrollTop }),
            clientHeight: fc.constant(clientHeight),
            scrollHeight: fc.constant(scrollHeight),
          })
        }),
        async (passage, questionIds, scrollMetrics) => {
          // Reset mocks
          mockSetGatekeeperActive.mockClear()
          mockUnlockAllQuestions.mockClear()
          mockLockQuestion.mockClear()

          // Render component
          const { container } = render(
            <PassageViewer passage={passage} questionIds={questionIds}>
              <div>Questions</div>
            </PassageViewer>
          )

          // Wait for initial gatekeeper setup
          await waitFor(() => {
            expect(mockSetGatekeeperActive).toHaveBeenCalledWith(true)
          })

          // Simulate scrolling to bottom
          const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement
          if (passageContainer) {
            Object.defineProperty(passageContainer, 'scrollTop', {
              value: scrollMetrics.scrollTop,
              writable: true,
            })
            Object.defineProperty(passageContainer, 'clientHeight', {
              value: scrollMetrics.clientHeight,
              writable: true,
            })
            Object.defineProperty(passageContainer, 'scrollHeight', {
              value: scrollMetrics.scrollHeight,
              writable: true,
            })

            // Clear mocks before triggering scroll
            mockUnlockAllQuestions.mockClear()
            mockSetGatekeeperActive.mockClear()

            // Trigger scroll event
            passageContainer.dispatchEvent(new Event('scroll'))

            // Verify unlocking behavior
            expect(mockUnlockAllQuestions).toHaveBeenCalled()
            expect(mockSetGatekeeperActive).toHaveBeenCalledWith(false)
          }
        }
      ),
      {
        numRuns: 50,
        verbose: true,
      }
    )
  })

  /**
   * Property 8.3: Questions unlocked when content height is zero
   * 
   * For any reading passage with content height H = 0,
   * all associated questions SHALL be unlocked
   * 
   * **Validates: Requirements 11.4**
   */
  it('Property 8.3: should not lock questions when passage has zero content height (empty or whitespace)', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate empty or whitespace-only passages
        fc.oneof(
          fc.constant(''),
          fc.string({ maxLength: 20 }).map((s) => ' '.repeat(s.length)), // whitespace only
          fc.constant('   '),
          fc.constant('\n\n\n'),
          fc.constant('\t\t\t')
        ),
        // Generate question IDs
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 10 }),
        async (emptyPassage, questionIds) => {
          // Reset mocks
          mockSetGatekeeperActive.mockClear()
          mockUnlockAllQuestions.mockClear()
          mockLockQuestion.mockClear()

          // Render component with empty/whitespace passage
          render(
            <PassageViewer passage={emptyPassage} questionIds={questionIds}>
              <div>Questions</div>
            </PassageViewer>
          )

          // Wait for useEffect to execute
          await waitFor(() => {
            expect(mockSetGatekeeperActive).toHaveBeenCalled()
          })

          // Verify gatekeeper is NOT activated for empty passages
          expect(mockSetGatekeeperActive).toHaveBeenCalledWith(false)

          // Verify all questions are unlocked
          await waitFor(() => {
            expect(mockUnlockAllQuestions).toHaveBeenCalled()
          })

          // Verify lockQuestion was NOT called
          expect(mockLockQuestion).not.toHaveBeenCalled()
        }
      ),
      {
        numRuns: 30,
        verbose: true,
      }
    )
  })

  /**
   * Property 8.4: Scroll detection formula correctness
   * 
   * For any scroll position values, the formula scrollTop + clientHeight >= scrollHeight - 1
   * SHALL correctly determine if the user is at the bottom
   * 
   * **Validates: Requirements 11.2, 11.3**
   */
  it('Property 8.4: should use correct scroll-to-bottom detection formula', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate passage content
        fc.string({ minLength: 50, maxLength: 500 }),
        // Generate scroll metrics covering edge cases
        fc.record({
          scrollTop: fc.integer({ min: 0, max: 2000 }),
          clientHeight: fc.integer({ min: 100, max: 1000 }),
          scrollHeight: fc.integer({ min: 200, max: 2000 }),
        }),
        async (passage, scrollMetrics) => {
          const { scrollTop, clientHeight, scrollHeight } = scrollMetrics

          // Calculate expected result using the formula
          const expectedIsAtBottom = scrollTop + clientHeight >= scrollHeight - 1

          // Reset mocks
          mockSetGatekeeperActive.mockClear()
          mockUnlockAllQuestions.mockClear()

          // Render component
          const { container } = render(
            <PassageViewer passage={passage} questionIds={['q1']}>
              <div>Questions</div>
            </PassageViewer>
          )

          // Wait for initial setup
          await waitFor(() => {
            expect(mockSetGatekeeperActive).toHaveBeenCalled()
          })

          // Simulate scroll
          const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement
          if (passageContainer) {
            Object.defineProperty(passageContainer, 'scrollTop', {
              value: scrollTop,
              writable: true,
            })
            Object.defineProperty(passageContainer, 'clientHeight', {
              value: clientHeight,
              writable: true,
            })
            Object.defineProperty(passageContainer, 'scrollHeight', {
              value: scrollHeight,
              writable: true,
            })

            // Clear mocks
            mockUnlockAllQuestions.mockClear()
            mockSetGatekeeperActive.mockClear()

            // Trigger scroll
            passageContainer.dispatchEvent(new Event('scroll'))

            // Verify behavior matches expected result
            if (expectedIsAtBottom) {
              expect(mockUnlockAllQuestions).toHaveBeenCalled()
              expect(mockSetGatekeeperActive).toHaveBeenCalledWith(false)
            } else {
              expect(mockUnlockAllQuestions).not.toHaveBeenCalled()
              expect(mockSetGatekeeperActive).not.toHaveBeenCalledWith(false)
            }
          }
        }
      ),
      {
        numRuns: 50, // Reduced from 100 for faster execution
        verbose: true,
      }
    )
  })

  /**
   * Property 8.5: Single unlock event per passage
   * 
   * For any reading passage, scrolling to bottom multiple times
   * SHALL trigger unlock only once (idempotency)
   * 
   * **Validates: Requirements 11.3**
   */
  it('Property 8.5: should unlock only once even with multiple scrolls at bottom', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate passage content
        fc.string({ minLength: 20, maxLength: 500 }),
        // Generate number of scroll events at bottom
        fc.integer({ min: 2, max: 10 }),
        // Generate scroll position at bottom
        fc.record({
          clientHeight: fc.integer({ min: 100, max: 1000 }),
          scrollHeight: fc.integer({ min: 200, max: 2000 }),
        }).chain(({ clientHeight, scrollHeight }) => {
          const scrollTop = Math.max(0, scrollHeight - clientHeight)
          return fc.constant({ scrollTop, clientHeight, scrollHeight })
        }),
        async (passage, numScrolls, scrollMetrics) => {
          // Reset mocks
          mockSetGatekeeperActive.mockClear()
          mockUnlockAllQuestions.mockClear()

          // Render component
          const { container } = render(
            <PassageViewer passage={passage} questionIds={['q1']}>
              <div>Questions</div>
            </PassageViewer>
          )

          // Wait for initial setup
          await waitFor(() => {
            expect(mockSetGatekeeperActive).toHaveBeenCalled()
          })

          // Simulate scroll to bottom
          const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement
          if (passageContainer) {
            Object.defineProperty(passageContainer, 'scrollTop', {
              value: scrollMetrics.scrollTop,
              writable: true,
            })
            Object.defineProperty(passageContainer, 'clientHeight', {
              value: scrollMetrics.clientHeight,
              writable: true,
            })
            Object.defineProperty(passageContainer, 'scrollHeight', {
              value: scrollMetrics.scrollHeight,
              writable: true,
            })

            // Clear mocks before scroll events
            mockUnlockAllQuestions.mockClear()

            // Trigger multiple scroll events at bottom
            for (let i = 0; i < numScrolls; i++) {
              passageContainer.dispatchEvent(new Event('scroll'))
            }

            // Verify unlockAllQuestions was called exactly once
            expect(mockUnlockAllQuestions).toHaveBeenCalledTimes(1)
          }
        }
      ),
      {
        numRuns: 30,
        verbose: true,
      }
    )
  })

  /**
   * Property 8.6: Gatekeeper reset on passage change
   * 
   * For any sequence of two different passages,
   * changing from one passage to another SHALL reset gatekeeper state
   * 
   * **Validates: Requirements 11.1**
   */
  it('Property 8.6: should reset gatekeeper when passage changes', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate two different passages
        fc.tuple(
          fc.string({ minLength: 10, maxLength: 200 }),
          fc.string({ minLength: 10, maxLength: 200 })
        ).filter(([p1, p2]) => p1 !== p2), // Ensure passages are different
        // Generate question IDs
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 }),
        async ([passage1, passage2], questionIds) => {
          // Reset mocks
          mockSetGatekeeperActive.mockClear()
          mockLockQuestion.mockClear()

          // Render with first passage
          const { rerender } = render(
            <PassageViewer passage={passage1} questionIds={questionIds}>
              <div>Questions</div>
            </PassageViewer>
          )

          // Wait for initial setup
          await waitFor(() => {
            expect(mockSetGatekeeperActive).toHaveBeenCalledWith(true)
          })

          // Clear mocks
          mockSetGatekeeperActive.mockClear()
          mockLockQuestion.mockClear()

          // Change to second passage
          rerender(
            <PassageViewer passage={passage2} questionIds={questionIds}>
              <div>Questions</div>
            </PassageViewer>
          )

          // Verify gatekeeper is re-activated for new passage
          await waitFor(() => {
            expect(mockSetGatekeeperActive).toHaveBeenCalledWith(true)
          })

          // Verify questions are re-locked
          await waitFor(() => {
            questionIds.forEach((qId) => {
              expect(mockLockQuestion).toHaveBeenCalledWith(qId)
            })
          })
        }
      ),
      {
        numRuns: 30,
        verbose: true,
      }
    )
  })
})
