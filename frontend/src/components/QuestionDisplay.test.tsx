import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuestionDisplay, type ReadingQuestion } from './QuestionDisplay'
import { useExamStore } from '../stores/examStore'
import { useUIStore } from '../stores/uiStore'

// Mock stores
vi.mock('../stores/examStore', () => ({
  useExamStore: vi.fn(),
}))

vi.mock('../stores/uiStore', () => ({
  useUIStore: vi.fn(),
}))

describe('QuestionDisplay', () => {
  const mockUpdateAnswer = vi.fn()
  const mockAnswers = new Map<string, string>()

  beforeEach(() => {
    vi.clearAllMocks()
    mockAnswers.clear()

    // Setup default mock implementations
    vi.mocked(useExamStore).mockReturnValue({
      answers: mockAnswers,
      updateAnswer: mockUpdateAnswer,
    } as any)

    vi.mocked(useUIStore).mockReturnValue({
      lockedQuestions: new Set(),
      setGatekeeperActive: vi.fn(),
      lockQuestion: vi.fn(),
      unlockQuestion: vi.fn(),
      unlockAllQuestions: vi.fn(),
    } as any)
  })

  describe('Complete Words Question Type', () => {
    const completeWordsQuestion: ReadingQuestion = {
      id: 'cw-001',
      section: 'reading',
      type: 'complete-words',
      difficulty_level: 'medium',
      stage: 1,
      content: JSON.stringify({
        sentence: 'The scientist\'s research was _____ by her colleagues.',
        context: 'In academic settings, peer recognition is important.',
      }),
      options: ['criticized', 'praised', 'ignored', 'rejected'],
      correct_answer: 'praised',
      irt_a: 1.2,
      irt_b: 0.3,
      irt_c: 0.2,
    }

    it('should render complete words question with sentence and context', () => {
      render(<QuestionDisplay question={completeWordsQuestion} />)

      expect(screen.getByText(/scientist's research/i)).toBeInTheDocument()
      expect(screen.getByText(/academic settings/i)).toBeInTheDocument()
    })

    it('should render multiple choice options as radio buttons', () => {
      render(<QuestionDisplay question={completeWordsQuestion} />)

      const radioButtons = screen.getAllByRole('radio')
      expect(radioButtons).toHaveLength(4)

      expect(screen.getByText(/criticized/i)).toBeInTheDocument()
      expect(screen.getByText(/praised/i)).toBeInTheDocument()
      expect(screen.getByText(/ignored/i)).toBeInTheDocument()
      expect(screen.getByText(/rejected/i)).toBeInTheDocument()
    })

    it('should update examStore when option is selected (Requirement 13.3)', () => {
      render(<QuestionDisplay question={completeWordsQuestion} />)

      const praisedOption = screen.getByLabelText(/Option B: praised/i)
      fireEvent.click(praisedOption)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('cw-001', 'praised')
    })

    it('should show selected option as checked', () => {
      mockAnswers.set('cw-001', 'praised')

      render(<QuestionDisplay question={completeWordsQuestion} />)

      const praisedOption = screen.getByLabelText(/Option B: praised/i) as HTMLInputElement
      expect(praisedOption.checked).toBe(true)
    })

    it('should allow changing answer (Requirement 13.3)', () => {
      mockAnswers.set('cw-001', 'praised')

      render(<QuestionDisplay question={completeWordsQuestion} />)

      // Change answer from "praised" to "criticized"
      const criticizedOption = screen.getByLabelText(/Option A: criticized/i)
      fireEvent.click(criticizedOption)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('cw-001', 'criticized')
    })
  })

  describe('Academic Passage Question Type', () => {
    const academicPassageQuestion: ReadingQuestion = {
      id: 'ap-001',
      section: 'reading',
      type: 'academic-passage',
      difficulty_level: 'hard',
      stage: 2,
      content: JSON.stringify({
        passage: 'Climate change is a pressing global issue...',
        question: 'According to the passage, what is the primary cause of climate change?',
      }),
      options: [
        'Natural weather cycles',
        'Human activities such as burning fossil fuels',
        'Solar radiation changes',
        'Volcanic eruptions',
      ],
      correct_answer: 'Human activities such as burning fossil fuels',
      irt_a: 1.4,
      irt_b: 0.5,
      irt_c: 0.18,
    }

    it('should render academic passage question with passage reference', () => {
      render(<QuestionDisplay question={academicPassageQuestion} />)

      expect(screen.getByText(/Refer to the passage on the right side/i)).toBeInTheDocument()
      expect(screen.getByText(/primary cause of climate change/i)).toBeInTheDocument()
    })

    it('should render multiple choice options', () => {
      render(<QuestionDisplay question={academicPassageQuestion} />)

      expect(screen.getByText(/Natural weather cycles/i)).toBeInTheDocument()
      expect(screen.getByText(/Human activities such as burning fossil fuels/i)).toBeInTheDocument()
      expect(screen.getByText(/Solar radiation changes/i)).toBeInTheDocument()
      expect(screen.getByText(/Volcanic eruptions/i)).toBeInTheDocument()
    })

    it('should update examStore on answer selection (Requirement 13.3)', () => {
      render(<QuestionDisplay question={academicPassageQuestion} />)

      const correctOption = screen.getByLabelText(/Option B:.*Human activities/i)
      fireEvent.click(correctOption)

      expect(mockUpdateAnswer).toHaveBeenCalledWith(
        'ap-001',
        'Human activities such as burning fossil fuels'
      )
    })
  })

  describe('Synonym Match Question Type', () => {
    const synonymMatchQuestion: ReadingQuestion = {
      id: 'sm-001',
      section: 'reading',
      type: 'synonym-match',
      difficulty_level: 'medium',
      stage: 1,
      content: JSON.stringify({
        word: 'abundant',
        context: 'The forest was abundant with diverse species.',
      }),
      options: ['plentiful', 'scarce', 'moderate', 'limited'],
      correct_answer: 'plentiful',
      irt_a: 1.5,
      irt_b: 0.2,
      irt_c: 0.15,
    }

    it('should render synonym match question with word and context', () => {
      render(<QuestionDisplay question={synonymMatchQuestion} />)

      expect(screen.getByText('abundant')).toBeInTheDocument()
      expect(screen.getByText(/forest was abundant/i)).toBeInTheDocument()
      expect(screen.getByText(/Select the word that is closest in meaning/i)).toBeInTheDocument()
    })

    it('should render multiple choice options', () => {
      render(<QuestionDisplay question={synonymMatchQuestion} />)

      expect(screen.getByText('plentiful')).toBeInTheDocument()
      expect(screen.getByText('scarce')).toBeInTheDocument()
      expect(screen.getByText('moderate')).toBeInTheDocument()
      expect(screen.getByText('limited')).toBeInTheDocument()
    })

    it('should update examStore on selection (Requirement 13.3)', () => {
      render(<QuestionDisplay question={synonymMatchQuestion} />)

      const plentifulOption = screen.getByLabelText(/Option A: plentiful/i)
      fireEvent.click(plentifulOption)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('sm-001', 'plentiful')
    })
  })

  describe('Daily Life Question Type', () => {
    const dailyLifeQuestion: ReadingQuestion = {
      id: 'dl-001',
      section: 'reading',
      type: 'daily-life',
      difficulty_level: 'easy',
      stage: 1,
      content: JSON.stringify({
        scenario: 'You are planning a trip to a new city and need to book accommodation.',
        question: 'What is the most important factor to consider when choosing a hotel?',
      }),
      options: ['Price', 'Location', 'Amenities', 'Reviews'],
      correct_answer: 'Location',
      irt_a: 1.0,
      irt_b: -0.5,
      irt_c: 0.25,
    }

    it('should render daily life question with scenario', () => {
      render(<QuestionDisplay question={dailyLifeQuestion} />)

      expect(screen.getByText(/planning a trip to a new city/i)).toBeInTheDocument()
      expect(screen.getByText(/most important factor/i)).toBeInTheDocument()
    })

    it('should render multiple choice options', () => {
      render(<QuestionDisplay question={dailyLifeQuestion} />)

      expect(screen.getByText('Price')).toBeInTheDocument()
      expect(screen.getByText('Location')).toBeInTheDocument()
      expect(screen.getByText('Amenities')).toBeInTheDocument()
      expect(screen.getByText('Reviews')).toBeInTheDocument()
    })

    it('should update examStore on selection (Requirement 13.3)', () => {
      render(<QuestionDisplay question={dailyLifeQuestion} />)

      const locationOption = screen.getByLabelText(/Option B: Location/i)
      fireEvent.click(locationOption)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('dl-001', 'Location')
    })
  })

  describe('Text Input for Short Answers (Requirement 10.4)', () => {
    const shortAnswerQuestion: ReadingQuestion = {
      id: 'sa-001',
      section: 'reading',
      type: 'complete-words',
      difficulty_level: 'medium',
      stage: 1,
      content: JSON.stringify({
        sentence: 'The capital of France is _____.',
        context: 'Geography question',
      }),
      // No options means text input
      irt_a: 1.1,
      irt_b: 0.0,
      irt_c: 0.0,
    }

    it('should render text input when no options provided (Requirement 10.4)', () => {
      render(<QuestionDisplay question={shortAnswerQuestion} />)

      const textInput = screen.getByLabelText(/Your Answer/i)
      expect(textInput).toBeInTheDocument()
      expect(textInput.tagName).toBe('INPUT')
      expect(textInput).toHaveAttribute('type', 'text')
    })

    it('should update examStore on text input change (Requirement 10.4, 13.3)', () => {
      render(<QuestionDisplay question={shortAnswerQuestion} />)

      const textInput = screen.getByLabelText(/Your Answer/i)
      fireEvent.change(textInput, { target: { value: 'Paris' } })

      expect(mockUpdateAnswer).toHaveBeenCalledWith('sa-001', 'Paris')
    })

    it('should display existing answer from examStore', () => {
      mockAnswers.set('sa-001', 'Paris')

      render(<QuestionDisplay question={shortAnswerQuestion} />)

      const textInput = screen.getByLabelText(/Your Answer/i) as HTMLInputElement
      expect(textInput.value).toBe('Paris')
    })

    it('should allow changing text answer (Requirement 13.3)', () => {
      mockAnswers.set('sa-001', 'Paris')

      render(<QuestionDisplay question={shortAnswerQuestion} />)

      const textInput = screen.getByLabelText(/Your Answer/i)
      fireEvent.change(textInput, { target: { value: 'Paris, France' } })

      expect(mockUpdateAnswer).toHaveBeenCalledWith('sa-001', 'Paris, France')
    })
  })

  describe('Gatekeeper Integration', () => {
    const lockedQuestion: ReadingQuestion = {
      id: 'locked-001',
      section: 'reading',
      type: 'academic-passage',
      difficulty_level: 'medium',
      stage: 1,
      content: JSON.stringify({
        passage: 'Test passage',
        question: 'Test question?',
      }),
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_answer: 'Option A',
      irt_a: 1.2,
      irt_b: 0.1,
      irt_c: 0.2,
    }

    it('should wrap question in LockedQuestionIndicator', () => {
      const lockedQuestions = new Set(['locked-001'])
      
      vi.mocked(useUIStore).mockReturnValue({
        lockedQuestions,
        setGatekeeperActive: vi.fn(),
        lockQuestion: vi.fn(),
        unlockQuestion: vi.fn(),
        unlockAllQuestions: vi.fn(),
      } as any)

      render(<QuestionDisplay question={lockedQuestion} />)

      // LockedQuestionIndicator shows lock icon when locked
      expect(screen.getByText('Locked')).toBeInTheDocument()
    })

    it('should allow interaction when not locked', () => {
      vi.mocked(useUIStore).mockReturnValue({
        lockedQuestions: new Set(),
        setGatekeeperActive: vi.fn(),
        lockQuestion: vi.fn(),
        unlockQuestion: vi.fn(),
        unlockAllQuestions: vi.fn(),
      } as any)

      render(<QuestionDisplay question={lockedQuestion} />)

      const firstOption = screen.getByLabelText(/Option A: Option A/i)
      fireEvent.click(firstOption)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('locked-001', 'Option A')
    })
  })

  describe('Question Type Badge', () => {
    it('should display formatted question type badge', () => {
      const question: ReadingQuestion = {
        id: 'test-001',
        section: 'reading',
        type: 'complete-words',
        difficulty_level: 'medium',
        stage: 1,
        content: JSON.stringify({ sentence: 'Test', context: '' }),
        options: ['A', 'B'],
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2,
      }

      render(<QuestionDisplay question={question} />)

      expect(screen.getByText('Complete Words')).toBeInTheDocument()
    })

    it('should format academic-passage type correctly', () => {
      const question: ReadingQuestion = {
        id: 'test-002',
        section: 'reading',
        type: 'academic-passage',
        difficulty_level: 'hard',
        stage: 2,
        content: JSON.stringify({ passage: 'Test', question: 'Test?' }),
        options: ['A', 'B'],
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2,
      }

      render(<QuestionDisplay question={question} />)

      expect(screen.getByText('Academic Passage')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid JSON content gracefully', () => {
      const invalidQuestion: ReadingQuestion = {
        id: 'invalid-001',
        section: 'reading',
        type: 'complete-words',
        difficulty_level: 'medium',
        stage: 1,
        content: 'INVALID JSON{{{',
        options: ['A', 'B'],
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2,
      }

      render(<QuestionDisplay question={invalidQuestion} />)

      expect(screen.getByText(/Error loading question content/i)).toBeInTheDocument()
    })

    it('should display error for unsupported question type', () => {
      const unsupportedQuestion: ReadingQuestion = {
        id: 'unsupported-001',
        section: 'reading',
        type: 'unsupported-type' as any,
        difficulty_level: 'medium',
        stage: 1,
        content: JSON.stringify({ test: 'data' }),
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2,
      }

      render(<QuestionDisplay question={unsupportedQuestion} />)

      expect(screen.getByText(/Unsupported question type: unsupported-type/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    const accessibleQuestion: ReadingQuestion = {
      id: 'accessible-001',
      section: 'reading',
      type: 'complete-words',
      difficulty_level: 'medium',
      stage: 1,
      content: JSON.stringify({
        sentence: 'Test sentence ___.',
        context: 'Test context',
      }),
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      irt_a: 1.0,
      irt_b: 0.0,
      irt_c: 0.2,
    }

    it('should have proper ARIA labels for radio buttons', () => {
      render(<QuestionDisplay question={accessibleQuestion} />)

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toHaveAttribute('aria-label', 'Answer options')

      const radioButtons = screen.getAllByRole('radio')
      expect(radioButtons[0]).toHaveAccessibleName(/Option A: Option A/i)
    })

    it('should have proper label for text input', () => {
      const textQuestion: ReadingQuestion = {
        ...accessibleQuestion,
        options: undefined,
      }

      render(<QuestionDisplay question={textQuestion} />)

      const textInput = screen.getByLabelText(/Your Answer/i)
      expect(textInput).toHaveAttribute('aria-label', 'Text answer input')
    })
  })
})
