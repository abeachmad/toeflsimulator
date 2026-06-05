import { useExamStore } from '../stores/examStore'

/**
 * QuestionNavigationMap Component Props
 */
interface QuestionNavigationMapProps {
  /** Array of question IDs */
  questionIds: string[]
  /** Current question index */
  currentIndex: number
  /** Callback when a question is clicked */
  onNavigate: (index: number) => void
  /** CSS class name for custom styling */
  className?: string
}

/**
 * QuestionNavigationMap Component
 * 
 * Displays a grid of question numbers with:
 * - Click navigation to any question
 * - Green highlighting for answered questions
 * - Blue highlighting for current question
 * - Gray for unanswered questions
 * 
 * @component
 * @example
 * ```tsx
 * <QuestionNavigationMap
 *   questionIds={['q1', 'q2', 'q3']}
 *   currentIndex={0}
 *   onNavigate={(index) => setCurrentItemIndex(index)}
 * />
 * ```
 */
export function QuestionNavigationMap({
  questionIds,
  currentIndex,
  onNavigate,
  className = '',
}: QuestionNavigationMapProps) {
  const { answers } = useExamStore()

  /**
   * Check if a question has been answered
   */
  const isAnswered = (questionId: string): boolean => {
    const answer = answers.get(questionId)
    return answer !== undefined && answer !== null && answer !== ''
  }

  /**
   * Get button style based on question state
   */
  const getButtonStyle = (index: number, questionId: string): string => {
    const isCurrent = index === currentIndex
    const answered = isAnswered(questionId)

    if (isCurrent) {
      return 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400 ring-offset-2 font-bold'
    }

    if (answered) {
      return 'bg-green-600 text-white border-green-600 hover:bg-green-700'
    }

    return 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
  }

  return (
    <div className={`bg-gray-50 border border-gray-300 rounded-lg p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
        Question Navigator
      </h3>
      <div className="grid grid-cols-10 gap-2">
        {questionIds.map((questionId, index) => {
          const isCurrent = index === currentIndex
          const answered = isAnswered(questionId)

          return (
            <button
              key={questionId}
              onClick={() => onNavigate(index)}
              className={`
                h-10 w-10 rounded-md border-2 transition-all
                flex items-center justify-center text-sm font-medium
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                ${getButtonStyle(index, questionId)}
              `}
              aria-label={`Question ${index + 1}${isCurrent ? ' (current)' : ''}${answered ? ' (answered)' : ''}`}
              title={`Question ${index + 1}${isCurrent ? ' (current)' : ''}${answered ? ' (answered)' : ''}`}
            >
              {index + 1}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-blue-600 border-2 border-blue-600"></div>
          <span>Current</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-green-600 border-2 border-green-600"></div>
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-white border-2 border-gray-300"></div>
          <span>Unanswered</span>
        </div>
      </div>
    </div>
  )
}
