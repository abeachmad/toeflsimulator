import { useTimerStore } from '../stores/timerStore'
import { useUIStore } from '../stores/uiStore'

interface HeaderProps {
  /**
   * Show volume control button (for listening section)
   */
  showVolumeControl?: boolean
  /**
   * Current section name (e.g., "Reading", "Listening")
   */
  sectionName?: string
  /**
   * Callback for hide button click (hides question, shows passage)
   */
  onHide?: () => void
  /**
   * Callback for next button click (navigates to next question)
   */
  onNext?: () => void
  /**
   * Disable next button (e.g., when on last question)
   */
  nextDisabled?: boolean
  /**
   * Callback for help button click
   */
  onHelp?: () => void
  /**
   * Callback for volume control click
   */
  onVolumeClick?: () => void
  /**
   * Current volume level (0-100)
   */
  volumeLevel?: number
}

/**
 * Header Component
 * 
 * Displays timer, volume control, help, review, and navigation buttons
 * according to official ETS TOEFL iBT 2026 design specifications
 * 
 * Requirements: 10.1, 10.2, 2.2
 * 
 * Features:
 * - Timer in HH:MM:SS format with countdown
 * - Volume control button (for listening section)
 * - Help button (opens help modal)
 * - Review button (opens ReviewModal)
 * - Hide/Next navigation buttons
 * - Dark charcoal/navy background with ETS color scheme
 */
export function Header({
  showVolumeControl = false,
  sectionName,
  onHide,
  onNext,
  nextDisabled = false,
  onHelp,
  onVolumeClick,
  volumeLevel = 75,
}: HeaderProps) {
  const { remainingTime } = useTimerStore()
  const { openReviewModal } = useUIStore()

  /**
   * Format remaining time in HH:MM:SS format
   */
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    const pad = (num: number) => num.toString().padStart(2, '0')

    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
  }

  const handleHelpClick = () => {
    if (onHelp) {
      onHelp()
    } else {
      // Default behavior: show help modal (to be implemented)
      console.log('Help button clicked')
    }
  }

  return (
    <header className="bg-ets-charcoal border-b border-gray-700 px-6 py-3 flex items-center justify-between">
      {/* Left section: Section name */}
      <div className="flex items-center gap-4">
        {sectionName && (
          <h1 className="text-white font-semibold text-lg">{sectionName}</h1>
        )}
      </div>

      {/* Center section: Timer */}
      <div className="flex-1 flex justify-center">
        <div className="bg-ets-navy px-6 py-2 rounded-md border border-gray-600">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span
              className={`font-mono text-xl font-semibold ${
                remainingTime < 300 ? 'text-red-400' : 'text-white'
              }`}
            >
              {formatTime(remainingTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Right section: Action buttons */}
      <div className="flex items-center gap-3">
        {/* Volume Control Button (Listening section only) */}
        {showVolumeControl && (
          <button
            onClick={onVolumeClick}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors flex items-center gap-2"
            aria-label="Volume control"
            title={`Volume: ${volumeLevel}%`}
          >
            {volumeLevel > 50 ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
              </svg>
            ) : volumeLevel > 0 ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                />
              </svg>
            )}
            <span className="text-sm">Volume</span>
          </button>
        )}

        {/* Help Button */}
        <button
          onClick={handleHelpClick}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors flex items-center gap-2"
          aria-label="Help"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm">Help</span>
        </button>

        {/* Review Button */}
        <button
          onClick={openReviewModal}
          className="px-4 py-2 bg-ets-blue hover:bg-ets-light-blue text-white rounded-md transition-colors flex items-center gap-2"
          aria-label="Review"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
          <span className="text-sm">Review</span>
        </button>

        {/* Hide Button */}
        {onHide && (
          <button
            onClick={onHide}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
            aria-label="Hide"
          >
            <span className="text-sm">Hide</span>
          </button>
        )}

        {/* Next Button */}
        {onNext && (
          <button
            onClick={onNext}
            disabled={nextDisabled}
            className="px-4 py-2 bg-ets-blue hover:bg-ets-light-blue text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-ets-blue"
            aria-label="Next"
          >
            <span className="text-sm font-medium">Next</span>
          </button>
        )}
      </div>
    </header>
  )
}
