import React from 'react'
import { useUIStore } from '../stores/uiStore'
import { useExamStore } from '../stores/examStore'

export interface ReviewModalProps {
  /** Array of question IDs in the current module */
  questionIds: string[]
  /** Maximum number of questions to display (optional) */
  maxQuestions?: number
}

type QuestionStatus = 'answered' | 'unanswered' | 'not-seen'

/**
 * ReviewModal Component
 * 
 * Displays a grid of all questions in the current module with status indicators.
 * Allows navigation to any question within the current module.
 * 
 * Visual Design:
 * - Dark modal overlay with centered content
 * - Grid layout showing question numbers
 * - Status indicators: answered (green), unanswered (yellow), not seen (gray)
 * - Click handler to navigate to selected question
 * - Close button to dismiss modal
 * - Official ETS color scheme
 * 
 * Requirements: 12.1, 12.3, 12.4, 12.5, 12.6
 */
export const ReviewModal: React.FC<ReviewModalProps> = ({ 
  questionIds,
  maxQuestions 
}) => {
  const { isReviewModalOpen, closeReviewModal } = useUIStore()
  const { answers, goToQuestion, currentQuestionIndex } = useExamStore()

  // Don't render if modal is not open
  if (!isReviewModalOpen) {
    return null
  }

  // Determine the status of a question
  const getQuestionStatus = (questionId: string, index: number): QuestionStatus => {
    // Check if question has been answered
    const hasAnswer = answers.has(questionId)
    
    if (hasAnswer) {
      return 'answered'
    }
    
    // Check if question has been seen (visited)
    // A question is "seen" if we've navigated to or past it
    const isSeen = index <= currentQuestionIndex
    
    if (isSeen) {
      return 'unanswered'
    }
    
    return 'not-seen'
  }

  // Handle question click - navigate to question and close modal
  const handleQuestionClick = (index: number) => {
    goToQuestion(index)
    closeReviewModal()
  }

  // Get status color classes
  const getStatusColor = (status: QuestionStatus): string => {
    switch (status) {
      case 'answered':
        return 'bg-green-500 hover:bg-green-600 text-white'
      case 'unanswered':
        return 'bg-yellow-500 hover:bg-yellow-600 text-white'
      case 'not-seen':
        return 'bg-gray-400 hover:bg-gray-500 text-white'
    }
  }

  // Get status label for accessibility
  const getStatusLabel = (status: QuestionStatus): string => {
    switch (status) {
      case 'answered':
        return 'Answered'
      case 'unanswered':
        return 'Unanswered'
      case 'not-seen':
        return 'Not seen'
    }
  }

  // Determine which questions to display
  const displayQuestions = maxQuestions 
    ? questionIds.slice(0, maxQuestions) 
    : questionIds

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
      onClick={closeReviewModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
    >
      <div
        className="bg-ets-charcoal rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-600">
          <h2 
            id="review-modal-title"
            className="text-2xl font-semibold text-white"
          >
            Review Questions
          </h2>
          <button
            onClick={closeReviewModal}
            className="text-white hover:text-gray-300 text-3xl font-bold leading-none transition-colors"
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Legend */}
        <div className="px-6 py-4 bg-gray-800 border-b border-gray-600">
          <div className="flex flex-wrap gap-6 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span className="text-white text-sm">Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500"></div>
              <span className="text-white text-sm">Unanswered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-400"></div>
              <span className="text-white text-sm">Not Seen</span>
            </div>
          </div>
        </div>

        {/* Question Grid */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
            {displayQuestions.map((questionId, index) => {
              const status = getQuestionStatus(questionId, index)
              const statusColor = getStatusColor(status)
              const statusLabel = getStatusLabel(status)
              const isCurrentQuestion = index === currentQuestionIndex

              return (
                <button
                  key={questionId}
                  onClick={() => handleQuestionClick(index)}
                  className={`
                    ${statusColor}
                    rounded-md py-3 px-2 font-semibold text-sm
                    transition-all duration-200
                    focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-ets-charcoal
                    ${isCurrentQuestion ? 'ring-2 ring-white ring-offset-2 ring-offset-ets-charcoal' : ''}
                  `}
                  aria-label={`Question ${index + 1}: ${statusLabel}${isCurrentQuestion ? ' (current)' : ''}`}
                  title={`Question ${index + 1}: ${statusLabel}`}
                >
                  {index + 1}
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-800 border-t border-gray-600 flex justify-end">
          <button
            onClick={closeReviewModal}
            className="px-6 py-2 bg-ets-blue text-white rounded-md hover:bg-ets-blue-dark transition-colors font-semibold focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800"
            aria-label="Close review modal"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
