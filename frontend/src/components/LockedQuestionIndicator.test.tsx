import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { LockedQuestionIndicator } from './LockedQuestionIndicator'
import { useUIStore } from '../stores/uiStore'

// Mock the uiStore
vi.mock('../stores/uiStore', () => ({
  useUIStore: vi.fn(),
}))

describe('LockedQuestionIndicator', () => {
  const mockQuestionId = 'q1'
  const mockLockedQuestions = new Set<string>()

  beforeEach(() => {
    mockLockedQuestions.clear()
    
    // Setup default mock implementation
    ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      lockedQuestions: mockLockedQuestions,
    })
  })

  describe('Unlocked State', () => {
    it('should render children without lock indicator when unlocked', () => {
      render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div data-testid="question-content">What is the capital of France?</div>
        </LockedQuestionIndicator>
      )

      // Verify children are rendered
      expect(screen.getByTestId('question-content')).toBeInTheDocument()
      expect(screen.getByText('What is the capital of France?')).toBeInTheDocument()

      // Verify no lock indicator
      expect(screen.queryByText('Locked')).not.toBeInTheDocument()
    })

    it('should not display overlay when unlocked', () => {
      const { container } = render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      // No overlay should exist
      const overlay = container.querySelector('.bg-opacity-70')
      expect(overlay).not.toBeInTheDocument()
    })

    it('should allow pointer events when unlocked', () => {
      const { container } = render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <button data-testid="submit-btn">Submit</button>
        </LockedQuestionIndicator>
      )

      const button = screen.getByTestId('submit-btn')
      expect(button).toBeInTheDocument()
      
      // Button should be clickable (not have pointer-events-none)
      const contentWrapper = container.querySelector('.pointer-events-none')
      expect(contentWrapper).not.toBeInTheDocument()
    })
  })

  describe('Requirement 11.5: Visual Lock Indicator', () => {
    it('should display lock icon when question is locked', () => {
      mockLockedQuestions.add(mockQuestionId)
      
      ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        lockedQuestions: mockLockedQuestions,
      })

      render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      // Verify lock indicator is displayed
      expect(screen.getByText('Locked')).toBeInTheDocument()
    })

    it('should display lock badge with amber background', () => {
      mockLockedQuestions.add(mockQuestionId)
      
      ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        lockedQuestions: mockLockedQuestions,
      })

      const { container } = render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      // Verify amber badge exists
      const lockBadge = container.querySelector('.bg-amber-600')
      expect(lockBadge).toBeInTheDocument()
      expect(lockBadge).toHaveTextContent('Locked')
    })

    it('should position lock indicator at top-right corner', () => {
      mockLockedQuestions.add(mockQuestionId)
      
      ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        lockedQuestions: mockLockedQuestions,
      })

      const { container } = render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      const lockBadge = container.querySelector('.top-0.right-0')
      expect(lockBadge).toBeInTheDocument()
    })

    it('should render lock SVG icon', () => {
      mockLockedQuestions.add(mockQuestionId)
      
      ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        lockedQuestions: mockLockedQuestions,
      })

      const { container } = render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      // Verify SVG icon exists
      const svgIcon = container.querySelector('svg')
      expect(svgIcon).toBeInTheDocument()
    })
  })

  describe('Requirement 11.6: Prevent Input and Display Notification', () => {
    it('should prevent input on locked questions with overlay', () => {
      mockLockedQuestions.add(mockQuestionId)
      
      ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        lockedQuestions: mockLockedQuestions,
      })

      const { container } = render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <button data-testid="submit-btn">Submit</button>
        </LockedQuestionIndicator>
      )

      // Verify overlay exists
      const overlay = container.querySelector('.bg-opacity-70')
      expect(overlay).toBeInTheDocument()

      // Verify pointer-events-none is applied to content
      const contentWrapper = container.querySelector('.pointer-events-none')
      expect(contentWrapper).toBeInTheDocument()
    })

    it('should display notification when clicking on locked question', async () => {
      mockLockedQuestions.add(mockQuestionId)
      
      ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        lockedQuestions: mockLockedQuestions,
      })

      const { container } = render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      // Click on the overlay
      const overlay = container.querySelector('.bg-opacity-70') as HTMLElement
      expect(overlay).toBeInTheDocument()
      
      fireEvent.click(overlay)

      // Verify notification appears
      await waitFor(() => {
        expect(screen.getByText('Question Locked')).toBeInTheDocument()
      })
      
      await waitFor(() => {
        expect(screen.getByText(/Please scroll to the bottom of the passage/)).toBeInTheDocument()
      })
    })

    it('should display notification message with correct text', async () => {
      mockLockedQuestions.add(mockQuestionId)
      
      ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        lockedQuestions: mockLockedQuestions,
      })

      const { container } = render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      const overlay = container.querySelector('.bg-opacity-70') as HTMLElement
      fireEvent.click(overlay)

      await waitFor(() => {
        expect(
          screen.getByText(/Please scroll to the bottom of the passage on the right to unlock this question/)
        ).toBeInTheDocument()
      })
    })

    it('should hide notification after 3 seconds', async () => {
      vi.useFakeTimers()
      
      mockLockedQuestions.add(mockQuestionId)
      
      ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        lockedQuestions: mockLockedQuestions,
      })

      const { container } = render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      const overlay = container.querySelector('.bg-opacity-70') as HTMLElement
      fireEvent.click(overlay)

      // Notification should appear immediately
      expect(screen.getByText('Question Locked')).toBeInTheDocument()

      // Advance time by 3 seconds using act
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000)
      })

      // Notification should disappear
      expect(screen.queryByText('Question Locked')).not.toBeInTheDocument()

      vi.useRealTimers()
    })

    it('should support keyboard interaction (Enter key)', async () => {
      mockLockedQuestions.add(mockQuestionId)
      
      ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        lockedQuestions: mockLockedQuestions,
      })

      const { container } = render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      const overlay = container.querySelector('.bg-opacity-70') as HTMLElement
      
      // Trigger Enter key
      fireEvent.keyDown(overlay, { key: 'Enter', code: 'Enter' })

      // Notification should appear immediately
      expect(screen.getByText('Question Locked')).toBeInTheDocument()
    })

    it('should support keyboard interaction (Space key)', async () => {
      mockLockedQuestions.add(mockQuestionId)
      
      ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        lockedQuestions: mockLockedQuestions,
      })

      const { container } = render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      const overlay = container.querySelector('.bg-opacity-70') as HTMLElement
      
      // Trigger Space key
      fireEvent.keyDown(overlay, { key: ' ', code: 'Space' })

      // Notification should appear immediately
      expect(screen.getByText('Question Locked')).toBeInTheDocument()
    })

    it('should have proper ARIA attributes for accessibility', () => {
      mockLockedQuestions.add(mockQuestionId)
      
      ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        lockedQuestions: mockLockedQuestions,
      })

      const { container } = render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      const overlay = container.querySelector('.bg-opacity-70') as HTMLElement
      
      expect(overlay).toHaveAttribute('aria-label', 'Question locked until passage is read')
      expect(overlay).toHaveAttribute('role', 'button')
      expect(overlay).toHaveAttribute('tabIndex', '0')
    })

    it('should display notification with alert role for screen readers', async () => {
      mockLockedQuestions.add(mockQuestionId)
      
      ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        lockedQuestions: mockLockedQuestions,
      })

      const { container } = render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      const overlay = container.querySelector('.bg-opacity-70') as HTMLElement
      fireEvent.click(overlay)

      // Notification should appear immediately with alert role
      const notification = screen.getByRole('alert')
      expect(notification).toBeInTheDocument()
    })
  })

  describe('State Transitions', () => {
    it('should handle transition from unlocked to locked', () => {
      const { rerender } = render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      // Initially unlocked
      expect(screen.queryByText('Locked')).not.toBeInTheDocument()

      // Lock the question
      mockLockedQuestions.add(mockQuestionId)
      ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        lockedQuestions: mockLockedQuestions,
      })

      rerender(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      // Should now show locked indicator
      expect(screen.getByText('Locked')).toBeInTheDocument()
    })

    it('should handle transition from locked to unlocked', () => {
      mockLockedQuestions.add(mockQuestionId)
      
      ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        lockedQuestions: mockLockedQuestions,
      })

      const { rerender } = render(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      // Initially locked
      expect(screen.getByText('Locked')).toBeInTheDocument()

      // Unlock the question
      mockLockedQuestions.delete(mockQuestionId)
      ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        lockedQuestions: mockLockedQuestions,
      })

      rerender(
        <LockedQuestionIndicator questionId={mockQuestionId}>
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      // Should no longer show locked indicator
      expect(screen.queryByText('Locked')).not.toBeInTheDocument()
    })
  })

  describe('Multiple Questions', () => {
    it('should lock only specific question, not others', () => {
      mockLockedQuestions.add('q1')
      
      ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        lockedQuestions: mockLockedQuestions,
      })

      const { container: container1 } = render(
        <LockedQuestionIndicator questionId="q1">
          <div data-testid="q1-content">Question 1</div>
        </LockedQuestionIndicator>
      )

      const { container: container2 } = render(
        <LockedQuestionIndicator questionId="q2">
          <div data-testid="q2-content">Question 2</div>
        </LockedQuestionIndicator>
      )

      // q1 should be locked
      expect(container1.querySelector('.bg-opacity-70')).toBeInTheDocument()

      // q2 should not be locked
      expect(container2.querySelector('.bg-opacity-70')).not.toBeInTheDocument()
    })
  })

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <LockedQuestionIndicator questionId={mockQuestionId} className="custom-class">
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('should maintain default classes with custom className', () => {
      const { container } = render(
        <LockedQuestionIndicator questionId={mockQuestionId} className="custom-class">
          <div>Question content</div>
        </LockedQuestionIndicator>
      )

      expect(container.firstChild).toHaveClass('relative', 'custom-class')
    })
  })
})
