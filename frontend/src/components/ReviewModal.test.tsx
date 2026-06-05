/**
 * Unit Tests for ReviewModal Component
 * 
 * Tests question status display, navigation on question click, modal open/close behavior,
 * and error handling when modal fails to display.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewModal } from './ReviewModal'
import { useUIStore } from '../stores/uiStore'
import { useExamStore } from '../stores/examStore'

// Mock the stores
vi.mock('../stores/uiStore')
vi.mock('../stores/examStore')

describe('ReviewModal Component', () => {
  const mockCloseReviewModal = vi.fn()
  const mockGoToQuestion = vi.fn()

  // Sample question IDs for testing
  const sampleQuestionIds = [
    'q1', 'q2', 'q3', 'q4', 'q5',
    'q6', 'q7', 'q8', 'q9', 'q10',
    'q11', 'q12', 'q13', 'q14', 'q15',
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    vi.mocked(useUIStore).mockReturnValue({
      isReviewModalOpen: true,
      closeReviewModal: mockCloseReviewModal,
    } as ReturnType<typeof useUIStore>)

    vi.mocked(useExamStore).mockReturnValue({
      answers: new Map(),
      goToQuestion: mockGoToQuestion,
      currentQuestionIndex: 0,
    } as unknown as ReturnType<typeof useExamStore>)
  })

  describe('Modal Display (Requirement 12.1)', () => {
    it('should display modal when isReviewModalOpen is true', () => {
      render(<ReviewModal questionIds={sampleQuestionIds} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Review Questions')).toBeInTheDocument()
    })

    it('should not display modal when isReviewModalOpen is false', () => {
      vi.mocked(useUIStore).mockReturnValue({
        isReviewModalOpen: false,
        closeReviewModal: mockCloseReviewModal,
      } as ReturnType<typeof useUIStore>)

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should have modal overlay with dark background', () => {
      const { container } = render(<ReviewModal questionIds={sampleQuestionIds} />)

      const overlay = container.querySelector('.bg-black.bg-opacity-70')
      expect(overlay).toBeInTheDocument()
    })

    it('should have proper ARIA attributes for accessibility', () => {
      render(<ReviewModal questionIds={sampleQuestionIds} />)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'review-modal-title')
    })
  })

  describe('Question Status Display (Requirement 12.3)', () => {
    it('should display answered questions in green', () => {
      const answersMap = new Map([
        ['q1', 'answer1'],
        ['q3', 'answer3'],
      ])

      vi.mocked(useExamStore).mockReturnValue({
        answers: answersMap,
        goToQuestion: mockGoToQuestion,
        currentQuestionIndex: 5,
      } as unknown as ReturnType<typeof useExamStore>)

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      const question1Button = screen.getByLabelText(/Question 1.*Answered/)
      expect(question1Button).toHaveClass('bg-green-500')

      const question3Button = screen.getByLabelText(/Question 3.*Answered/)
      expect(question3Button).toHaveClass('bg-green-500')
    })

    it('should display unanswered but seen questions in yellow', () => {
      vi.mocked(useExamStore).mockReturnValue({
        answers: new Map(),
        goToQuestion: mockGoToQuestion,
        currentQuestionIndex: 5, // Questions 0-5 are seen
      } as unknown as ReturnType<typeof useExamStore>)

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      // Question 2 (index 1) should be unanswered but seen
      const question2Button = screen.getByLabelText(/Question 2.*Unanswered/)
      expect(question2Button).toHaveClass('bg-yellow-500')

      // Question 5 (index 4) should be unanswered but seen
      const question5Button = screen.getByLabelText(/Question 5.*Unanswered/)
      expect(question5Button).toHaveClass('bg-yellow-500')
    })

    it('should display not seen questions in gray', () => {
      vi.mocked(useExamStore).mockReturnValue({
        answers: new Map(),
        goToQuestion: mockGoToQuestion,
        currentQuestionIndex: 3, // Only questions 0-3 are seen
      } as unknown as ReturnType<typeof useExamStore>)

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      // Question 10 (index 9) should be not seen
      const question10Button = screen.getByLabelText(/Question 10.*Not seen/)
      expect(question10Button).toHaveClass('bg-gray-400')

      // Question 15 (index 14) should be not seen
      const question15Button = screen.getByLabelText(/Question 15.*Not seen/)
      expect(question15Button).toHaveClass('bg-gray-400')
    })

    it('should display legend with status indicators', () => {
      render(<ReviewModal questionIds={sampleQuestionIds} />)

      expect(screen.getByText('Answered')).toBeInTheDocument()
      expect(screen.getByText('Unanswered')).toBeInTheDocument()
      expect(screen.getByText('Not Seen')).toBeInTheDocument()
    })

    it('should display all questions in grid layout', () => {
      render(<ReviewModal questionIds={sampleQuestionIds} />)

      for (let i = 1; i <= sampleQuestionIds.length; i++) {
        expect(screen.getByText(i.toString())).toBeInTheDocument()
      }
    })

    it('should highlight current question with ring', () => {
      vi.mocked(useExamStore).mockReturnValue({
        answers: new Map(),
        goToQuestion: mockGoToQuestion,
        currentQuestionIndex: 7, // Question 8 is current
      } as unknown as ReturnType<typeof useExamStore>)

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      const currentButton = screen.getByLabelText(/Question 8.*\(current\)/)
      expect(currentButton).toHaveClass('ring-2', 'ring-white')
    })
  })

  describe('Navigation on Question Click (Requirement 12.4)', () => {
    it('should navigate to question when clicked', async () => {
      const user = userEvent.setup()

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      const question5Button = screen.getByText('5')
      await user.click(question5Button)

      expect(mockGoToQuestion).toHaveBeenCalledWith(4) // Index 4 for question 5
    })

    it('should close modal after navigating to question', async () => {
      const user = userEvent.setup()

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      const question3Button = screen.getByText('3')
      await user.click(question3Button)

      expect(mockCloseReviewModal).toHaveBeenCalledOnce()
    })

    it('should navigate to first question', async () => {
      const user = userEvent.setup()

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      const question1Button = screen.getByText('1')
      await user.click(question1Button)

      expect(mockGoToQuestion).toHaveBeenCalledWith(0)
      expect(mockCloseReviewModal).toHaveBeenCalledOnce()
    })

    it('should navigate to last question', async () => {
      const user = userEvent.setup()

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      const lastQuestionButton = screen.getByText('15')
      await user.click(lastQuestionButton)

      expect(mockGoToQuestion).toHaveBeenCalledWith(14) // Index 14 for question 15
      expect(mockCloseReviewModal).toHaveBeenCalledOnce()
    })

    it('should navigate to middle question', async () => {
      const user = userEvent.setup()

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      const question8Button = screen.getByText('8')
      await user.click(question8Button)

      expect(mockGoToQuestion).toHaveBeenCalledWith(7) // Index 7 for question 8
      expect(mockCloseReviewModal).toHaveBeenCalledOnce()
    })
  })

  describe('Modal Open/Close Behavior (Requirement 12.1, 12.4)', () => {
    it('should close modal when close button is clicked', async () => {
      const user = userEvent.setup()

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      const closeButton = screen.getByText('Close')
      await user.click(closeButton)

      expect(mockCloseReviewModal).toHaveBeenCalledOnce()
    })

    it('should close modal when X button is clicked', async () => {
      const user = userEvent.setup()

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      const xButton = screen.getByText('×')
      await user.click(xButton)

      expect(mockCloseReviewModal).toHaveBeenCalledOnce()
    })

    it('should close modal when overlay background is clicked', async () => {
      const user = userEvent.setup()

      const { container } = render(<ReviewModal questionIds={sampleQuestionIds} />)

      const overlay = container.querySelector('.fixed.inset-0')
      expect(overlay).toBeInTheDocument()

      await user.click(overlay!)

      expect(mockCloseReviewModal).toHaveBeenCalledOnce()
    })

    it('should not close modal when clicking inside modal content', async () => {
      const user = userEvent.setup()

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      const modalContent = screen.getByText('Review Questions')
      await user.click(modalContent)

      expect(mockCloseReviewModal).not.toHaveBeenCalled()
    })

    it('should have close button in footer', () => {
      render(<ReviewModal questionIds={sampleQuestionIds} />)

      const footerCloseButton = screen.getByRole('button', { name: /^Close review modal$/ })
      expect(footerCloseButton).toBeInTheDocument()
      expect(footerCloseButton).toHaveClass('bg-ets-blue')
    })
  })

  describe('Error Handling - Silent Failure (Requirement 12.2)', () => {
    it('should fail silently if modal fails to display', () => {
      // Simulate error condition - modal is requested but fails to open
      vi.mocked(useUIStore).mockReturnValue({
        isReviewModalOpen: false, // Modal state indicates closed/failed
        closeReviewModal: mockCloseReviewModal,
      } as ReturnType<typeof useUIStore>)

      // Should not throw error
      expect(() => {
        render(<ReviewModal questionIds={sampleQuestionIds} />)
      }).not.toThrow()

      // Should return null gracefully (no content rendered)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should handle empty question list gracefully', () => {
      expect(() => {
        render(<ReviewModal questionIds={[]} />)
      }).not.toThrow()

      // Modal should still render but with empty grid
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Review Questions')).toBeInTheDocument()
    })

    it('should handle null/undefined answers gracefully', () => {
      vi.mocked(useExamStore).mockReturnValue({
        answers: new Map(),
        goToQuestion: mockGoToQuestion,
        currentQuestionIndex: 0,
      } as unknown as ReturnType<typeof useExamStore>)

      expect(() => {
        render(<ReviewModal questionIds={sampleQuestionIds} />)
      }).not.toThrow()

      // Should display all questions as not answered
      const buttons = screen.getAllByRole('button')
      const questionButtons = buttons.filter(b => /Question \d+/.test(b.getAttribute('aria-label') || ''))
      
      // All should be either unanswered or not-seen (not green)
      questionButtons.forEach(button => {
        expect(button).not.toHaveClass('bg-green-500')
      })
    })

    it('should handle invalid currentQuestionIndex gracefully', () => {
      vi.mocked(useExamStore).mockReturnValue({
        answers: new Map(),
        goToQuestion: mockGoToQuestion,
        currentQuestionIndex: -1, // Invalid index
      } as unknown as ReturnType<typeof useExamStore>)

      expect(() => {
        render(<ReviewModal questionIds={sampleQuestionIds} />)
      }).not.toThrow()

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  describe('MaxQuestions Prop', () => {
    it('should limit displayed questions when maxQuestions is provided', () => {
      render(<ReviewModal questionIds={sampleQuestionIds} maxQuestions={5} />)

      // Should only display first 5 questions
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.queryByText('6')).not.toBeInTheDocument()
      expect(screen.queryByText('15')).not.toBeInTheDocument()
    })

    it('should display all questions when maxQuestions is not provided', () => {
      render(<ReviewModal questionIds={sampleQuestionIds} />)

      // Should display all 15 questions
      for (let i = 1; i <= 15; i++) {
        expect(screen.getByText(i.toString())).toBeInTheDocument()
      }
    })

    it('should display all questions when maxQuestions exceeds question count', () => {
      render(<ReviewModal questionIds={sampleQuestionIds} maxQuestions={20} />)

      // Should display all 15 questions (not 20)
      for (let i = 1; i <= 15; i++) {
        expect(screen.getByText(i.toString())).toBeInTheDocument()
      }
    })
  })

  describe('Accessibility (Requirement 23.1, 23.2)', () => {
    it('should have proper ARIA labels for all buttons', () => {
      render(<ReviewModal questionIds={sampleQuestionIds.slice(0, 3)} />)

      expect(screen.getByLabelText(/Question 1/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Question 2/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Question 3/)).toBeInTheDocument()
    })

    it('should support keyboard navigation for question buttons', async () => {
      const user = userEvent.setup()

      render(<ReviewModal questionIds={sampleQuestionIds.slice(0, 3)} />)

      const question1Button = screen.getByLabelText(/Question 1/)
      question1Button.focus()

      expect(question1Button).toHaveFocus()

      await user.keyboard('{Enter}')

      expect(mockGoToQuestion).toHaveBeenCalledWith(0)
    })

    it('should support keyboard navigation for close button', async () => {
      const user = userEvent.setup()

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      const closeButton = screen.getByRole('button', { name: /^Close review modal$/ })
      closeButton.focus()

      expect(closeButton).toHaveFocus()

      await user.keyboard('{Enter}')

      expect(mockCloseReviewModal).toHaveBeenCalledOnce()
    })

    it('should allow tab navigation through questions', async () => {
      const user = userEvent.setup()

      render(<ReviewModal questionIds={sampleQuestionIds.slice(0, 3)} />)

      // Tab through question buttons
      await user.tab()
      await user.tab()
      
      // One of the question buttons should have focus
      const focusedElement = document.activeElement
      expect(focusedElement?.getAttribute('aria-label')).toMatch(/Question \d+/)
    })

    it('should have semantic HTML for modal structure', () => {
      render(<ReviewModal questionIds={sampleQuestionIds} />)

      // Should use dialog role
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Should have heading
      const heading = screen.getByText('Review Questions')
      expect(heading.tagName).toBe('H2')
    })

    it('should provide title attributes for buttons', () => {
      render(<ReviewModal questionIds={sampleQuestionIds.slice(0, 1)} />)

      const question1Button = screen.getByText('1')
      expect(question1Button).toHaveAttribute('title')
      expect(question1Button.getAttribute('title')).toContain('Question 1')
    })

    it('should have visible focus indicators', () => {
      render(<ReviewModal questionIds={sampleQuestionIds.slice(0, 1)} />)

      const question1Button = screen.getByText('1')
      expect(question1Button).toHaveClass('focus:ring-2', 'focus:ring-white')
    })
  })

  describe('Visual Styling (Requirement 10.2)', () => {
    it('should use official ETS color scheme', () => {
      const { container } = render(<ReviewModal questionIds={sampleQuestionIds} />)

      // Should use ETS charcoal background
      const modalContent = container.querySelector('.bg-ets-charcoal')
      expect(modalContent).toBeInTheDocument()

      // Should use ETS blue for close button (footer button)
      const closeButtons = screen.getAllByRole('button', { name: 'Close review modal' })
      const footerCloseButton = closeButtons.find(button => button.classList.contains('bg-ets-blue'))
      expect(footerCloseButton).toHaveClass('bg-ets-blue')
    })

    it('should have responsive grid layout', () => {
      const { container } = render(<ReviewModal questionIds={sampleQuestionIds} />)

      const grid = container.querySelector('.grid')
      expect(grid).toHaveClass('grid-cols-5', 'sm:grid-cols-6', 'md:grid-cols-8', 'lg:grid-cols-10')
    })

    it('should have proper spacing and padding', () => {
      const { container } = render(<ReviewModal questionIds={sampleQuestionIds} />)

      const modalContent = container.querySelector('.bg-ets-charcoal')
      expect(modalContent).toHaveClass('rounded-lg', 'shadow-xl')
    })
  })

  describe('Integration - Multiple Status Types', () => {
    it('should correctly display mixed question statuses', () => {
      const answersMap = new Map([
        ['q1', 'answer1'],
        ['q2', 'answer2'],
        ['q5', 'answer5'],
      ])

      vi.mocked(useExamStore).mockReturnValue({
        answers: answersMap,
        goToQuestion: mockGoToQuestion,
        currentQuestionIndex: 7, // Questions 0-7 are seen
      } as unknown as ReturnType<typeof useExamStore>)

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      // Question 1 & 2 & 5: answered (green)
      expect(screen.getByLabelText(/Question 1.*Answered/)).toHaveClass('bg-green-500')
      expect(screen.getByLabelText(/Question 2.*Answered/)).toHaveClass('bg-green-500')
      expect(screen.getByLabelText(/Question 5.*Answered/)).toHaveClass('bg-green-500')

      // Question 3, 4, 6, 7: unanswered but seen (yellow)
      expect(screen.getByLabelText(/Question 3.*Unanswered/)).toHaveClass('bg-yellow-500')
      expect(screen.getByLabelText(/Question 4.*Unanswered/)).toHaveClass('bg-yellow-500')
      expect(screen.getByLabelText(/Question 6.*Unanswered/)).toHaveClass('bg-yellow-500')
      expect(screen.getByLabelText(/Question 7.*Unanswered/)).toHaveClass('bg-yellow-500')

      // Question 9+: not seen (gray)
      expect(screen.getByLabelText(/Question 9.*Not seen/)).toHaveClass('bg-gray-400')
      expect(screen.getByLabelText(/Question 10.*Not seen/)).toHaveClass('bg-gray-400')
    })

    it('should handle sequential question clicks', async () => {
      const user = userEvent.setup()

      const { unmount } = render(<ReviewModal questionIds={sampleQuestionIds} />)

      // Click question 3
      await user.click(screen.getByLabelText(/^Question 3:/))
      expect(mockGoToQuestion).toHaveBeenCalledWith(2)
      expect(mockCloseReviewModal).toHaveBeenCalledOnce()

      // Unmount the previous render
      unmount()

      // Reset mocks
      vi.clearAllMocks()

      // Re-render to simulate modal reopening
      render(<ReviewModal questionIds={sampleQuestionIds} />)

      // Click question 7 (there should only be one now)
      const question7Buttons = screen.getAllByLabelText(/^Question 7:/)
      expect(question7Buttons.length).toBe(1)
      await user.click(question7Buttons[0])
      expect(mockGoToQuestion).toHaveBeenCalledWith(6)
      expect(mockCloseReviewModal).toHaveBeenCalledOnce()
    })
  })

  describe('Edge Cases', () => {
    it('should handle single question', () => {
      render(<ReviewModal questionIds={['q1']} />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.queryByText('2')).not.toBeInTheDocument()
    })

    it('should handle large number of questions', () => {
      const manyQuestions = Array.from({ length: 100 }, (_, i) => `q${i + 1}`)

      render(<ReviewModal questionIds={manyQuestions} />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('50')).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument()
    })

    it('should handle all questions answered', () => {
      const allAnswered = new Map(
        sampleQuestionIds.map(id => [id, `answer-${id}`])
      )

      vi.mocked(useExamStore).mockReturnValue({
        answers: allAnswered,
        goToQuestion: mockGoToQuestion,
        currentQuestionIndex: 10,
      } as unknown as ReturnType<typeof useExamStore>)

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      // All questions should be green (answered)
      for (let i = 1; i <= sampleQuestionIds.length; i++) {
        const button = screen.getByLabelText(new RegExp(`^Question ${i}:.*Answered`))
        expect(button).toHaveClass('bg-green-500')
      }
    })

    it('should handle all questions not seen', () => {
      vi.mocked(useExamStore).mockReturnValue({
        answers: new Map(),
        goToQuestion: mockGoToQuestion,
        currentQuestionIndex: -1, // No questions seen
      } as unknown as ReturnType<typeof useExamStore>)

      render(<ReviewModal questionIds={sampleQuestionIds} />)

      // All questions should be gray (not seen)
      for (let i = 1; i <= sampleQuestionIds.length; i++) {
        const button = screen.getByLabelText(new RegExp(`^Question ${i}:.*Not seen`))
        expect(button).toHaveClass('bg-gray-400')
      }
    })
  })
})
