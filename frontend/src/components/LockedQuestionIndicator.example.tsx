import { useState } from 'react'
import { PassageViewer } from './PassageViewer'
import { LockedQuestionIndicator } from './LockedQuestionIndicator'

/**
 * Example: Gatekeeper Rule Enforcement with PassageViewer and LockedQuestionIndicator
 * 
 * Demonstrates Requirements 11.1-11.6:
 * - Questions are locked when passage is displayed
 * - Scroll tracking detects when user reaches bottom
 * - Questions unlock when bottom is reached
 * - Visual lock indicators and notifications
 */
export function GatekeeperExample() {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)

  const passage = `
The Industrial Revolution, which began in Britain in the late 18th century, marked a major turning point in human history. It transformed economies that had been based on agriculture and handicrafts into economies based on large-scale industry, mechanized manufacturing, and the factory system.

The revolution started with the mechanization of the textile industry. Inventions such as the spinning jenny, the water frame, and the power loom dramatically increased productivity. These machines could produce far more cloth in a given time than traditional hand-operated methods.

The development of the steam engine by James Watt in the 1760s and 1770s was particularly significant. Steam power could be used to drive machinery in factories, power locomotives, and propel ships. This technological breakthrough freed industry from dependence on water power and allowed factories to be located anywhere.

The Industrial Revolution brought about profound social and economic changes. It led to rapid urbanization as people moved from rural areas to cities in search of factory work. Living conditions in industrial cities were often poor, with overcrowding and pollution becoming serious problems.

However, the revolution also led to increased production of goods, higher standards of living for many, and the growth of a middle class. It fundamentally changed how people worked and lived, setting the stage for the modern industrial economy.
  `.trim()

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-white text-xl font-semibold">
            Reading Section - Gatekeeper Example
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {hasScrolledToBottom
              ? '✓ Passage fully read - Questions unlocked'
              : 'Scroll to the bottom of the passage to unlock questions'}
          </p>
        </div>
      </div>

      <PassageViewer
        passage={passage}
        onPassageFullyScrolled={() => {
          setHasScrolledToBottom(true)
          console.log('Passage fully scrolled - questions unlocked!')
        }}
      >
        <div className="space-y-8">
          {/* Question 1 */}
          <LockedQuestionIndicator questionId="q1">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-white text-lg font-semibold mb-4">
                Question 1
              </h3>
              <p className="text-gray-300 mb-4">
                What was particularly significant about the development of the steam engine?
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 text-gray-300 cursor-pointer hover:bg-gray-700 p-3 rounded">
                  <input
                    type="radio"
                    name="q1"
                    value="a"
                    className="text-blue-500"
                  />
                  <span>It was used to make textiles</span>
                </label>
                <label className="flex items-center gap-3 text-gray-300 cursor-pointer hover:bg-gray-700 p-3 rounded">
                  <input
                    type="radio"
                    name="q1"
                    value="b"
                    className="text-blue-500"
                  />
                  <span>It freed industry from dependence on water power</span>
                </label>
                <label className="flex items-center gap-3 text-gray-300 cursor-pointer hover:bg-gray-700 p-3 rounded">
                  <input
                    type="radio"
                    name="q1"
                    value="c"
                    className="text-blue-500"
                  />
                  <span>It was invented in the 19th century</span>
                </label>
                <label className="flex items-center gap-3 text-gray-300 cursor-pointer hover:bg-gray-700 p-3 rounded">
                  <input
                    type="radio"
                    name="q1"
                    value="d"
                    className="text-blue-500"
                  />
                  <span>It reduced pollution in cities</span>
                </label>
              </div>
            </div>
          </LockedQuestionIndicator>

          {/* Question 2 */}
          <LockedQuestionIndicator questionId="q2">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-white text-lg font-semibold mb-4">
                Question 2
              </h3>
              <p className="text-gray-300 mb-4">
                According to the passage, what was one negative consequence of the Industrial Revolution?
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 text-gray-300 cursor-pointer hover:bg-gray-700 p-3 rounded">
                  <input
                    type="radio"
                    name="q2"
                    value="a"
                    className="text-blue-500"
                  />
                  <span>Decreased production of goods</span>
                </label>
                <label className="flex items-center gap-3 text-gray-300 cursor-pointer hover:bg-gray-700 p-3 rounded">
                  <input
                    type="radio"
                    name="q2"
                    value="b"
                    className="text-blue-500"
                  />
                  <span>Poor living conditions in industrial cities</span>
                </label>
                <label className="flex items-center gap-3 text-gray-300 cursor-pointer hover:bg-gray-700 p-3 rounded">
                  <input
                    type="radio"
                    name="q2"
                    value="c"
                    className="text-blue-500"
                  />
                  <span>Lower standards of living</span>
                </label>
                <label className="flex items-center gap-3 text-gray-300 cursor-pointer hover:bg-gray-700 p-3 rounded">
                  <input
                    type="radio"
                    name="q2"
                    value="d"
                    className="text-blue-500"
                  />
                  <span>Dependence on water power</span>
                </label>
              </div>
            </div>
          </LockedQuestionIndicator>

          {/* Question 3 */}
          <LockedQuestionIndicator questionId="q3">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-white text-lg font-semibold mb-4">
                Question 3
              </h3>
              <p className="text-gray-300 mb-4">
                Which of the following best describes the overall impact of the Industrial Revolution?
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 text-gray-300 cursor-pointer hover:bg-gray-700 p-3 rounded">
                  <input
                    type="radio"
                    name="q3"
                    value="a"
                    className="text-blue-500"
                  />
                  <span>It had only negative consequences</span>
                </label>
                <label className="flex items-center gap-3 text-gray-300 cursor-pointer hover:bg-gray-700 p-3 rounded">
                  <input
                    type="radio"
                    name="q3"
                    value="b"
                    className="text-blue-500"
                  />
                  <span>It fundamentally changed how people worked and lived</span>
                </label>
                <label className="flex items-center gap-3 text-gray-300 cursor-pointer hover:bg-gray-700 p-3 rounded">
                  <input
                    type="radio"
                    name="q3"
                    value="c"
                    className="text-blue-500"
                  />
                  <span>It had no effect on urban development</span>
                </label>
                <label className="flex items-center gap-3 text-gray-300 cursor-pointer hover:bg-gray-700 p-3 rounded">
                  <input
                    type="radio"
                    name="q3"
                    value="d"
                    className="text-blue-500"
                  />
                  <span>It decreased productivity in manufacturing</span>
                </label>
              </div>
            </div>
          </LockedQuestionIndicator>
        </div>
      </PassageViewer>
    </div>
  )
}

/**
 * Example: Passage with No Content (contentHeight = 0)
 * Demonstrates Requirement 11.4: No locking when contentHeight = 0
 */
export function NoPassageExample() {
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-white text-xl font-semibold">
            Reading Section - No Passage Example
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Questions with no passage should be unlocked immediately
          </p>
        </div>
      </div>

      <PassageViewer
        passage="" // Empty passage - contentHeight = 0
      >
        <div className="space-y-8">
          <LockedQuestionIndicator questionId="q1">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-white text-lg font-semibold mb-4">
                Question 1
              </h3>
              <p className="text-gray-300 mb-4">
                This question has no associated passage and should be immediately accessible.
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 text-gray-300 cursor-pointer hover:bg-gray-700 p-3 rounded">
                  <input
                    type="radio"
                    name="q1"
                    value="a"
                    className="text-blue-500"
                  />
                  <span>Option A</span>
                </label>
                <label className="flex items-center gap-3 text-gray-300 cursor-pointer hover:bg-gray-700 p-3 rounded">
                  <input
                    type="radio"
                    name="q1"
                    value="b"
                    className="text-blue-500"
                  />
                  <span>Option B</span>
                </label>
              </div>
            </div>
          </LockedQuestionIndicator>
        </div>
      </PassageViewer>
    </div>
  )
}
