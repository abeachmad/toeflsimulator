import { useNavigate } from 'react-router-dom'
import { useExamStore } from '../stores'
import type { SectionScore } from '../stores/examStore'

type SectionKey = 'reading' | 'listening' | 'writing' | 'speaking'

const SECTION_ORDER: SectionKey[] = ['reading', 'listening', 'writing', 'speaking']

const SECTION_LABELS: Record<SectionKey, string> = {
  reading: 'Reading',
  listening: 'Listening',
  writing: 'Writing',
  speaking: 'Speaking',
}

const CEFR_LABELS: Record<number, string> = {
  1: 'A1',
  2: 'A2',
  3: 'B1',
  4: 'B2',
  5: 'C1',
  6: 'C2',
}

function cefrLabel(band: number): string {
  return CEFR_LABELS[band] ?? `B${band}`
}

function ScoreCard({
  section,
  score,
}: {
  section: SectionKey
  score: SectionScore | undefined
}) {
  const hasScore = score !== undefined
  return (
    <div
      className="bg-ets-charcoal border border-gray-600 rounded-lg p-6"
      role="region"
      aria-label={`${SECTION_LABELS[section]} score`}
    >
      <h3 className="text-ets-light-blue font-semibold mb-4 uppercase text-sm tracking-wide">
        {SECTION_LABELS[section]}
      </h3>
      <div className="flex justify-between items-center">
        <span className="text-gray-400 text-sm">Scale Score</span>
        <span className="text-2xl font-bold text-white">
          {hasScore ? `${score.scaleScore}/30` : '--/30'}
        </span>
      </div>
      <div className="flex justify-between items-center mt-2">
        <span className="text-gray-400 text-sm">CEFR Band</span>
        <span className="text-xl font-semibold text-ets-light-blue">
          {hasScore ? cefrLabel(score.cefrBand) : '--'}
        </span>
      </div>
      {hasScore && score.feedback && (
        <p className="mt-3 text-gray-300 text-xs leading-relaxed border-t border-gray-600 pt-3">
          {score.feedback}
        </p>
      )}
    </div>
  )
}

/**
 * ScoreReport Component
 *
 * Displays final exam scores with CEFR bands and scale scores per section
 * and the total score (sum of four section scale scores, 0–120).
 *
 * Requirements: 9.1, 9.2, 9.4, 9.5
 */
export function ScoreReport() {
  const navigate = useNavigate()
  const { sessionId, sectionScores, reset } = useExamStore()

  const handleReturnHome = () => {
    reset()
    navigate('/')
  }

  // Calculate total score (sum of all section scale scores, 0–120)
  const totalScore = SECTION_ORDER.reduce((acc, section) => {
    const s = sectionScores[section]
    return acc + (s ? s.scaleScore : 0)
  }, 0)

  const sectionsComplete = SECTION_ORDER.filter((s) => sectionScores[s] !== undefined)
  const allComplete = sectionsComplete.length === 4

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-ets-charcoal rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-white mb-4">No Session Found</h2>
          <p className="text-gray-400 mb-6">
            Please complete an exam before viewing scores.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-ets-blue hover:bg-ets-blue-dark text-white font-semibold py-3 px-4 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-ets-blue"
          >
            Return Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-gray-900 p-8"
      role="main"
      aria-label="TOEFL score report"
    >
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-ets-navy border-b border-gray-700 p-6 text-center">
            <h1 className="text-3xl font-bold text-white mb-1">
              TOEFL iBT 2026 Score Report
            </h1>
            <p className="text-gray-300 text-sm">Practice Test Results</p>
          </div>

          <div className="p-8">
            {/* Total score */}
            <div className="text-center mb-8">
              <div
                className="inline-block bg-ets-charcoal border border-gray-600 rounded-lg p-6 min-w-[180px]"
                role="region"
                aria-label="Total score"
              >
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">
                  Total Score
                </p>
                <p className="text-5xl font-bold text-white">
                  {allComplete ? totalScore : `${totalScore}`}
                  <span className="text-2xl text-gray-400">/120</span>
                </p>
                {!allComplete && (
                  <p className="text-yellow-400 text-xs mt-2">
                    {sectionsComplete.length}/4 sections completed
                  </p>
                )}
              </div>
            </div>

            {/* Section score cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {SECTION_ORDER.map((section) => (
                <ScoreCard
                  key={section}
                  section={section}
                  score={sectionScores[section]}
                />
              ))}
            </div>

            {/* Disclaimer */}
            <div className="bg-ets-charcoal border border-gray-700 rounded-lg p-4 mb-6">
              <p className="text-gray-400 text-xs text-center">
                This is a practice test. Scores are not official TOEFL iBT scores and
                cannot be used for admission or visa purposes.
              </p>
            </div>

            <button
              onClick={handleReturnHome}
              className="w-full bg-ets-blue hover:bg-ets-blue-dark text-white font-bold py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ets-blue focus:ring-offset-2 focus:ring-offset-gray-900"
              aria-label="Return to home page"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
