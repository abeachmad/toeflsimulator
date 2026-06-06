import { useNavigate } from 'react-router-dom'

/**
 * Landing Page Component
 * Entry point for the TOEFL simulator application
 */
export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            TOEFL iBT 2026 Test Simulator
          </h1>
          <p className="text-gray-400 text-lg">
            Official adaptive testing experience with AI-powered grading
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-white mb-6">Test Overview</h2>
          <div className="space-y-4 mb-8">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                <span className="text-white font-semibold">1</span>
              </div>
              <div>
                <h3 className="text-white font-semibold">Reading Section</h3>
                <p className="text-gray-400 text-sm">20 questions, 35 minutes</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                <span className="text-white font-semibold">2</span>
              </div>
              <div>
                <h3 className="text-white font-semibold">Listening Section</h3>
                <p className="text-gray-400 text-sm">28 questions, 36 minutes</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                <span className="text-white font-semibold">3</span>
              </div>
              <div>
                <h3 className="text-white font-semibold">Writing Section</h3>
                <p className="text-gray-400 text-sm">2 tasks, 29 minutes</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                <span className="text-white font-semibold">4</span>
              </div>
              <div>
                <h3 className="text-white font-semibold">Speaking Section</h3>
                <p className="text-gray-400 text-sm">4 tasks, 16 minutes</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/exam/start')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg"
          >
            Start Practice Test
          </button>

          <p className="text-gray-500 text-sm text-center mt-4">
            Total test time: ~116 minutes
          </p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            This is a practice test simulator. Your results are not official TOEFL scores.
          </p>
        </div>
      </div>
    </div>
  )
}
