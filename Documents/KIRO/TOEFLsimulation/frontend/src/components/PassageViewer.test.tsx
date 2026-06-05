import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PassageViewer } from './PassageViewer'
import { useUIStore } from '../stores/uiStore'

// Mock the uiStore
vi.mock('../stores/uiStore', () => ({
  useUIStore: vi.fn(),
}))

describe('PassageViewer', () => {
  const mockPassage = `This is the first paragraph of the reading passage.

This is the second paragraph with more content to test scrolling behavior.

This is the third paragraph to ensure there is enough content for scrolling.`

  const mockOnPassageFullyScrolled = vi.fn()
  const mockSetGatekeeperActive = vi.fn()
  const mockUnlockAllQuestions = vi.fn()
  const mockLockQuestion = vi.fn()
  
  const mockQuestionIds = ['q1', 'q2', 'q3']

  beforeEach(() => {
    mockOnPassageFullyScrolled.mockClear()
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

  describe('Component Rendering', () => {
    it('should render split-screen layout with questions and passage', () => {
      render(
        <PassageViewer 
          passage={mockPassage} 
          onPassageFullyScrolled={mockOnPassageFullyScrolled}
          questionIds={mockQuestionIds}
        >
          <div data-testid="question-content">Question 1: What is the main idea?</div>
        </PassageViewer>
      )

      // Verify questions are rendered on left side
      expect(screen.getByTestId('question-content')).toBeInTheDocument()
      expect(screen.getByText('Question 1: What is the main idea?')).toBeInTheDocument()

      // Verify passage content is rendered on right side
      expect(screen.getByText(/This is the first paragraph/)).toBeInTheDocument()
      expect(screen.getByText(/This is the second paragraph/)).toBeInTheDocument()
      expect(screen.getByText(/This is the third paragraph/)).toBeInTheDocument()
    })

    it('should render passage with proper paragraph formatting', () => {
      const { container } = render(
        <PassageViewer passage={mockPassage}>
          <div>Questions</div>
        </PassageViewer>
      )

      // Verify passage is split into separate paragraphs
      const paragraphs = container.querySelectorAll('p')
      expect(paragraphs.length).toBe(3)
    })

    it('should apply custom className when provided', () => {
      const { container } = render(
        <PassageViewer passage={mockPassage} className="custom-class">
          <div>Questions</div>
        </PassageViewer>
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('should render with default className when not provided', () => {
      const { container } = render(
        <PassageViewer passage={mockPassage}>
          <div>Questions</div>
        </PassageViewer>
      )

      // Should have base flex classes
      expect(container.firstChild).toHaveClass('flex')
    })
  })

  describe('Split-Screen Layout (Requirement 3.9)', () => {
    it('should display questions on left side', () => {
      const { container } = render(
        <PassageViewer passage={mockPassage}>
          <div data-testid="questions">Questions</div>
        </PassageViewer>
      )

      const leftPanel = container.querySelector('.lg\\:w-1\\/2:first-child')
      expect(leftPanel).toBeInTheDocument()
      expect(leftPanel).toContainElement(screen.getByTestId('questions'))
    })

    it('should display passage on right side', () => {
      const { container } = render(
        <PassageViewer passage={mockPassage}>
          <div>Questions</div>
        </PassageViewer>
      )

      const rightPanel = container.querySelector('.lg\\:w-1\\/2.bg-gray-800')
      expect(rightPanel).toBeInTheDocument()
      expect(rightPanel?.textContent).toContain('This is the first paragraph')
    })

    it('should apply scrollable container to passage', () => {
      const { container } = render(
        <PassageViewer passage={mockPassage}>
          <div>Questions</div>
        </PassageViewer>
      )

      const passageContainer = container.querySelector('.overflow-y-auto.p-8')
      expect(passageContainer).toBeInTheDocument()
    })
  })

  describe('Scroll Tracking (Requirement 11.2)', () => {
    it('should detect when passage is scrolled to bottom', () => {
      const { container } = render(
        <PassageViewer passage={mockPassage} onPassageFullyScrolled={mockOnPassageFullyScrolled}>
          <div>Questions</div>
        </PassageViewer>
      )

      const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement
      expect(passageContainer).toBeInTheDocument()

      // Mock scroll position at bottom
      Object.defineProperty(passageContainer, 'scrollTop', { value: 500, writable: true })
      Object.defineProperty(passageContainer, 'clientHeight', { value: 600, writable: true })
      Object.defineProperty(passageContainer, 'scrollHeight', { value: 1100, writable: true })

      // Trigger scroll event
      passageContainer.dispatchEvent(new Event('scroll'))

      // Callback should be called
      expect(mockOnPassageFullyScrolled).toHaveBeenCalledTimes(1)
    })

    it('should use correct formula: scrollTop + clientHeight >= scrollHeight', () => {
      const { container } = render(
        <PassageViewer passage={mockPassage} onPassageFullyScrolled={mockOnPassageFullyScrolled}>
          <div>Questions</div>
        </PassageViewer>
      )

      const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement

      // Test exact boundary: scrollTop + clientHeight = scrollHeight
      Object.defineProperty(passageContainer, 'scrollTop', { value: 400, writable: true })
      Object.defineProperty(passageContainer, 'clientHeight', { value: 600, writable: true })
      Object.defineProperty(passageContainer, 'scrollHeight', { value: 1000, writable: true })

      passageContainer.dispatchEvent(new Event('scroll'))

      expect(mockOnPassageFullyScrolled).toHaveBeenCalledTimes(1)
    })

    it('should handle 1px tolerance for rounding', () => {
      const { container } = render(
        <PassageViewer passage={mockPassage} onPassageFullyScrolled={mockOnPassageFullyScrolled}>
          <div>Questions</div>
        </PassageViewer>
      )

      const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement

      // Test with 1px below threshold (should still trigger)
      Object.defineProperty(passageContainer, 'scrollTop', { value: 399, writable: true })
      Object.defineProperty(passageContainer, 'clientHeight', { value: 600, writable: true })
      Object.defineProperty(passageContainer, 'scrollHeight', { value: 1000, writable: true })

      passageContainer.dispatchEvent(new Event('scroll'))

      expect(mockOnPassageFullyScrolled).toHaveBeenCalledTimes(1)
    })

    it('should not trigger callback when not at bottom', () => {
      const { container } = render(
        <PassageViewer passage={mockPassage} onPassageFullyScrolled={mockOnPassageFullyScrolled}>
          <div>Questions</div>
        </PassageViewer>
      )

      const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement

      // Mock scroll position not at bottom
      Object.defineProperty(passageContainer, 'scrollTop', { value: 100, writable: true })
      Object.defineProperty(passageContainer, 'clientHeight', { value: 600, writable: true })
      Object.defineProperty(passageContainer, 'scrollHeight', { value: 1000, writable: true })

      // Trigger scroll event
      passageContainer.dispatchEvent(new Event('scroll'))

      // Callback should NOT be called
      expect(mockOnPassageFullyScrolled).not.toHaveBeenCalled()
    })

    it('should only trigger callback once even with multiple scrolls at bottom', () => {
      const { container } = render(
        <PassageViewer passage={mockPassage} onPassageFullyScrolled={mockOnPassageFullyScrolled}>
          <div>Questions</div>
        </PassageViewer>
      )

      const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement

      // Mock scroll position at bottom
      Object.defineProperty(passageContainer, 'scrollTop', { value: 400, writable: true })
      Object.defineProperty(passageContainer, 'clientHeight', { value: 600, writable: true })
      Object.defineProperty(passageContainer, 'scrollHeight', { value: 1000, writable: true })

      // Trigger scroll event multiple times
      passageContainer.dispatchEvent(new Event('scroll'))
      passageContainer.dispatchEvent(new Event('scroll'))
      passageContainer.dispatchEvent(new Event('scroll'))

      // Callback should only be called once
      expect(mockOnPassageFullyScrolled).toHaveBeenCalledTimes(1)
    })

    it('should work without onPassageFullyScrolled callback', () => {
      const { container } = render(
        <PassageViewer passage={mockPassage}>
          <div>Questions</div>
        </PassageViewer>
      )

      const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement

      // Mock scroll position at bottom
      Object.defineProperty(passageContainer, 'scrollTop', { value: 400, writable: true })
      Object.defineProperty(passageContainer, 'clientHeight', { value: 600, writable: true })
      Object.defineProperty(passageContainer, 'scrollHeight', { value: 1000, writable: true })

      // Should not throw error
      expect(() => {
        passageContainer.dispatchEvent(new Event('scroll'))
      }).not.toThrow()
    })

    it('should reset scroll tracking when passage changes', () => {
      const { container, rerender } = render(
        <PassageViewer passage={mockPassage} onPassageFullyScrolled={mockOnPassageFullyScrolled}>
          <div>Questions</div>
        </PassageViewer>
      )

      const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement

      // First scroll to bottom
      Object.defineProperty(passageContainer, 'scrollTop', { value: 400, writable: true })
      Object.defineProperty(passageContainer, 'clientHeight', { value: 600, writable: true })
      Object.defineProperty(passageContainer, 'scrollHeight', { value: 1000, writable: true })
      passageContainer.dispatchEvent(new Event('scroll'))

      expect(mockOnPassageFullyScrolled).toHaveBeenCalledTimes(1)

      // Change passage
      const newPassage = 'New passage content'
      rerender(
        <PassageViewer passage={newPassage} onPassageFullyScrolled={mockOnPassageFullyScrolled}>
          <div>Questions</div>
        </PassageViewer>
      )

      // Scroll to bottom again
      passageContainer.dispatchEvent(new Event('scroll'))

      // Should trigger callback again (count = 2)
      expect(mockOnPassageFullyScrolled).toHaveBeenCalledTimes(2)
    })
  })

  describe('ETS Split-Screen Design (Requirement 10.3)', () => {
    it('should apply official ETS styling to left panel (questions)', () => {
      const { container } = render(
        <PassageViewer passage={mockPassage}>
          <div>Questions</div>
        </PassageViewer>
      )

      const leftPanel = container.querySelector('.bg-gray-900')
      expect(leftPanel).toBeInTheDocument()
      expect(leftPanel).toHaveClass('p-6', 'overflow-y-auto')
    })

    it('should apply official ETS styling to right panel (passage)', () => {
      const { container } = render(
        <PassageViewer passage={mockPassage}>
          <div>Questions</div>
        </PassageViewer>
      )

      const rightPanel = container.querySelector('.bg-gray-800.border-l.border-gray-700')
      expect(rightPanel).toBeInTheDocument()
    })

    it('should apply responsive layout classes', () => {
      const { container } = render(
        <PassageViewer passage={mockPassage}>
          <div>Questions</div>
        </PassageViewer>
      )

      // Root container should have flex layout with responsive breakpoints
      expect(container.firstChild).toHaveClass('flex', 'flex-col', 'lg:flex-row')
    })

    it('should apply prose styling to passage text', () => {
      const { container } = render(
        <PassageViewer passage={mockPassage}>
          <div>Questions</div>
        </PassageViewer>
      )

      const proseContainer = container.querySelector('.prose.prose-invert.prose-lg')
      expect(proseContainer).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty passage', () => {
      render(
        <PassageViewer passage="">
          <div>Questions</div>
        </PassageViewer>
      )

      // Should not crash
      expect(screen.getByText('Questions')).toBeInTheDocument()
    })

    it('should handle passage with single paragraph', () => {
      const singleParagraph = 'This is a single paragraph passage.'
      const { container } = render(
        <PassageViewer passage={singleParagraph}>
          <div>Questions</div>
        </PassageViewer>
      )

      const paragraphs = container.querySelectorAll('p')
      expect(paragraphs.length).toBe(1)
      expect(screen.getByText(singleParagraph)).toBeInTheDocument()
    })

    it('should handle multiple empty lines between paragraphs', () => {
      const passageWithEmptyLines = 'First paragraph.\n\n\n\nSecond paragraph.'
      const { container } = render(
        <PassageViewer passage={passageWithEmptyLines}>
          <div>Questions</div>
        </PassageViewer>
      )

      // Empty paragraphs will be rendered
      expect(container.querySelectorAll('p').length).toBeGreaterThan(0)
    })

    it('should handle very long passage content', () => {
      const longPassage = Array(100)
        .fill('This is a long paragraph with lots of content.')
        .join('\n\n')

      const { container } = render(
        <PassageViewer passage={longPassage}>
          <div>Questions</div>
        </PassageViewer>
      )

      // Verify the passage is rendered (check paragraph count)
      const paragraphs = container.querySelectorAll('p')
      expect(paragraphs.length).toBe(100)
    })
  })

  describe('Gatekeeper Rule Enforcement', () => {
    describe('Requirement 11.1: Lock questions when passage displayed (contentHeight > 0)', () => {
      it('should lock all questions when passage has content', async () => {
        render(
          <PassageViewer 
            passage={mockPassage} 
            questionIds={mockQuestionIds}
          >
            <div>Questions</div>
          </PassageViewer>
        )

        // Wait for useEffect to run
        await waitFor(() => {
          expect(mockSetGatekeeperActive).toHaveBeenCalledWith(true)
        })

        // Verify all questions are locked
        await waitFor(() => {
          mockQuestionIds.forEach((qId) => {
            expect(mockLockQuestion).toHaveBeenCalledWith(qId)
          })
        })
      })

      it('should activate gatekeeper when passage has content', async () => {
        render(
          <PassageViewer 
            passage={mockPassage} 
            questionIds={mockQuestionIds}
          >
            <div>Questions</div>
          </PassageViewer>
        )

        await waitFor(() => {
          expect(mockSetGatekeeperActive).toHaveBeenCalledWith(true)
        })
      })
    })

    describe('Requirement 11.3: Unlock questions when bottom reached', () => {
      it('should unlock all questions when scrolled to bottom', async () => {
        const { container } = render(
          <PassageViewer 
            passage={mockPassage} 
            onPassageFullyScrolled={mockOnPassageFullyScrolled}
            questionIds={mockQuestionIds}
          >
            <div>Questions</div>
          </PassageViewer>
        )

        const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement
        expect(passageContainer).toBeInTheDocument()

        // Mock scroll position at bottom
        Object.defineProperty(passageContainer, 'scrollTop', { value: 400, writable: true })
        Object.defineProperty(passageContainer, 'clientHeight', { value: 600, writable: true })
        Object.defineProperty(passageContainer, 'scrollHeight', { value: 1000, writable: true })

        // Trigger scroll event
        passageContainer.dispatchEvent(new Event('scroll'))

        // Verify gatekeeper is deactivated
        expect(mockSetGatekeeperActive).toHaveBeenCalledWith(false)
        
        // Verify all questions are unlocked
        expect(mockUnlockAllQuestions).toHaveBeenCalled()
        
        // Verify callback is called
        expect(mockOnPassageFullyScrolled).toHaveBeenCalledTimes(1)
      })

      it('should deactivate gatekeeper when scrolled to bottom', async () => {
        const { container } = render(
          <PassageViewer 
            passage={mockPassage} 
            questionIds={mockQuestionIds}
          >
            <div>Questions</div>
          </PassageViewer>
        )

        const passageContainer = container.querySelector('.overflow-y-auto.p-8') as HTMLDivElement

        // Mock scroll to bottom
        Object.defineProperty(passageContainer, 'scrollTop', { value: 400, writable: true })
        Object.defineProperty(passageContainer, 'clientHeight', { value: 600, writable: true })
        Object.defineProperty(passageContainer, 'scrollHeight', { value: 1000, writable: true })

        passageContainer.dispatchEvent(new Event('scroll'))

        expect(mockSetGatekeeperActive).toHaveBeenCalledWith(false)
      })
    })

    describe('Requirement 11.4: Handle passages with contentHeight = 0 (no locking)', () => {
      it('should not lock questions when passage is empty', async () => {
        render(
          <PassageViewer 
            passage="" 
            questionIds={mockQuestionIds}
          >
            <div>Questions</div>
          </PassageViewer>
        )

        await waitFor(() => {
          expect(mockSetGatekeeperActive).toHaveBeenCalledWith(false)
        })
        
        await waitFor(() => {
          expect(mockUnlockAllQuestions).toHaveBeenCalled()
        })
        
        // Lock should not be called for empty passage
        expect(mockLockQuestion).not.toHaveBeenCalled()
      })

      it('should not lock questions when passage is whitespace only', async () => {
        render(
          <PassageViewer 
            passage={`   

  `}
            questionIds={mockQuestionIds}
          >
            <div>Questions</div>
          </PassageViewer>
        )

        await waitFor(() => {
          expect(mockSetGatekeeperActive).toHaveBeenCalledWith(false)
        })
        
        await waitFor(() => {
          expect(mockUnlockAllQuestions).toHaveBeenCalled()
        })
      })

      it('should deactivate gatekeeper for empty passages', async () => {
        render(
          <PassageViewer 
            passage="" 
            questionIds={mockQuestionIds}
          >
            <div>Questions</div>
          </PassageViewer>
        )

        await waitFor(() => {
          expect(mockSetGatekeeperActive).toHaveBeenCalledWith(false)
        })
      })
    })

    describe('Gatekeeper State Management', () => {
      it('should reset gatekeeper when passage changes', async () => {
        const { rerender } = render(
          <PassageViewer 
            passage={mockPassage} 
            questionIds={mockQuestionIds}
          >
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

        // Change to new passage
        const newPassage = 'New passage content for testing.'
        rerender(
          <PassageViewer 
            passage={newPassage} 
            questionIds={mockQuestionIds}
          >
            <div>Questions</div>
          </PassageViewer>
        )

        // Should re-activate gatekeeper for new passage
        await waitFor(() => {
          expect(mockSetGatekeeperActive).toHaveBeenCalledWith(true)
        })
      })

      it('should handle questionIds changes correctly', async () => {
        const { rerender } = render(
          <PassageViewer 
            passage={mockPassage} 
            questionIds={['q1', 'q2']}
          >
            <div>Questions</div>
          </PassageViewer>
        )

        await waitFor(() => {
          expect(mockLockQuestion).toHaveBeenCalledWith('q1')
          expect(mockLockQuestion).toHaveBeenCalledWith('q2')
        })

        mockLockQuestion.mockClear()

        // Change questionIds
        rerender(
          <PassageViewer 
            passage={mockPassage} 
            questionIds={['q3', 'q4', 'q5']}
          >
            <div>Questions</div>
          </PassageViewer>
        )

        await waitFor(() => {
          expect(mockLockQuestion).toHaveBeenCalledWith('q3')
          expect(mockLockQuestion).toHaveBeenCalledWith('q4')
          expect(mockLockQuestion).toHaveBeenCalledWith('q5')
        })
      })

      it('should work without questionIds prop', async () => {
        render(
          <PassageViewer 
            passage={mockPassage}
          >
            <div>Questions</div>
          </PassageViewer>
        )

        // Should not crash when questionIds is undefined
        await waitFor(() => {
          expect(mockSetGatekeeperActive).toHaveBeenCalled()
        })
      })
    })
  })
})
