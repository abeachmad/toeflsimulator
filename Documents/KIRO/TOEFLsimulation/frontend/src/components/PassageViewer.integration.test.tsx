import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PassageViewer } from './PassageViewer'
import { LockedQuestionIndicator } from './LockedQuestionIndicator'
import { useUIStore, resetUIStore } from '../stores/uiStore'

/**
 * Integration tests for PassageViewer with LockedQuestionIndicator
 * Tests complete Gatekeeper workflow (Requirements 11.1-11.6)
 */
describe('PassageViewer + LockedQuestionIndicator Integration', () => {
  const mockPassage = `This is the first paragraph of the reading passage.

This is the second paragraph with more content to test scrolling behavior.

This is the third paragraph to ensure there is enough content for scrolling.

This is the fourth paragraph to add more length to the passage.

This is the fifth paragraph to make scrolling necessary.`

  const questionIds = ['q1', 'q2', 'q3']

  beforeEach(() => {
    // Reset UI store between tests
    resetUIStore()
  })

  describe('End-to-End Gatekeeper Workflow', () => {
    it('should lock questions when passage is displayed, then unlock when scrolled to bottom', async () => {
      const { container } = render(
        <PassageViewer passage={mockPassage} questionIds={questionIds}>
          <div className="space-y-4">
            <LockedQuestionIndicator questionId="q1">
              <div data-testid="question-1">
                <input type="text" data-testid="input-1" />
              </div>
            </LockedQuestionIndicator>

            <LockedQuestionIndicator questionId="q2">
              <div data-testid="question-2">
                <input type="text" data-testid="input-2" />
              </div>
            </LockedQuestionIndicator>

            <LockedQuestionIndicator questionId="q3">
              <div data-testid="question-3">
                <input type="text" data-testid="input-3" />
              </div>
            </LockedQuestionIndicator>
          </div>
        </PassageViewer>
      )

      // Wait for gatekeeper to activate
      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.isGatekeeperActive).toBe(true)
      })

      // Verify all questions are locked
      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.lockedQuestions.has('q1')).toBe(true)
        expect(store.lockedQuestions.has('q2')).toBe(true)
        expect(store.lockedQuestions.has('q3')).toBe(true)
      })

      // Verify lock indicators are visible
      expect(screen.getAllByText('Locked').length).toBe(3)

      // Verify overlays prevent input
      const input1 = screen.getByTestId('input-1')
      expect(input1.closest('.pointer-events-none')).toBeInTheDocument()

      // Simulate scrolling to bottom
      const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement
      Object.defineProperty(passageContainer, 'scrollTop', { value: 400, writable: true })
      Object.defineProperty(passageContainer, 'clientHeight', { value: 600, writable: true })
      Object.defineProperty(passageContainer, 'scrollHeight', { value: 1000, writable: true })

      passageContainer.dispatchEvent(new Event('scroll'))

      // Wait for gatekeeper to deactivate
      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.isGatekeeperActive).toBe(false)
      })

      // Verify all questions are unlocked
      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.lockedQuestions.size).toBe(0)
      })

      // Verify lock indicators are removed
      expect(screen.queryByText('Locked')).not.toBeInTheDocument()
    })

    it('should show notification when attempting to interact with locked question', async () => {
      const user = userEvent.setup()

      render(
        <PassageViewer passage={mockPassage} questionIds={questionIds}>
          <LockedQuestionIndicator questionId="q1">
            <div data-testid="question-1">
              <button data-testid="answer-button">Submit Answer</button>
            </div>
          </LockedQuestionIndicator>
        </PassageViewer>
      )

      // Wait for question to be locked
      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.lockedQuestions.has('q1')).toBe(true)
      })

      // Find the lock overlay (which covers the question content)
      const lockOverlay = screen.getByLabelText('Question locked until passage is read')

      // Click the overlay
      await user.click(lockOverlay)

      // Verify notification appears
      await waitFor(() => {
        expect(screen.getByText('Question Locked')).toBeInTheDocument()
        expect(
          screen.getByText(/Please scroll to the bottom of the passage/)
        ).toBeInTheDocument()
      })
    })

    it('should not lock questions when passage is empty', async () => {
      render(
        <PassageViewer passage="" questionIds={questionIds}>
          <div className="space-y-4">
            <LockedQuestionIndicator questionId="q1">
              <div data-testid="question-1">
                <input type="text" data-testid="input-1" />
              </div>
            </LockedQuestionIndicator>
          </div>
        </PassageViewer>
      )

      // Wait for initialization
      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.isGatekeeperActive).toBe(false)
      })

      // Verify questions are not locked
      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.lockedQuestions.size).toBe(0)
      })

      // Verify no lock indicators
      expect(screen.queryByText('Locked')).not.toBeInTheDocument()

      // Verify input is accessible (no pointer-events-none)
      const input1 = screen.getByTestId('input-1')
      expect(input1.closest('.pointer-events-none')).not.toBeInTheDocument()
    })

    it('should handle multiple questions with different lock states', async () => {
      const { container } = render(
        <PassageViewer passage={mockPassage} questionIds={['q1', 'q2']}>
          <div className="space-y-4">
            <LockedQuestionIndicator questionId="q1">
              <div data-testid="question-1">Question 1</div>
            </LockedQuestionIndicator>

            <LockedQuestionIndicator questionId="q2">
              <div data-testid="question-2">Question 2</div>
            </LockedQuestionIndicator>

            {/* Question 3 is not associated with passage (not in questionIds) */}
            <LockedQuestionIndicator questionId="q3">
              <div data-testid="question-3">Question 3</div>
            </LockedQuestionIndicator>
          </div>
        </PassageViewer>
      )

      // Wait for gatekeeper to activate
      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.isGatekeeperActive).toBe(true)
      })

      // Verify only q1 and q2 are locked (q3 not in questionIds)
      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.lockedQuestions.has('q1')).toBe(true)
        expect(store.lockedQuestions.has('q2')).toBe(true)
        expect(store.lockedQuestions.has('q3')).toBe(false)
      })

      // Verify only 2 lock indicators
      expect(screen.getAllByText('Locked').length).toBe(2)

      // Scroll to bottom
      const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement
      Object.defineProperty(passageContainer, 'scrollTop', { value: 400, writable: true })
      Object.defineProperty(passageContainer, 'clientHeight', { value: 600, writable: true })
      Object.defineProperty(passageContainer, 'scrollHeight', { value: 1000, writable: true })

      passageContainer.dispatchEvent(new Event('scroll'))

      // Wait for all questions to unlock
      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.lockedQuestions.size).toBe(0)
      })
    })

    it('should reset gatekeeper when passage changes', async () => {
      const { container, rerender } = render(
        <PassageViewer passage={mockPassage} questionIds={questionIds}>
          <LockedQuestionIndicator questionId="q1">
            <div data-testid="question-1">Question 1</div>
          </LockedQuestionIndicator>
        </PassageViewer>
      )

      // Wait for initial lock
      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.lockedQuestions.has('q1')).toBe(true)
      })

      // Scroll to bottom to unlock
      const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement
      Object.defineProperty(passageContainer, 'scrollTop', { value: 400, writable: true })
      Object.defineProperty(passageContainer, 'clientHeight', { value: 600, writable: true })
      Object.defineProperty(passageContainer, 'scrollHeight', { value: 1000, writable: true })

      passageContainer.dispatchEvent(new Event('scroll'))

      // Wait for unlock
      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.lockedQuestions.size).toBe(0)
      })

      // Change passage
      const newPassage = 'This is a completely new passage with different content.'
      rerender(
        <PassageViewer passage={newPassage} questionIds={questionIds}>
          <LockedQuestionIndicator questionId="q1">
            <div data-testid="question-1">Question 1</div>
          </LockedQuestionIndicator>
        </PassageViewer>
      )

      // Verify questions are locked again for new passage
      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.isGatekeeperActive).toBe(true)
        expect(store.lockedQuestions.has('q1')).toBe(true)
      })

      // Verify lock indicator is visible again
      expect(screen.getByText('Locked')).toBeInTheDocument()
    })
  })

  describe('Requirements Validation', () => {
    it('validates Requirement 11.1: Lock questions when contentHeight > 0', async () => {
      render(
        <PassageViewer passage={mockPassage} questionIds={questionIds}>
          <LockedQuestionIndicator questionId="q1">
            <div>Question</div>
          </LockedQuestionIndicator>
        </PassageViewer>
      )

      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.isGatekeeperActive).toBe(true)
        expect(store.lockedQuestions.has('q1')).toBe(true)
      })
    })

    it('validates Requirement 11.2: Track scroll position', async () => {
      const onScroll = vi.fn()
      const { container } = render(
        <PassageViewer passage={mockPassage} onPassageFullyScrolled={onScroll}>
          <div>Questions</div>
        </PassageViewer>
      )

      const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement

      // Trigger scroll event (not at bottom)
      Object.defineProperty(passageContainer, 'scrollTop', { value: 100, writable: true })
      Object.defineProperty(passageContainer, 'clientHeight', { value: 600, writable: true })
      Object.defineProperty(passageContainer, 'scrollHeight', { value: 1000, writable: true })

      passageContainer.dispatchEvent(new Event('scroll'))

      // Should not trigger callback
      expect(onScroll).not.toHaveBeenCalled()
    })

    it('validates Requirement 11.3: Unlock when bottom reached', async () => {
      const onScroll = vi.fn()
      const { container } = render(
        <PassageViewer passage={mockPassage} questionIds={questionIds} onPassageFullyScrolled={onScroll}>
          <LockedQuestionIndicator questionId="q1">
            <div>Question</div>
          </LockedQuestionIndicator>
        </PassageViewer>
      )

      // Wait for lock
      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.lockedQuestions.has('q1')).toBe(true)
      })

      // Scroll to bottom
      const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement
      Object.defineProperty(passageContainer, 'scrollTop', { value: 400, writable: true })
      Object.defineProperty(passageContainer, 'clientHeight', { value: 600, writable: true })
      Object.defineProperty(passageContainer, 'scrollHeight', { value: 1000, writable: true })

      passageContainer.dispatchEvent(new Event('scroll'))

      // Wait for unlock
      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.isGatekeeperActive).toBe(false)
        expect(store.lockedQuestions.size).toBe(0)
      })

      // Verify callback was called
      expect(onScroll).toHaveBeenCalledTimes(1)
    })

    it('validates Requirement 11.4: No locking for contentHeight = 0', async () => {
      render(
        <PassageViewer passage="" questionIds={questionIds}>
          <LockedQuestionIndicator questionId="q1">
            <div>Question</div>
          </LockedQuestionIndicator>
        </PassageViewer>
      )

      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.isGatekeeperActive).toBe(false)
        expect(store.lockedQuestions.size).toBe(0)
      })
    })

    it('validates Requirement 11.5: Visual indication of locked state', async () => {
      render(
        <PassageViewer passage={mockPassage} questionIds={questionIds}>
          <LockedQuestionIndicator questionId="q1">
            <div>Question</div>
          </LockedQuestionIndicator>
        </PassageViewer>
      )

      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.lockedQuestions.has('q1')).toBe(true)
      })

      // Verify lock indicator is visible
      expect(screen.getByText('Locked')).toBeInTheDocument()

      // Verify lock icon is present (SVG with lock path)
      const lockIcon = screen.getByText('Locked').previousSibling
      expect(lockIcon).toBeInTheDocument()
      expect(lockIcon?.nodeName).toBe('svg')
    })

    it('validates Requirement 11.6: Prevent input with notification', async () => {
      const user = userEvent.setup()

      render(
        <PassageViewer passage={mockPassage} questionIds={questionIds}>
          <LockedQuestionIndicator questionId="q1">
            <div data-testid="question-1">
              <input type="text" data-testid="input-1" />
            </div>
          </LockedQuestionIndicator>
        </PassageViewer>
      )

      await waitFor(() => {
        const store = useUIStore.getState()
        expect(store.lockedQuestions.has('q1')).toBe(true)
      })

      // Verify input is disabled via pointer-events-none
      const input = screen.getByTestId('input-1')
      expect(input.closest('.pointer-events-none')).toBeInTheDocument()

      // Click the lock overlay
      const lockOverlay = screen.getByLabelText('Question locked until passage is read')
      await user.click(lockOverlay)

      // Verify notification appears
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByText('Question Locked')).toBeInTheDocument()
      })
    })
  })
})
