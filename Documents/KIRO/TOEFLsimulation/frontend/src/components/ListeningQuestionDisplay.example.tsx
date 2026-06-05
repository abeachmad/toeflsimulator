/**
 * ListeningQuestionDisplay Component Example
 * 
 * This file demonstrates the ListeningQuestionDisplay component with all supported question types.
 * Run this with Storybook or in a standalone demo page.
 */

import { ListeningQuestionDisplay, type ListeningQuestion } from './ListeningQuestionDisplay'

/**
 * Example 1: Choose Response Question
 */
export function ChooseResponseExample() {
  const question: ListeningQuestion = {
    id: 'example-cr-001',
    section: 'listening',
    type: 'choose-response',
    difficulty_level: 'easy',
    stage: 1,
    content: JSON.stringify({
      audioUrl: '/audio/listening/response-1.mp3',
      transcript: 'Would you like to join us for lunch today?',
      question: 'Choose the best response.'
    }),
    options: [
      'Yes, that sounds good',
      'No, I prefer another option',
      'Maybe we should reconsider',
      'I will think about it'
    ],
    correct_answer: 'Yes, that sounds good',
    irt_a: 1.2,
    irt_b: -0.3,
    irt_c: 0.2,
    metadata: {
      dataset: 'Synthetic-Listening',
      duration: 60
    }
  }

  return (
    <div className="p-8 bg-gray-950 min-h-screen">
      <h2 className="text-white text-2xl font-bold mb-6">Choose Response Question</h2>
      <ListeningQuestionDisplay question={question} />
    </div>
  )
}

/**
 * Example 2: Conversation Question
 */
export function ConversationExample() {
  const question: ListeningQuestion = {
    id: 'example-conv-001',
    section: 'listening',
    type: 'conversation',
    difficulty_level: 'medium',
    stage: 1,
    content: JSON.stringify({
      audioUrl: '/audio/listening/conversation-1.mp3',
      transcript: 'Student: Professor, I have a question about the research paper assignment.\nProfessor: Sure, what would you like to know?\nStudent: When is the deadline for submitting the first draft?\nProfessor: The first draft is due next Friday, but the final version is due two weeks after that.',
      question: 'What is the main topic of the conversation?'
    }),
    options: [
      'Course requirements',
      'Research project',
      'Assignment deadline',
      'Office hours'
    ],
    correct_answer: 'Assignment deadline',
    irt_a: 1.5,
    irt_b: 0.2,
    irt_c: 0.15,
    metadata: {
      dataset: 'Synthetic-Listening',
      duration: 60
    }
  }

  return (
    <div className="p-8 bg-gray-950 min-h-screen">
      <h2 className="text-white text-2xl font-bold mb-6">Conversation Question</h2>
      <ListeningQuestionDisplay question={question} />
    </div>
  )
}

/**
 * Example 3: Academic Lecture Question
 */
export function AcademicLectureExample() {
  const question: ListeningQuestion = {
    id: 'example-lec-001',
    section: 'listening',
    type: 'academic-lecture',
    difficulty_level: 'hard',
    stage: 2,
    content: JSON.stringify({
      audioUrl: '/audio/listening/lecture-1.mp3',
      transcript: 'Today we will discuss ecosystem dynamics, focusing on the relationships between different species and their environment. Ecosystems are complex networks where each organism plays a specific role. Changes in one part of the ecosystem can have cascading effects throughout the entire system. For example, the removal of a keystone species can lead to dramatic changes in the ecosystem structure.',
      question: 'What does the professor mainly discuss?'
    }),
    options: [
      'Climate change effects',
      'Ecosystem dynamics',
      'Conservation strategies',
      'Pollution sources'
    ],
    correct_answer: 'Ecosystem dynamics',
    irt_a: 1.8,
    irt_b: 1.2,
    irt_c: 0.1,
    metadata: {
      dataset: 'Synthetic-Listening',
      duration: 180
    }
  }

  return (
    <div className="p-8 bg-gray-950 min-h-screen">
      <h2 className="text-white text-2xl font-bold mb-6">Academic Lecture Question</h2>
      <ListeningQuestionDisplay question={question} />
    </div>
  )
}

/**
 * Example 4: All Question Types Together
 */
export function AllQuestionTypesExample() {
  return (
    <div className="p-8 bg-gray-950 min-h-screen space-y-12">
      <h1 className="text-white text-3xl font-bold mb-8">
        ListeningQuestionDisplay Component - All Question Types
      </h1>
      
      <div>
        <h2 className="text-white text-2xl font-bold mb-6">1. Choose Response</h2>
        <ChooseResponseExample />
      </div>
      
      <div>
        <h2 className="text-white text-2xl font-bold mb-6">2. Conversation</h2>
        <ConversationExample />
      </div>
      
      <div>
        <h2 className="text-white text-2xl font-bold mb-6">3. Academic Lecture</h2>
        <AcademicLectureExample />
      </div>
    </div>
  )
}

/**
 * Default Export - Shows all examples
 */
export default function ListeningQuestionDisplayExamples() {
  return <AllQuestionTypesExample />
}
