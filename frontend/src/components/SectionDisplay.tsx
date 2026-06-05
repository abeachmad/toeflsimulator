import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useExamStore } from '../stores'
import { ReviewModal } from './ReviewModal'

/**
 * SectionDisplay Component
 * Displays the current exam section (reading, listening, writing, speaking)
 * Includes ReviewModal integration for question navigation
 * Placeholder implementation - will be expanded in later tasks
 */
export function SectionDisplay() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { sessionId, currentSection, setCurrentSection } = useExamStore()

  // TODO: Replace with actual question IDs from current module
  // This will be populated when question display is implemented
  const currentModuleQuestionIds: string[] = []

  useEffect(() => {
    // Validate session exists
    if (!sessionId) {
      navigate('/exam/start')
      return
    }

    // Update current section if different
    if (id && id !== currentSection) {
      setCurrentSection(id as 'reading' | 'listening' | 'writing' | 'speaking')
    }
  }, [id, sessionId, currentSection, setCurrentSection, navigate])

  if (!sessionId) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header will be implemented in later tasks */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-white font-semibold text-lg capitalize">
            {id || 'Section'} Section
          </h1>
          <div className="text-gray-400 text-sm">
            Session: {sessionId.substring(0, 16)}...
          </div>
        </div>
      </header>

      {/* Main content area - placeholder */}
      <main className="max-w-7xl mx-auto p-8">
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-4">
            {id ? `${id.charAt(0).toUpperCase() + id.slice(1)} Section` : 'Section'}
          </h2>
          <p className="text-gray-300 mb-6">
            This section will display exam questions and content.
          </p>
          <p className="text-gray-400 text-sm mb-6">
            Content rendering will be implemented in subsequent tasks.
          </p>
          <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4 text-yellow-200">
            <p className="font-semibold mb-2">⚠️ Database Needs More Test Items</p>
            <p className="text-sm">The database currently has only 6 test items. The system needs 150+ items to function properly.</p>
          </div>
        </div>
      </main>

      {/* ReviewModal - renders conditionally based on uiStore.isReviewModalOpen */}
      <ReviewModal questionIds={currentModuleQuestionIds} />
    </div>
  )
}
