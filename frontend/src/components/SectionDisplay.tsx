import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useExamStore } from '../stores'
import { ReviewModal } from './ReviewModal'
import { QuestionDisplay, type ReadingQuestion } from './QuestionDisplay'
import { ListeningQuestionDisplay, type ListeningQuestion } from './ListeningQuestionDisplay'
import { PassageViewer } from './PassageViewer'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

/**
 * SectionDisplay Component
 * Displays the current exam section (reading, listening, writing, speaking)
 * Fetches items from backend and renders them using QuestionDisplay components
 */
export function SectionDisplay() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { sessionId, currentSection, setCurrentSection } = useExamStore()
  
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentItemIndex, setCurrentItemIndex] = useState(0)

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

  // Fetch items for current section
  useEffect(() => {
    if (!id) return

    const fetchItems = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch(
          `${API_URL}/api/items/section/${id}?limit=50`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) {
          throw new Error(`Failed to fetch items: ${response.statusText}`)
        }

        const data = await response.json()
        
        // Transform backend items to frontend format
        const transformedItems = data.items.map((item: any) => ({
          id: item.item_id,
          section: item.section,
          type: item.type,
          difficulty_level: item.difficulty_level,
          stage: item.stage,
          content: item.content,
          options: item.options,
          correct_answer: item.correct_answer,
          irt_a: item.irt_parameters?.a || 1.0,
          irt_b: item.irt_parameters?.b || 0.0,
          irt_c: item.irt_parameters?.c || 0.2,
          metadata: item.metadata,
        }))

        setItems(transformedItems)
      } catch (err) {
        console.error('Error fetching items:', err)
        setError(err instanceof Error ? err.message : 'Failed to load items')
      } finally {
        setLoading(false)
      }
    }

    fetchItems()
  }, [id])

  if (!sessionId) {
    return null
  }

  const currentItem = items[currentItemIndex]
  const questionIds = items.map(item => item.id)

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-white font-semibold text-lg capitalize">
            {id || 'Section'} Section
          </h1>
          <div className="text-gray-300 text-sm">
            Question {currentItemIndex + 1} of {items.length}
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="max-w-7xl mx-auto p-8">
        {loading && (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <div className="flex items-center justify-center space-x-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="text-gray-300">Loading questions...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-600 rounded-lg p-6 text-center">
            <p className="text-red-200 font-semibold mb-2">Error Loading Questions</p>
            <p className="text-red-300 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded transition"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-6 text-center">
            <p className="text-yellow-200 font-semibold mb-2">⚠️ No Questions Available</p>
            <p className="text-yellow-300 text-sm">
              This section doesn't have any questions yet. Please contact support.
            </p>
          </div>
        )}

        {!loading && !error && currentItem && (
          <>
            {id === 'reading' ? (
              <PassageViewer
                passage={extractPassageFromContent(currentItem.content)}
                questionIds={questionIds}
              >
                <QuestionDisplay question={currentItem as ReadingQuestion} />
                
                {/* Navigation buttons */}
                <div className="mt-6 flex items-center justify-between">
                  <button
                    onClick={() => setCurrentItemIndex(Math.max(0, currentItemIndex - 1))}
                    disabled={currentItemIndex === 0}
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded transition"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setCurrentItemIndex(Math.min(items.length - 1, currentItemIndex + 1))}
                    disabled={currentItemIndex === items.length - 1}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded transition"
                  >
                    Next →
                  </button>
                </div>
              </PassageViewer>
            ) : (
              <div className="max-w-4xl mx-auto">
                {id === 'listening' && (
                  <ListeningQuestionDisplay question={currentItem as ListeningQuestion} />
                )}
                {(id === 'writing' || id === 'speaking') && (
                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="text-gray-300 space-y-4">
                      <h3 className="text-xl font-semibold text-white capitalize">{id} Task</h3>
                      <div className="prose prose-invert max-w-none">
                        <p className="text-gray-300 whitespace-pre-wrap">{currentItem.content}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Navigation buttons */}
                <div className="mt-6 flex items-center justify-between">
                  <button
                    onClick={() => setCurrentItemIndex(Math.max(0, currentItemIndex - 1))}
                    disabled={currentItemIndex === 0}
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded transition"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setCurrentItemIndex(Math.min(items.length - 1, currentItemIndex + 1))}
                    disabled={currentItemIndex === items.length - 1}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded transition"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ReviewModal */}
      <ReviewModal questionIds={questionIds} />
    </div>
  )
}

/**
 * Extract passage text from question content for PassageViewer
 */
function extractPassageFromContent(content: string): string {
  try {
    const parsed = JSON.parse(content)
    return parsed.passage || parsed.context || 'Passage content will appear here.'
  } catch {
    return 'Passage content will appear here.'
  }
}
