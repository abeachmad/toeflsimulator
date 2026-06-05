/**
 * PassageViewer Component Usage Examples
 * 
 * This file demonstrates how to use the PassageViewer component
 * in various scenarios for the TOEFL Reading section.
 */

import { PassageViewer } from './PassageViewer'
import { useUIStore } from '../stores'

/**
 * Example 1: Basic usage with passage and questions
 */
export function BasicPassageViewerExample() {
  const samplePassage = `The Industrial Revolution, which began in Britain in the late 18th century, marked a major turning point in human history. It transformed economies that had been based on agriculture and handicrafts into economies based on large-scale industry, mechanized manufacturing, and the factory system.

New machines, new power sources, and new ways of organizing work made existing industries more productive and efficient. The textile industry, in particular, was transformed by new machines such as the spinning jenny and the power loom.

The social and economic impacts were profound. Millions of people moved from rural areas to cities to work in factories. This urbanization created new social challenges, including overcrowding, pollution, and poor working conditions. However, it also led to increased productivity, higher standards of living for many, and technological innovations that continue to shape our world today.`

  const handlePassageScrolled = () => {
    console.log('User has read the entire passage')
    // This would typically unlock questions via the gatekeeper
  }

  return (
    <PassageViewer passage={samplePassage} onPassageFullyScrolled={handlePassageScrolled}>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Reading Comprehension</h2>
        
        <div className="bg-gray-800 p-4 rounded">
          <p className="text-white mb-2">1. According to the passage, what was the main characteristic of the Industrial Revolution?</p>
          <div className="space-y-2">
            <label className="block text-gray-300">
              <input type="radio" name="q1" value="a" className="mr-2" />
              A) Agricultural development
            </label>
            <label className="block text-gray-300">
              <input type="radio" name="q1" value="b" className="mr-2" />
              B) Transformation from agriculture to industry
            </label>
            <label className="block text-gray-300">
              <input type="radio" name="q1" value="c" className="mr-2" />
              C) Improved education systems
            </label>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <p className="text-white mb-2">2. Which industry is specifically mentioned as being transformed?</p>
          <div className="space-y-2">
            <label className="block text-gray-300">
              <input type="radio" name="q2" value="a" className="mr-2" />
              A) Steel industry
            </label>
            <label className="block text-gray-300">
              <input type="radio" name="q2" value="b" className="mr-2" />
              B) Textile industry
            </label>
            <label className="block text-gray-300">
              <input type="radio" name="q2" value="c" className="mr-2" />
              C) Automobile industry
            </label>
          </div>
        </div>
      </div>
    </PassageViewer>
  )
}

/**
 * Example 2: Integration with Gatekeeper functionality
 * Questions are locked until passage is fully scrolled
 */
export function GatekeeperIntegrationExample() {
  const { unlockAllQuestions } = useUIStore()

  const passage = `Climate change refers to long-term shifts in temperatures and weather patterns. These shifts may be natural, but since the 1800s, human activities have been the main driver of climate change, primarily due to the burning of fossil fuels like coal, oil, and gas.

Burning fossil fuels generates greenhouse gas emissions that act like a blanket wrapped around the Earth, trapping the sun's heat and raising temperatures. The main greenhouse gases include carbon dioxide and methane, which come from activities such as using gasoline for driving or coal for heating buildings.`

  const handlePassageFullyScrolled = () => {
    // Unlock questions when passage is fully read
    unlockAllQuestions()
    console.log('Gatekeeper: Questions unlocked')
  }

  return (
    <PassageViewer passage={passage} onPassageFullyScrolled={handlePassageFullyScrolled}>
      <div className="space-y-4">
        <div className="bg-yellow-900/30 border border-yellow-700 p-3 rounded">
          <p className="text-yellow-200 text-sm">
            📖 Please scroll to the bottom of the passage to unlock questions
          </p>
        </div>

        <div className="bg-gray-800 p-4 rounded opacity-50 pointer-events-none">
          <p className="text-white mb-2">🔒 Question 1: What is climate change?</p>
          <input type="text" disabled className="w-full p-2 bg-gray-700 text-gray-400 rounded" />
        </div>
      </div>
    </PassageViewer>
  )
}

/**
 * Example 3: Multiple paragraphs with proper formatting
 */
export function MultiParagraphExample() {
  const longPassage = `The concept of sustainable development emerged in the late 20th century as a response to growing concerns about environmental degradation and resource depletion.

Sustainable development is defined as development that meets the needs of the present without compromising the ability of future generations to meet their own needs. This definition encompasses three main pillars: economic development, social development, and environmental protection.

Economic sustainability involves maintaining capital intact. This means that if natural resources are depleted, they must be replaced by something of equal value. Social sustainability focuses on maintaining social capital, including human rights, labor rights, and community development.

Environmental sustainability emphasizes the conservation of natural resources and the protection of ecosystems. It recognizes that natural resources are finite and must be used wisely to ensure their availability for future generations.

The implementation of sustainable development requires coordination among governments, businesses, and civil society. It also requires a long-term perspective and a willingness to make short-term sacrifices for long-term benefits.`

  return (
    <PassageViewer 
      passage={longPassage}
      onPassageFullyScrolled={() => console.log('Long passage read completely')}
      className="custom-passage-viewer"
    >
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white">Sustainable Development</h2>
        <p className="text-gray-400">Answer the following questions based on the passage.</p>
        
        {/* Questions would go here */}
      </div>
    </PassageViewer>
  )
}

/**
 * Example 4: Short passage without scrolling requirement
 */
export function ShortPassageExample() {
  const shortPassage = 'The quick brown fox jumps over the lazy dog. This sentence contains all letters of the alphabet.'

  return (
    <PassageViewer passage={shortPassage}>
      <div className="space-y-4">
        <div className="bg-gray-800 p-4 rounded">
          <p className="text-white mb-2">What letters are in this sentence?</p>
          <input type="text" className="w-full p-2 bg-gray-700 text-white rounded" />
        </div>
      </div>
    </PassageViewer>
  )
}
