import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ListeningQuestionDisplay, type ListeningQuestion } from './ListeningQuestionDisplay'
import { useExamStore } from '../stores/examStore'

// Mock stores
vi.mock('../stores/examStore', () => ({
  useExamStore: vi.fn()
}))

describe('ListeningQuestionDisplay', () => {
  const mockUpdateAnswer = vi.fn()
  const mockAnswers = new Map<string, string>()

  beforeEach(() => {
    vi.clearAllMocks()
    mockAnswers.clear()
    
    // Mock examStore
    ;(useExamStore as any).mockReturnValue({
      answers: mockAnswers,
      updateAnswer: mockUpdateAnswer
    })
  })

  describe('Choose Response Question Type', () => {
    const chooseResponseQuestion: ListeningQuestion = {
      id: 'cr-001',
      section: 'listening',
      type: 'choose-response',
      difficulty_level: 'easy',
      stage: 1,
      content: JSON.stringify({
        audioUrl: '/audio/listening/response-1.mp3',
        transcript: 'Brief audio prompt requiring response selection.',
        question: 'Choose the best response.'
      }),
      options: [
        'Yes, that sounds good',
        'No, I prefer another option',
        'Maybe we should reconsider',
        'I will think about it'
      ],
      correct_answer: 'Yes, that sounds good',
      irt_a: 1.2,
      irt_b: -0.3,
      irt_c: 0.2
    }

    it('should render choose response question with audio prompt', () => {
      render(<ListeningQuestionDisplay question={chooseResponseQuestion} />)

      expect(screen.getByText(/Listen to the audio and choose the best response/i)).toBeInTheDocument()
      // The question text appears in the question content area
      const questionElements = screen.getAllByText(/Choose the best response/i)
      expect(questionElements.length).toBeGreaterThan(0)
    })

    it('should render multiple choice options as radio buttons', () => {
      render(<ListeningQuestionDisplay question={chooseResponseQuestion} />)

      const radioButtons = screen.getAllByRole('radio')
      expect(radioButtons).toHaveLength(4)

      expect(screen.getByText(/Yes, that sounds good/i)).toBeInTheDocument()
      expect(screen.getByText(/No, I prefer another option/i)).toBeInTheDocument()
      expect(screen.getByText(/Maybe we should reconsider/i)).toBeInTheDocument()
      expect(screen.getByText(/I will think about it/i)).toBeInTheDocument()
    })

    it('should update examStore when option is selected (Requirement 13.3)', () => {
      render(<ListeningQuestionDisplay question={chooseResponseQuestion} />)

      const firstOption = screen.getByLabelText(/Option A:.*Yes, that sounds good/i)
      fireEvent.click(firstOption)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('cr-001', 'Yes, that sounds good')
    })

    it('should persist selected answer from examStore', () => {
      mockAnswers.set('cr-001', 'Maybe we should reconsider')

      render(<ListeningQuestionDisplay question={chooseResponseQuestion} />)

      const thirdOption = screen.getByLabelText(/Option C:.*Maybe we should reconsider/i) as HTMLInputElement
      expect(thirdOption.checked).toBe(true)
    })

    it('should allow changing answer within current module (Requirement 13.3)', () => {
      mockAnswers.set('cr-001', 'Yes, that sounds good')

      render(<ListeningQuestionDisplay question={chooseResponseQuestion} />)

      // Change answer from first to second option
      const secondOption = screen.getByLabelText(/Option B:.*No, I prefer another option/i)
      fireEvent.click(secondOption)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('cr-001', 'No, I prefer another option')
    })
  })

  describe('Conversation Question Type', () => {
    const conversationQuestion: ListeningQuestion = {
      id: 'conv-001',
      section: 'listening',
      type: 'conversation',
      difficulty_level: 'medium',
      stage: 1,
      content: JSON.stringify({
        audioUrl: '/audio/listening/conversation-1.mp3',
        transcript: 'Student and professor discussing course requirements.',
        question: 'What is the main topic of the conversation?'
      }),
      options: [
        'Course requirements',
        'Research project',
        'Assignment deadline',
        'Office hours'
      ],
      correct_answer: 'Course requirements',
      irt_a: 1.5,
      irt_b: 0.2,
      irt_c: 0.15
    }

    it('should render conversation question with audio indicator', () => {
      render(<ListeningQuestionDisplay question={conversationQuestion} />)

      expect(screen.getByText(/Listen to the conversation/i)).toBeInTheDocument()
      expect(screen.getByText(/What is the main topic of the conversation/i)).toBeInTheDocument()
    })

    it('should render multiple choice options', () => {
      render(<ListeningQuestionDisplay question={conversationQuestion} />)

      expect(screen.getByText('Course requirements')).toBeInTheDocument()
      expect(screen.getByText('Research project')).toBeInTheDocument()
      expect(screen.getByText('Assignment deadline')).toBeInTheDocument()
      expect(screen.getByText('Office hours')).toBeInTheDocument()
    })

    it('should update examStore on answer selection (Requirement 13.3)', () => {
      render(<ListeningQuestionDisplay question={conversationQuestion} />)

      const correctOption = screen.getByLabelText(/Option A:.*Course requirements/i)
      fireEvent.click(correctOption)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('conv-001', 'Course requirements')
    })
  })

  describe('Academic Lecture Question Type', () => {
    const academicLectureQuestion: ListeningQuestion = {
      id: 'lec-001',
      section: 'listening',
      type: 'academic-lecture',
      difficulty_level: 'hard',
      stage: 2,
      content: JSON.stringify({
        audioUrl: '/audio/listening/lecture-1.mp3',
        transcript: 'Professor lecturing on environmental science topics.',
        question: 'What does the professor mainly discuss?'
      }),
      options: [
        'Climate change effects',
        'Ecosystem dynamics',
        'Conservation strategies',
        'Pollution sources'
      ],
      correct_answer: 'Ecosystem dynamics',
      irt_a: 1.8,
      irt_b: 1.2,
      irt_c: 0.1
    }

    it('should render academic lecture question with audio indicator', () => {
      render(<ListeningQuestionDisplay question={academicLectureQuestion} />)

      expect(screen.getByText(/Listen to the academic lecture/i)).toBeInTheDocument()
      expect(screen.getByText(/What does the professor mainly discuss/i)).toBeInTheDocument()
    })

    it('should render multiple choice options', () => {
      render(<ListeningQuestionDisplay question={academicLectureQuestion} />)

      expect(screen.getByText('Climate change effects')).toBeInTheDocument()
      expect(screen.getByText('Ecosystem dynamics')).toBeInTheDocument()
      expect(screen.getByText('Conservation strategies')).toBeInTheDocument()
      expect(screen.getByText('Pollution sources')).toBeInTheDocument()
    })

    it('should update examStore on selection (Requirement 13.3)', () => {
      render(<ListeningQuestionDisplay question={academicLectureQuestion} />)

      const correctOption = screen.getByLabelText(/Option B:.*Ecosystem dynamics/i)
      fireEvent.click(correctOption)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('lec-001', 'Ecosystem dynamics')
    })
  })

  describe('Question Type Badge', () => {
    it('should display formatted question type for choose-response', () => {
      const question: ListeningQuestion = {
        id: 'test-1',
        section: 'listening',
        type: 'choose-response',
        difficulty_level: 'easy',
        stage: 1,
        content: JSON.stringify({
          audioUrl: '/audio/test.mp3',
          transcript: 'Test',
          question: 'Test question?'
        }),
        options: ['A', 'B'],
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2
      }

      render(<ListeningQuestionDisplay question={question} />)

      expect(screen.getByText('Choose Response')).toBeInTheDocument()
    })

    it('should display formatted question type for conversation', () => {
      const question: ListeningQuestion = {
        id: 'test-2',
        section: 'listening',
        type: 'conversation',
        difficulty_level: 'medium',
        stage: 1,
        content: JSON.stringify({
          audioUrl: '/audio/test.mp3',
          transcript: 'Test',
          question: 'Test question?'
        }),
        options: ['A', 'B'],
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2
      }

      render(<ListeningQuestionDisplay question={question} />)

      expect(screen.getByText('Conversation')).toBeInTheDocument()
    })

    it('should display formatted question type for academic-lecture', () => {
      const question: ListeningQuestion = {
        id: 'test-3',
        section: 'listening',
        type: 'academic-lecture',
        difficulty_level: 'hard',
        stage: 2,
        content: JSON.stringify({
          audioUrl: '/audio/test.mp3',
          transcript: 'Test',
          question: 'Test question?'
        }),
        options: ['A', 'B'],
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2
      }

      render(<ListeningQuestionDisplay question={question} />)

      expect(screen.getByText('Academic Lecture')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid JSON content gracefully', () => {
      const invalidQuestion: ListeningQuestion = {
        id: 'invalid-001',
        section: 'listening',
        type: 'conversation',
        difficulty_level: 'easy',
        stage: 1,
        content: 'invalid-json-content',
        options: ['A', 'B'],
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2
      }

      render(<ListeningQuestionDisplay question={invalidQuestion} />)

      // The component should render, showing empty question text
      // (error is logged to console but component doesn't crash)
      const conversationIndicator = screen.getByText(/Listen to the conversation/i)
      expect(conversationIndicator).toBeInTheDocument()
    })

    it('should display error for unsupported question type', () => {
      const unsupportedQuestion = {
        id: 'unsupported-001',
        section: 'listening',
        type: 'unsupported-type',
        difficulty_level: 'easy',
        stage: 1,
        content: JSON.stringify({
          audioUrl: '/audio/test.mp3',
          transcript: 'Test',
          question: 'Test?'
        }),
        options: ['A', 'B'],
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2
      } as any

      render(<ListeningQuestionDisplay question={unsupportedQuestion} />)

      expect(screen.getByText(/Unsupported question type: unsupported-type/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility (Requirement 23.1, 23.2)', () => {
    it('should have proper ARIA labels for radio buttons', () => {
      const accessibleQuestion: ListeningQuestion = {
        id: 'acc-001',
        section: 'listening',
        type: 'conversation',
        difficulty_level: 'easy',
        stage: 1,
        content: JSON.stringify({
          audioUrl: '/audio/test.mp3',
          transcript: 'Test',
          question: 'Test question?'
        }),
        options: ['First option', 'Second option'],
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2
      }

      render(<ListeningQuestionDisplay question={accessibleQuestion} />)

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toHaveAttribute('aria-label', 'Answer options')

      const firstRadio = screen.getByLabelText(/Option A: First option/i)
      expect(firstRadio).toBeInTheDocument()

      const secondRadio = screen.getByLabelText(/Option B: Second option/i)
      expect(secondRadio).toBeInTheDocument()
    })

    it('should support keyboard navigation for radio buttons', () => {
      const question: ListeningQuestion = {
        id: 'kbd-001',
        section: 'listening',
        type: 'choose-response',
        difficulty_level: 'easy',
        stage: 1,
        content: JSON.stringify({
          audioUrl: '/audio/test.mp3',
          transcript: 'Test',
          question: 'Choose an option'
        }),
        options: ['Option A', 'Option B'],
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2
      }

      render(<ListeningQuestionDisplay question={question} />)

      const firstRadio = screen.getByLabelText(/Option A: Option A/i)
      expect(firstRadio).toBeInTheDocument()
      
      // Radio buttons should be focusable via keyboard
      firstRadio.focus()
      expect(document.activeElement).toBe(firstRadio)
    })
  })

  describe('Visual Styling', () => {
    it('should apply selected state styling to checked option', () => {
      mockAnswers.set('style-001', 'Selected option')

      const question: ListeningQuestion = {
        id: 'style-001',
        section: 'listening',
        type: 'conversation',
        difficulty_level: 'easy',
        stage: 1,
        content: JSON.stringify({
          audioUrl: '/audio/test.mp3',
          transcript: 'Test',
          question: 'Test?'
        }),
        options: ['Selected option', 'Unselected option'],
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2
      }

      render(<ListeningQuestionDisplay question={question} />)

      const selectedOption = screen.getByLabelText(/Option A: Selected option/i) as HTMLInputElement
      expect(selectedOption.checked).toBe(true)
    })
  })

  describe('Requirements Validation', () => {
    it('should validate Requirement 4.1: Render listening items across all types', () => {
      const types: Array<'choose-response' | 'conversation' | 'academic-lecture'> = [
        'choose-response',
        'conversation',
        'academic-lecture'
      ]

      types.forEach((type) => {
        const question: ListeningQuestion = {
          id: `req-4.1-${type}`,
          section: 'listening',
          type,
          difficulty_level: 'medium',
          stage: 1,
          content: JSON.stringify({
            audioUrl: '/audio/test.mp3',
            transcript: 'Test transcript',
            question: 'Test question?'
          }),
          options: ['Option 1', 'Option 2'],
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        }

        const { unmount } = render(<ListeningQuestionDisplay question={question} />)
        
        // Should render without error
        expect(screen.getByText('Test question?')).toBeInTheDocument()
        
        unmount()
      })
    })

    it('should validate Requirement 13.3: Allow changing answers within module', () => {
      const question: ListeningQuestion = {
        id: 'req-13.3',
        section: 'listening',
        type: 'conversation',
        difficulty_level: 'medium',
        stage: 1,
        content: JSON.stringify({
          audioUrl: '/audio/test.mp3',
          transcript: 'Test',
          question: 'Test question?'
        }),
        options: ['First', 'Second', 'Third'],
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2
      }

      render(<ListeningQuestionDisplay question={question} />)

      // Select first option
      const firstOption = screen.getByLabelText(/Option A: First/i)
      fireEvent.click(firstOption)
      expect(mockUpdateAnswer).toHaveBeenCalledWith('req-13.3', 'First')

      // Change to second option
      const secondOption = screen.getByLabelText(/Option B: Second/i)
      fireEvent.click(secondOption)
      expect(mockUpdateAnswer).toHaveBeenCalledWith('req-13.3', 'Second')

      // Change to third option
      const thirdOption = screen.getByLabelText(/Option C: Third/i)
      fireEvent.click(thirdOption)
      expect(mockUpdateAnswer).toHaveBeenCalledWith('req-13.3', 'Third')

      // Should allow changing answers multiple times
      expect(mockUpdateAnswer).toHaveBeenCalledTimes(3)
    })
  })
})
