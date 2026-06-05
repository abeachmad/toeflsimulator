import { useState, useEffect } from 'react'
import { useExamStore } from '../stores/examStore'
import { LockedQuestionIndicator } from './LockedQuestionIndicator'

/**
 * Reading Question Data Structure
 * Based on backend datasets/sample-reading-items.json
 */
export interface ReadingQuestion {
  id: string
  section: 'reading'
  type: 'complete-words' | 'daily-life' | 'academic-passage' | 'synonym-match'
  difficulty_level: 'easy' | 'medium' | 'hard'
  stage: number
  content: string // JSON string containing type-specific content
  options?: string[] // For multiple choice questions
  correct_answer?: string
  irt_a: number
  irt_b: number
  irt_c: number
  metadata?: Record<string, unknown>
}

/**
 * Parsed content structures for different question types
 */
interface CompleteWordsContent {
  sentence: string
  context?: string
}

interface AcademicPassageContent {
  passage: string
  question: string
}

interface SynonymMatchContent {
  word: string
  context: string
}

interface DailyLifeContent {
  scenario: string
  question: string
}

/**
 * QuestionDisplay Component Props
 */
interface QuestionDisplayProps {
  /** Question data object */
  question: ReadingQuestion
  /** Whether question is locked by Gatekeeper */
  isLocked?: boolean
  /** CSS class name for custom styling */
  className?: string
}

/**
 * QuestionDisplay Component
 * 
 * Renders reading questions with appropriate input controls:
 * - Multiple choice: Radio buttons
 * - Short answer: Inline text inputs
 * - Integrates with examStore for answer persistence
 * - Handles locked state from Gatekeeper via LockedQuestionIndicator
 * - Styled with official ETS design
 * 
 * **Supports Question Types:**
 * - Complete Words: Sentence with blank, multiple choice options
 * - Daily Life: Scenario-based question, multiple choice options
 * - Academic Passage: Passage-based comprehension, multiple choice options
 * - Synonym Match: Word definition matching, multiple choice options
 * 
 * @component
 * @example
 * ```tsx
 * <QuestionDisplay
 *   question={readingQuestionData}
 *   isLocked={false}
 * />
 * ```
 * 
 * **Requirements Validated:**
 * - Requirement 3.1: Provides reading items across Complete Words, Daily Life, and Academic Passage types
 * - Requirement 10.4: Provides inline text inputs for short answer questions
 * - Requirement 13.3: Allows changing answers within current module via examStore
 */
export function QuestionDisplay({
  question,
  className = '',
}: QuestionDisplayProps) {
  const { answers, updateAnswer } = useExamStore()
  
  // Get current answer from store
  const currentAnswer = answers.get(question.id)
  
  // Local state for text inputs
  const [textInput, setTextInput] = useState<string>(
    typeof currentAnswer === 'string' ? currentAnswer : ''
  )

  // Parse question content
  const parsedContent = parseQuestionContent(question)

  // Update local state when answer changes in store
  useEffect(() => {
    if (typeof currentAnswer === 'string') {
      setTextInput(currentAnswer)
    }
  }, [currentAnswer])

  /**
   * Handle multiple choice selection
   * Updates examStore with selected option (Requirement 13.3)
   */
  const handleMultipleChoiceSelect = (option: string) => {
    updateAnswer(question.id, option)
  }

  /**
   * Handle text input change
   * Updates examStore with text input value (Requirement 10.4, 13.3)
   */
  const handleTextInputChange = (value: string) => {
    setTextInput(value)
    updateAnswer(question.id, value)
  }

  /**
   * Render question based on type
   */
  const renderQuestionContent = () => {
    switch (question.type) {
      case 'complete-words':
        return renderCompleteWordsQuestion(parsedContent as CompleteWordsContent)
      
      case 'academic-passage':
        return renderAcademicPassageQuestion(parsedContent as AcademicPassageContent)
      
      case 'synonym-match':
        return renderSynonymMatchQuestion(parsedContent as SynonymMatchContent)
      
      case 'daily-life':
        return renderDailyLifeQuestion(parsedContent as DailyLifeContent)
      
      default:
        return (
          <div className="text-red-400">
            Unsupported question type: {question.type}
          </div>
        )
    }
  }

  /**
   * Render Complete Words question
   * Shows sentence with blank and multiple choice options
   */
  const renderCompleteWordsQuestion = (content: CompleteWordsContent) => {
    return (
      <div className="space-y-4">
        {content.context && (
          <div className="text-gray-400 text-sm italic mb-3 p-3 bg-gray-800 rounded">
            {content.context}
          </div>
        )}
        
        <div className="text-gray-100 text-lg leading-relaxed mb-6">
          <p className="font-medium">{content.sentence}</p>
        </div>

        {question.options ? (
          renderMultipleChoiceOptions()
        ) : (
          renderTextInput()
        )}
      </div>
    )
  }

  /**
   * Render Academic Passage question
   * Shows passage reference and question with multiple choice options
   */
  const renderAcademicPassageQuestion = (content: AcademicPassageContent) => {
    return (
      <div className="space-y-4">
        {/* Note: Full passage is displayed in PassageViewer on right side */}
        <div className="text-gray-400 text-sm mb-4 p-3 bg-gray-800 rounded border-l-4 border-blue-500">
          <p className="font-medium">Refer to the passage on the right side</p>
        </div>

        <div className="text-gray-100 text-lg leading-relaxed mb-6">
          <p className="font-medium">{content.question}</p>
        </div>

        {question.options ? (
          renderMultipleChoiceOptions()
        ) : (
          renderTextInput()
        )}
      </div>
    )
  }

  /**
   * Render Synonym Match question
   * Shows word and context with multiple choice options
   */
  const renderSynonymMatchQuestion = (content: SynonymMatchContent) => {
    return (
      <div className="space-y-4">
        <div className="text-gray-100 mb-4">
          <p className="text-sm text-gray-400 mb-2">Select the word that is closest in meaning to:</p>
          <p className="text-2xl font-bold text-blue-400">{content.word}</p>
        </div>

        {content.context && (
          <div className="text-gray-400 text-sm italic mb-4 p-3 bg-gray-800 rounded">
            <span className="font-medium">Context:</span> {content.context}
          </div>
        )}

        {question.options ? (
          renderMultipleChoiceOptions()
        ) : (
          renderTextInput()
        )}
      </div>
    )
  }

  /**
   * Render Daily Life question
   * Shows scenario and question with multiple choice options
   */
  const renderDailyLifeQuestion = (content: DailyLifeContent) => {
    return (
      <div className="space-y-4">
        {content.scenario && (
          <div className="text-gray-300 text-base mb-4 p-4 bg-gray-800 rounded border-l-4 border-green-500">
            <p className="leading-relaxed">{content.scenario}</p>
          </div>
        )}

        <div className="text-gray-100 text-lg leading-relaxed mb-6">
          <p className="font-medium">{content.question}</p>
        </div>

        {question.options ? (
          renderMultipleChoiceOptions()
        ) : (
          renderTextInput()
        )}
      </div>
    )
  }

  /**
   * Render multiple choice radio buttons (Requirement 10.4)
   */
  const renderMultipleChoiceOptions = () => {
    return (
      <div className="space-y-3" role="radiogroup" aria-label="Answer options">
        {question.options?.map((option, index) => {
          const isSelected = currentAnswer === option
          const optionLabel = String.fromCharCode(65 + index) // A, B, C, D

          return (
            <label
              key={`${question.id}-option-${index}`}
              className={`
                flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                ${
                  isSelected
                    ? 'border-blue-500 bg-blue-900 bg-opacity-30'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600 hover:bg-gray-750'
                }
              `}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option}
                checked={isSelected}
                onChange={() => handleMultipleChoiceSelect(option)}
                className="mt-1 h-5 w-5 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                aria-label={`Option ${optionLabel}: ${option}`}
              />
              <div className="flex-1">
                <span className="text-gray-400 font-semibold mr-2">{optionLabel}.</span>
                <span className="text-gray-100">{option}</span>
              </div>
            </label>
          )
        })}
      </div>
    )
  }

  /**
   * Render inline text input for short answers (Requirement 10.4)
   */
  const renderTextInput = () => {
    return (
      <div className="mt-6">
        <label htmlFor={`text-input-${question.id}`} className="block text-sm font-medium text-gray-400 mb-2">
          Your Answer:
        </label>
        <input
          id={`text-input-${question.id}`}
          type="text"
          value={textInput}
          onChange={(e) => handleTextInputChange(e.target.value)}
          className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all"
          placeholder="Type your answer here..."
          aria-label="Text answer input"
        />
      </div>
    )
  }

  return (
    <LockedQuestionIndicator questionId={question.id} className={className}>
      <div className="bg-gray-900 rounded-lg p-6 shadow-lg">
        {/* Question Number and Type Badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
              Question
            </span>
            <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full uppercase">
              {formatQuestionType(question.type)}
            </span>
          </div>
        </div>

        {/* Question Content */}
        <div className="mt-4">
          {renderQuestionContent()}
        </div>
      </div>
    </LockedQuestionIndicator>
  )
}

/**
 * Parse question content from JSON string
 */
function parseQuestionContent(
  question: ReadingQuestion
): CompleteWordsContent | AcademicPassageContent | SynonymMatchContent | DailyLifeContent {
  try {
    return JSON.parse(question.content)
  } catch (error) {
    console.error(`Failed to parse question content for ${question.id}:`, error)
    return { sentence: 'Error loading question content', context: '' }
  }
}

/**
 * Format question type for display
 */
function formatQuestionType(type: string): string {
  return type
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
