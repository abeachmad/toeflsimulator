import { useState } from 'react'
import type { ReactNode } from 'react'
import { useUIStore } from '../stores/uiStore'

/**
 * LockedQuestionIndicator Component Props
 */
interface LockedQuestionIndicatorProps {
  /** Unique question ID */
  questionId: string
  /** Question content to display */
  children: ReactNode
  /** CSS class name for custom styling */
  className?: string
}

/**
 * LockedQuestionIndicator Component
 * 
 * Wraps question content and enforces Gatekeeper rules:
 * - Displays visual lock indicator when question is locked
 * - Prevents input on locked questions
 * - Shows notification when user attempts to answer locked question
 * 
 * @component
 * @example
 * ```tsx
 * <LockedQuestionIndicator questionId="q1">
 *   <div>Question content and inputs</div>
 * </LockedQuestionIndicator>
 * ```
 * 
 * **Requirements Validated:**
 * - Requirement 11.5: Visual indication of locked question state
 * - Requirement 11.6: Prevent input and display notification on locked questions
 */
export function LockedQuestionIndicator({
  questionId,
  children,
  className = '',
}: LockedQuestionIndicatorProps) {
  const { lockedQuestions } = useUIStore()
  const [showNotification, setShowNotification] = useState(false)
  
  const isLocked = lockedQuestions.has(questionId)

  /**
   * Handle click on locked question
   * Shows notification as per Requirement 11.6
   */
  const handleLockedClick = () => {
    if (isLocked) {
      setShowNotification(true)
      
      // Auto-hide notification after 3 seconds
      setTimeout(() => {
        setShowNotification(false)
      }, 3000)
    }
  }

  return (
    <div className={`relative ${className}`}>
      {/* Visual Lock Indicator (Requirement 11.5) */}
      {isLocked && (
        <div className="absolute top-0 right-0 z-20 flex items-center gap-2 bg-amber-600 text-white px-3 py-1 rounded-bl-lg rounded-tr-lg shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span className="text-sm font-medium">Locked</span>
        </div>
      )}

      {/* Locked Overlay with Click Handler (Requirement 11.6) */}
      {isLocked && (
        <div
          onClick={handleLockedClick}
          className="absolute inset-0 z-10 cursor-not-allowed rounded-lg"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}
          aria-label="Question locked until passage is read"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleLockedClick()
            }
          }}
        />
      )}

      {/* Notification when attempting to answer locked question (Requirement 11.6) */}
      {showNotification && isLocked && (
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 bg-amber-500 text-white px-6 py-4 rounded-lg shadow-2xl max-w-md animate-fade-in"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="font-semibold text-sm">Question Locked</p>
              <p className="text-sm mt-1">
                Please scroll to the bottom of the passage on the right to unlock this question.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Question Content */}
      <div className={isLocked ? 'pointer-events-none select-none' : ''}>
        {children}
      </div>
    </div>
  )
}
