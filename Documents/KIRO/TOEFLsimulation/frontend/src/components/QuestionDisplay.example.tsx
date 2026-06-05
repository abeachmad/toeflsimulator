/**
 * QuestionDisplay Component Example
 * 
 * This file demonstrates the QuestionDisplay component with all supported question types.
 * Run this with Storybook or in a standalone demo page.
 */

import { QuestionDisplay, type ReadingQuestion } from './QuestionDisplay'

/**
 * Example 1: Complete Words Question
 * Shows a sentence with a blank and multiple choice options
 */
export function CompleteWordsExample() {
  const question: ReadingQuestion = {
    id: 'example-cw-001',
    section: 'reading',
    type: 'complete-words',
    difficulty_level: 'medium',
    stage: 1,
    content: JSON.stringify({
      sentence: 'The scientist\'s groundbreaking research was _____ by the academic community.',
      context: 'In academic settings, peer recognition validates research contributions.',
    }),
    options: [
      'criticized',
      'praised',
      'ignored',
      'rejected',
    ],
    correct_answer: 'praised',
    irt_a: 1.2,
    irt_b: 0.3,
    irt_c: 0.2,
  }

  return (
    <div className="p-8 bg-gray-950 min-h-screen">
      <h2 className="text-white text-2xl font-bold mb-6">Complete Words Question</h2>
      <QuestionDisplay question={question} />
    </div>
  )
}

/**
 * Example 2: Academic Passage Question
 * Shows a comprehension question based on a passage
 */
export function AcademicPassageExample() {
  const question: ReadingQuestion = {
    id: 'example-ap-001',
    section: 'reading',
    type: 'academic-passage',
    difficulty_level: 'hard',
    stage: 2,
    content: JSON.stringify({
      passage: 'Climate change represents one of the most significant challenges facing humanity in the 21st century. Rising global temperatures, driven primarily by anthropogenic greenhouse gas emissions, have triggered a cascade of environmental effects including melting polar ice caps, rising sea levels, and increasingly frequent extreme weather events. The scientific consensus, supported by decades of research and observational data, indicates that human activities—particularly the combustion of fossil fuels and large-scale deforestation—are the primary drivers of current climate trends.',
      question: 'According to the passage, what is identified as the primary cause of climate change?',
    }),
    options: [
      'Natural weather cycles',
      'Human activities such as burning fossil fuels and deforestation',
      'Solar radiation variations',
      'Volcanic eruptions',
    ],
    correct_answer: 'Human activities such as burning fossil fuels and deforestation',
    irt_a: 1.4,
    irt_b: 0.5,
    irt_c: 0.18,
  }

  return (
    <div className="p-8 bg-gray-950 min-h-screen">
      <h2 className="text-white text-2xl font-bold mb-6">Academic Passage Question</h2>
      <QuestionDisplay question={question} />
    </div>
  )
}

/**
 * Example 3: Synonym Match Question
 * Shows word definition matching
 */
export function SynonymMatchExample() {
  const question: ReadingQuestion = {
    id: 'example-sm-001',
    section: 'reading',
    type: 'synonym-match',
    difficulty_level: 'medium',
    stage: 1,
    content: JSON.stringify({
      word: 'meticulous',
      context: 'The researcher was meticulous in documenting every detail of the experiment.',
    }),
    options: [
      'careless',
      'careful',
      'hasty',
      'random',
    ],
    correct_answer: 'careful',
    irt_a: 1.5,
    irt_b: 0.2,
    irt_c: 0.15,
  }

  return (
    <div className="p-8 bg-gray-950 min-h-screen">
      <h2 className="text-white text-2xl font-bold mb-6">Synonym Match Question</h2>
      <QuestionDisplay question={question} />
    </div>
  )
}

/**
 * Example 4: Daily Life Question
 * Shows scenario-based practical question
 */
export function DailyLifeExample() {
  const question: ReadingQuestion = {
    id: 'example-dl-001',
    section: 'reading',
    type: 'daily-life',
    difficulty_level: 'easy',
    stage: 1,
    content: JSON.stringify({
      scenario: 'You are planning to rent an apartment in a new city. You have found several options online, but they vary in location, price, and amenities. You need to make a decision within the next week.',
      question: 'What should be your highest priority when choosing an apartment?',
    }),
    options: [
      'The lowest monthly rent',
      'Proximity to work or school',
      'Modern kitchen appliances',
      'Having a balcony',
    ],
    correct_answer: 'Proximity to work or school',
    irt_a: 1.0,
    irt_b: -0.5,
    irt_c: 0.25,
  }

  return (
    <div className="p-8 bg-gray-950 min-h-screen">
      <h2 className="text-white text-2xl font-bold mb-6">Daily Life Question</h2>
      <QuestionDisplay question={question} />
    </div>
  )
}

/**
 * Example 5: Short Answer Question (Text Input)
 * Shows inline text input for short answers
 */
export function ShortAnswerExample() {
  const question: ReadingQuestion = {
    id: 'example-sa-001',
    section: 'reading',
    type: 'complete-words',
    difficulty_level: 'medium',
    stage: 1,
    content: JSON.stringify({
      sentence: 'The capital city of Japan is _____.',
      context: 'Geography knowledge question',
    }),
    // No options means text input will be shown
    irt_a: 1.1,
    irt_b: 0.0,
    irt_c: 0.0,
  }

  return (
    <div className="p-8 bg-gray-950 min-h-screen">
      <h2 className="text-white text-2xl font-bold mb-6">Short Answer Question (Text Input)</h2>
      <QuestionDisplay question={question} />
    </div>
  )
}

/**
 * Example 6: All Question Types in One View
 * Demonstrates different question types side by side
 */
export function AllQuestionTypesExample() {
  return (
    <div className="p-8 bg-gray-950 min-h-screen space-y-12">
      <h1 className="text-white text-3xl font-bold mb-8">
        QuestionDisplay Component - All Question Types
      </h1>

      <section>
        <CompleteWordsExample />
      </section>

      <section>
        <AcademicPassageExample />
      </section>

      <section>
        <SynonymMatchExample />
      </section>

      <section>
        <DailyLifeExample />
      </section>

      <section>
        <ShortAnswerExample />
      </section>
    </div>
  )
}

/**
 * Default Export - Shows all examples
 */
export default function QuestionDisplayExamples() {
  return <AllQuestionTypesExample />
}
