import { useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useUIStore } from '../stores/uiStore'

/**
 * PassageViewer Component Props
 */
interface PassageViewerProps {
  /** Reading passage content to display on the right side */
  passage: string
  /** Questions component to display on the left side */
  children: ReactNode
  /** Callback when passage is fully scrolled (scroll-to-bottom detected) */
  onPassageFullyScrolled?: () => void
  /** CSS class name for custom styling */
  className?: string
}

/**
 * PassageViewer Component
 * 
 * Implements split-screen layout for Reading section:
 * - Questions on left side
 * - Passage on right side with scrollable container
 * - Tracks scroll position and emits event when passage is fully scrolled
 * - Styled with official ETS split-screen design
 * - Implements Gatekeeper rule enforcement for passage reading
 * 
 * @component
 * @example
 * ```tsx
 * <PassageViewer
 *   passage="Long reading passage text..."
 *   questionIds={['q1', 'q2', 'q3']}
 *   onPassageFullyScrolled={() => console.log('Passage fully read')}
 * >
 *   <div>Question content here</div>
 * </PassageViewer>
 * ```
 * 
 * **Requirements Validated:**
 * - Requirement 3.9: Split-screen layout (passage right, questions left)
 * - Requirement 10.3: Responsive layout
 * - Requirement 11.1: Lock questions when passage displayed with contentHeight > 0
 * - Requirement 11.2: Track scroll position
 * - Requirement 11.3: Unlock questions when bottom reached
 * - Requirement 11.4: Handle passages with contentHeight = 0 (no locking)
 */
export function PassageViewer({
  passage,
  children,
  onPassageFullyScrolled,
  className = '',
}: PassageViewerProps) {
  const passageRef = useRef<HTMLDivElement>(null)
  const hasScrolledToBottomRef = useRef(false)
  
  const { 
    setGatekeeperActive, 
    unlockAllQuestions
  } = useUIStore()

  /**
   * Handle scroll event on passage container
   * Detects when user has scrolled to the bottom of the passage
   * Uses the formula: scrollTop + clientHeight >= scrollHeight
   * Unlocks all questions when bottom is reached (Requirement 11.3)
   */
  const handleScroll = () => {
    if (!passageRef.current || hasScrolledToBottomRef.current) {
      return
    }

    const { scrollTop, clientHeight, scrollHeight } = passageRef.current

    // Check if scrolled to bottom (with 1px tolerance for rounding)
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1

    if (isAtBottom) {
      hasScrolledToBottomRef.current = true
      
      // Unlock all questions (Requirement 11.3)
      unlockAllQuestions()
      setGatekeeperActive(false)
      
      // Notify parent component
      onPassageFullyScrolled?.()
    }
  }

  /**
   * Initialize - no gatekeeper, questions always unlocked
   */
  useEffect(() => {
    // Always unlock all questions - no gatekeeper
    setGatekeeperActive(false)
    unlockAllQuestions()
  }, [setGatekeeperActive, unlockAllQuestions])

  return (
    <div className={`flex flex-col lg:flex-row h-full min-h-screen ${className}`}>
      {/* Left side: Questions */}
      <div className="w-full lg:w-1/2 bg-gray-50 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto">{children}</div>
      </div>

      {/* Right side: Reading Passage */}
      <div className="w-full lg:w-1/2 bg-white border-l border-gray-300">
        <div
          ref={passageRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto p-8"
        >
          <div className="max-w-2xl mx-auto">
            <div className="prose prose-gray prose-lg max-w-none">
              {/* Render passage with proper formatting */}
              {passage.split('\n\n').map((paragraph, index) => (
                <p key={index} className="text-gray-900 mb-4 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
