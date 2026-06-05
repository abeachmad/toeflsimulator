import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExamStore } from '../stores'

/**
 * ExamStart Component
 * Handles session initialization and state restoration
 * Requirements: 18.4 (session initialization), 1.1-1.4 (session management)
 */
export function ExamStart() {
  const navigate = useNavigate()
  const { sessionId, setSession, reset } = useExamStore()
  const [isRestoring, setIsRestoring] = useState(true)
  const [hasExistingSession, setHasExistingSession] = useState(false)

  useEffect(() => {
    // Check if there's an existing session in localStorage
    const checkExistingSession = async () => {
      try {
        if (sessionId) {
          // Session exists - offer to restore
          setHasExistingSession(true)
        }
      } catch (error) {
        console.error('Failed to check existing session:', error)
      } finally {
        setIsRestoring(false)
      }
    }

    checkExistingSession()
  }, [sessionId])

  const handleStartNewSession = async () => {
    try {
      // Generate new session ID
      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Initialize session on backend
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const response = await fetch(`${apiUrl}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: newSessionId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to initialize session')
      }

      // Initialize local store
      setSession({
        sessionId: newSessionId,
        currentSection: 'reading',
        currentModule: null,
        currentQuestionIndex: 0,
      })

      // Navigate to first section
      navigate('/exam/section/reading')
    } catch (error) {
      console.error('Failed to start new session:', error)
      alert('Failed to start exam session. Please try again.')
    }
  }

  const handleResumeSession = () => {
    // State is already restored from localStorage via Zustand persist
    // Navigate to current section
    const { currentSection } = useExamStore.getState()
    if (currentSection) {
      navigate(`/exam/section/${currentSection}`)
    } else {
      // Fallback to reading if no section set
      navigate('/exam/section/reading')
    }
  }

  const handleStartFresh = () => {
    // Clear existing session and start new
    reset()
    handleStartNewSession()
  }

  if (isRestoring) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (hasExistingSession) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="flex items-center justify-center w-16 h-16 bg-yellow-500 rounded-full mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            Existing Session Found
          </h2>
          <p className="text-gray-400 text-center mb-6">
            We found a previous exam session. Would you like to continue where you left
            off or start a new test?
          </p>
          <div className="space-y-3">
            <button
              onClick={handleResumeSession}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded transition-colors"
            >
              Resume Previous Session
            </button>
            <button
              onClick={handleStartFresh}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded transition-colors"
            >
              Start New Test
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-transparent hover:bg-gray-700 text-gray-400 hover:text-white font-semibold py-3 px-4 rounded transition-colors border border-gray-600"
            >
              Cancel
            </button>
          </div>
          <p className="text-gray-500 text-sm text-center mt-4">
            Starting a new test will erase your previous progress.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-white text-center mb-6">
          Ready to Begin?
        </h2>
        <div className="bg-gray-700 rounded-lg p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">Important Instructions:</h3>
          <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
            <li>The test will take approximately 90 minutes</li>
            <li>You cannot pause or stop the timer once started</li>
            <li>Your progress is automatically saved</li>
            <li>You can navigate within each section but not back to previous sections</li>
            <li>Make sure you have a stable internet connection</li>
          </ul>
        </div>
        <button
          onClick={handleStartNewSession}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg"
        >
          Begin Test
        </button>
        <button
          onClick={() => navigate('/')}
          className="w-full mt-3 bg-transparent hover:bg-gray-700 text-gray-400 hover:text-white font-semibold py-3 px-4 rounded transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  )
}
