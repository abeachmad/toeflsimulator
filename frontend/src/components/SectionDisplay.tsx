import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useExamStore } from '../stores'
import { ReviewModal } from './ReviewModal'
import { QuestionDisplay, type ReadingQuestion } from './QuestionDisplay'
import { ListeningQuestionDisplay, type ListeningQuestion } from './ListeningQuestionDisplay'
import { PassageViewer } from './PassageViewer'
import { QuestionNavigationMap } from './QuestionNavigationMap'
import { SectionTimer } from './SectionTimer'
import { WritingSection, type WritingQuestion } from './WritingSection'
import { AudioRecorder, type SpeakingQuestion } from './AudioRecorder'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Official TOEFL iBT 2026 question counts per section
const SECTION_LIMITS: Record<string, number> = {
  reading: 20,      // 2 passages × 10 questions
  listening: 28,    // 3 conversations (5Q each) + 3 lectures (6Q each)
  writing: 2,       // 2 tasks (Integrated + Academic Discussion)
  speaking: 4       // 4 tasks (1 independent + 3 integrated)
}

// Official TOEFL iBT 2026 time limits per section (in minutes)
const SECTION_TIME_LIMITS: Record<string, number> = {
  reading: 35,
  listening: 36,
  writing: 29,
  speaking: 16
}

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

  // Get time limit for current section (Requirements 2.5, 2.6)
  const timeLimit = id ? SECTION_TIME_LIMITS[id] || 60 : 60

  // Handle timer expiration - auto-submit and navigate (Requirements 2.6, 3.1)
  const handleTimerExpire = () => {
    // Navigate to next section when timer expires
    if (!id) return
    
    const nextSection = getNextSection(id)
    if (nextSection) {
      navigate(`/exam/section/${nextSection}`)
    } else {
      navigate('/exam/results')
    }
  }

  // Get next section in sequence (Requirement 4.1, 4.2, 4.3, 4.4)
  const getNextSection = (current: string): string | null => {
    const order = ['reading', 'listening', 'writing', 'speaking']
    const currentIndex = order.indexOf(current)
    if (currentIndex < 0 || currentIndex >= order.length - 1) {
      return null
    }
    return order[currentIndex + 1] as string
  }

  /**
   * Handle section completion - submit answers and navigate
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 8.1, 8.2
   */
  const handleSectionComplete = async () => {
    if (!id || !sessionId) {
      console.error('[handleSectionComplete] Missing section ID or session ID')
      return
    }

    // 1. Collect all answers from current section into submission payload (Requirement 3.2)
    const { answers } = useExamStore.getState()
    const sectionAnswers = Array.from(answers.entries())
      .filter(([itemId]) => items.some(item => item.id === itemId))
      .map(([itemId, answer]) => ({
        itemId,
        answer: typeof answer === 'string' ? answer : JSON.stringify(answer)
      }))

    console.log('[handleSectionComplete] Submitting section:', id)
    console.log('[handleSectionComplete] Session ID:', sessionId)
    console.log('[handleSectionComplete] Answer count:', sectionAnswers.length)
    console.log('[handleSectionComplete] Answers payload:', sectionAnswers)

    // 2. Make POST request to backend submission endpoint (Requirement 3.2, 8.1)
    let submissionSuccessful = false
    try {
      const response = await fetch(
        `${API_URL}/api/sessions/${sessionId}/sections/${id}/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ answers: sectionAnswers })
        }
      )

      if (!response.ok) {
        // Error handling for failed submissions with console logging (Requirement 8.1, 8.2)
        const errorText = await response.text()
        console.error('[handleSectionComplete] Submission failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })
        throw new Error(`Submission failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      console.log('[handleSectionComplete] Submission successful:', result)
      submissionSuccessful = true
      
      // Store score if returned (for reading/listening sections)
      // Backend returns score in result.data.score
      const score = result.data?.score || result.score
      if (score) {
        const { setSectionScore } = useExamStore.getState()
        setSectionScore(id as 'reading' | 'listening' | 'writing' | 'speaking', score)
        console.log('[handleSectionComplete] Score stored:', score)
      } else {
        console.log('[handleSectionComplete] No score in response')
      }
    } catch (error) {
      // Error handling with console logging (Requirement 8.1, 8.2)
      console.error('[handleSectionComplete] Error during submission:', error)
      // Continue to navigation even if submission fails (user should not be blocked)
    }

    // 3. Navigate to next section (Requirements 3.3, 3.4, 4.1, 4.2, 4.3, 4.4)
    const nextSection = getNextSection(id)
    const targetPath = nextSection ? `/exam/section/${nextSection}` : '/exam/results'
    
    try {
      console.log('[handleSectionComplete] Attempting navigation to:', targetPath)
      navigate(targetPath)
      console.log('[handleSectionComplete] Navigation successful')
    } catch (navError) {
      // Requirement 3.4: If navigation fails after successful submission, leave user on current section
      console.error('[handleSectionComplete] Navigation failed:', navError)
      if (submissionSuccessful) {
        console.log('[handleSectionComplete] Keeping user on current section after submission success')
        // User stays on current section - no additional action needed
      }
    }
  }

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
        setCurrentItemIndex(0) // Reset to first question when section changes
        
        // Use dynamic limit based on section type (Requirements 1.1, 1.2, 1.3, 1.4)
        const limit = SECTION_LIMITS[id] || 50
        
        const response = await fetch(
          `${API_URL}/api/items/section/${id}?limit=${limit}`,
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
        
        console.log('[SectionDisplay] API Response:', data)
        
        // Handle different response formats
        // API returns: { message: string, data: { items: [], total: number } }
        const itemsArray = Array.isArray(data) ? data : (data.data?.items || data.items || [])
        
        console.log('[SectionDisplay] Items array length:', itemsArray.length)
        console.log('[SectionDisplay] First item:', itemsArray[0])
        
        // Transform backend items to frontend format
        const transformedItems = itemsArray.map((item: any) => ({
          id: item.id || item.item_id, // API returns 'id' (aliased from item_id)
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

        console.log('[SectionDisplay] Transformed items:', transformedItems.length)
        console.log('[SectionDisplay] First transformed item:', transformedItems[0])

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
  const isLastQuestion = currentItemIndex === items.length - 1

  const handleNext = () => {
    if (isLastQuestion) {
      // Submit section and navigate to next section
      handleSectionComplete()
    } else {
      setCurrentItemIndex(currentItemIndex + 1)
    }
  }

  console.log('[SectionDisplay] Render - items.length:', items.length)
  console.log('[SectionDisplay] Render - currentItemIndex:', currentItemIndex)
  console.log('[SectionDisplay] Render - currentItem:', currentItem)
  console.log('[SectionDisplay] Render - loading:', loading)
  console.log('[SectionDisplay] Render - error:', error)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gray-50 border-b border-gray-300 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-gray-900 font-semibold text-lg capitalize">
            {id || 'Section'} Section
          </h1>
          <div className="flex items-center gap-6">
            <div className="text-gray-700 text-sm">
              Question {currentItemIndex + 1} of {items.length}
            </div>
            {/* Section Timer - Requirements 2.5, 2.6, 2.7, 2.8 */}
            {id && (
              <SectionTimer
                section={id as 'reading' | 'listening' | 'writing' | 'speaking'}
                timeLimit={timeLimit}
                onExpire={handleTimerExpire}
              />
            )}
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="max-w-7xl mx-auto p-8">
        {/* Question Navigation Map */}
        {!loading && !error && items.length > 0 && (
          <div className="mb-6">
            <QuestionNavigationMap
              questionIds={questionIds}
              currentIndex={currentItemIndex}
              onNavigate={(index) => setCurrentItemIndex(index)}
            />
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-lg p-8 text-center border border-gray-300">
            <div className="flex items-center justify-center space-x-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-700">Loading questions...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-6 text-center">
            <p className="text-red-800 font-semibold mb-2">Error Loading Questions</p>
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-6 text-center">
            <p className="text-yellow-800 font-semibold mb-2">⚠️ No Questions Available</p>
            <p className="text-yellow-700 text-sm">
              This section doesn't have any questions yet. Please contact support.
            </p>
          </div>
        )}

        {!loading && !error && currentItem && (
          <>
            {id === 'reading' ? (
              <PassageViewer
                passage={extractPassageFromContent(currentItem.content)}
              >
                <QuestionDisplay question={currentItem as ReadingQuestion} />
                
                {/* Navigation buttons */}
                <div className="mt-6 flex items-center justify-between">
                  <button
                    onClick={() => setCurrentItemIndex(Math.max(0, currentItemIndex - 1))}
                    disabled={currentItemIndex === 0}
                    className="px-6 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 text-gray-900 rounded transition"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={handleNext}
                    className={`px-6 py-2 rounded transition text-white font-semibold ${
                      isLastQuestion 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isLastQuestion ? 'Complete Section →' : 'Next →'}
                  </button>
                </div>
              </PassageViewer>
            ) : (
              <div className="max-w-4xl mx-auto">
                {id === 'listening' && (
                  <ListeningQuestionDisplay question={currentItem as ListeningQuestion} />
                )}
                {id === 'writing' && (
                  <WritingSection
                    question={currentItem as WritingQuestion}
                    onSubmit={(_score) => {
                      // Store score automatically in WritingSection via setSectionScore
                      // Navigate to next task or complete section
                      if (!isLastQuestion) {
                        setCurrentItemIndex(currentItemIndex + 1)
                      } else {
                        handleSectionComplete()
                      }
                    }}
                  />
                )}
                {id === 'speaking' && (
                  <AudioRecorder
                    question={currentItem as SpeakingQuestion}
                    onSubmit={(_score) => {
                      // Store score automatically in AudioRecorder via setSectionScore
                      // Navigate to next task or complete section
                      if (!isLastQuestion) {
                        setCurrentItemIndex(currentItemIndex + 1)
                      } else {
                        handleSectionComplete()
                      }
                    }}
                    maxDurationSeconds={currentItem.metadata?.responseTime || 60}
                  />
                )}
                
                {/* Navigation buttons */}
                <div className="mt-6 flex items-center justify-between">
                  <button
                    onClick={() => setCurrentItemIndex(Math.max(0, currentItemIndex - 1))}
                    disabled={currentItemIndex === 0}
                    className="px-6 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 text-gray-900 rounded transition"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={handleNext}
                    className={`px-6 py-2 rounded transition text-white font-semibold ${
                      isLastQuestion 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isLastQuestion ? 'Complete Section →' : 'Next →'}
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
  if (!content) return ''
  
  try {
    const parsed = JSON.parse(content)
    // Try multiple possible fields for passage content
    return parsed.passage || parsed.text || parsed.scenario || ''
  } catch {
    // If content is not JSON, treat it as plain text passage
    // This handles multiple_choice questions where content IS the passage
    const trimmed = content.trim()
    return trimmed
  }
}
