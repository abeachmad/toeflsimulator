import { useExamStore } from '../stores/examStore'

/**
 * Listening Question Data Structure
 * Based on backend listening item generation
 */
export interface ListeningQuestion {
  id: string
  section: 'listening'
  type: 'choose-response' | 'conversation' | 'academic-lecture'
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
interface ChooseResponseContent {
  audioUrl: string
  transcript: string
  question: string
}

interface ConversationContent {
  audioUrl: string
  transcript: string
  question: string
}

interface AcademicLectureContent {
  audioUrl: string
  transcript: string
  question: string
}

/**
 * ListeningQuestionDisplay Component Props
 */
interface ListeningQuestionDisplayProps {
  /** Question data object */
  question: ListeningQuestion
  /** CSS class name for custom styling */
  className?: string
}

/**
 * ListeningQuestionDisplay Component
 * 
 * Renders listening questions with appropriate input controls:
 * - Multiple choice: Radio buttons
 * - Integrates with examStore for answer persistence
 * - No gatekeeper locking (questions unlocked after audio completes)
 * - Styled with official ETS design
 * 
 * **Supports Question Types:**
 * - Choose Response: Brief audio prompt with response selection
 * - Conversations: Student-professor or student-student dialogues
 * - Academic Talks: Professor lectures on academic topics
 * 
 * @component
 * @example
 * ```tsx
 * <ListeningQuestionDisplay
 *   question={listeningQuestionData}
 * />
 * ```
 * 
 * **Requirements Validated:**
 * - Requirement 4.1: Provides listening items across Choose Response, Conversations, and Academic Talks types
 * - Requirement 13.3: Allows changing answers within current module via examStore
 */
export function ListeningQuestionDisplay({
  question,
  className = '',
}: ListeningQuestionDisplayProps) {
  const { answers, updateAnswer } = useExamStore()
  
  // Get current answer from store
  const currentAnswer = answers.get(question.id)
  
  // Parse question content
  const parsedContent = parseQuestionContent(question)

  /**
   * Handle multiple choice selection
   * Updates examStore with selected option (Requirement 13.3)
   */
  const handleMultipleChoiceSelect = (option: string) => {
    updateAnswer(question.id, option)
  }

  /**
   * Render question based on type
   */
  const renderQuestionContent = () => {
    switch (question.type) {
      case 'choose-response':
        return renderChooseResponseQuestion(parsedContent as ChooseResponseContent)
      
      case 'conversation':
        return renderConversationQuestion(parsedContent as ConversationContent)
      
      case 'academic-lecture':
        return renderAcademicLectureQuestion(parsedContent as AcademicLectureContent)
      
      default:
        return (
          <div className="text-red-400">
            Unsupported question type: {question.type}
          </div>
        )
    }
  }

  /**
   * Render Choose Response question
   * Shows brief audio prompt with response selection
   */
  const renderChooseResponseQuestion = (content: ChooseResponseContent) => {
    return (
      <div className="space-y-4">
        <div className="text-gray-400 text-sm mb-4 p-3 bg-gray-800 rounded border-l-4 border-purple-500">
          <p className="font-medium">Listen to the audio and choose the best response</p>
        </div>

        <div className="text-gray-100 text-lg leading-relaxed mb-6">
          <p className="font-medium">{content.question}</p>
        </div>

        {question.options && renderMultipleChoiceOptions()}
      </div>
    )
  }

  /**
   * Render Conversation question
   * Shows student-professor or student-student dialogue question
   */
  const renderConversationQuestion = (content: ConversationContent) => {
    return (
      <div className="space-y-4">
        <div className="text-gray-400 text-sm mb-4 p-3 bg-gray-800 rounded border-l-4 border-blue-500">
          <p className="font-medium">Listen to the conversation</p>
        </div>

        <div className="text-gray-100 text-lg leading-relaxed mb-6">
          <p className="font-medium">{content.question}</p>
        </div>

        {question.options && renderMultipleChoiceOptions()}
      </div>
    )
  }

  /**
   * Render Academic Lecture question
   * Shows professor lecture question
   */
  const renderAcademicLectureQuestion = (content: AcademicLectureContent) => {
    return (
      <div className="space-y-4">
        <div className="text-gray-400 text-sm mb-4 p-3 bg-gray-800 rounded border-l-4 border-green-500">
          <p className="font-medium">Listen to the academic lecture</p>
        </div>

        <div className="text-gray-100 text-lg leading-relaxed mb-6">
          <p className="font-medium">{content.question}</p>
        </div>

        {question.options && renderMultipleChoiceOptions()}
      </div>
    )
  }

  /**
   * Render multiple choice radio buttons (Requirement 4.1, 13.3)
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

  return (
    <div className={`bg-gray-900 rounded-lg p-6 shadow-lg ${className}`}>
      {/* Question Number and Type Badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Question
          </span>
          <span className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full uppercase">
            {formatQuestionType(question.type)}
          </span>
        </div>
      </div>

      {/* Question Content */}
      <div className="mt-4">
        {renderQuestionContent()}
      </div>
    </div>
  )
}

/**
 * Parse question content from JSON string
 */
function parseQuestionContent(
  question: ListeningQuestion
): ChooseResponseContent | ConversationContent | AcademicLectureContent {
  try {
    return JSON.parse(question.content)
  } catch (error) {
    console.error(`Failed to parse question content for ${question.id}:`, error)
    return { 
      audioUrl: '', 
      transcript: 'Error loading question content', 
      question: '' 
    }
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
