import { useState, useEffect } from 'react'
import { TextEditor } from './TextEditor'
import { useExamStore } from '../stores/examStore'
import type { SectionScore } from '../stores/examStore'

export interface WritingQuestion {
  id: string
  section: 'writing'
  type: 'build-sentence' | 'email' | 'academic-discussion'
  difficulty_level: 'easy' | 'medium' | 'hard'
  stage: number
  content: string // JSON with prompt details
  irt_a: number
  irt_b: number
  irt_c: number
  metadata?: Record<string, unknown>
}

interface WritingSectionProps {
  question: WritingQuestion
  onSubmit?: (score: SectionScore) => void
  className?: string
}

interface WritingContent {
  prompt?: string
  professorPrompt?: string // For academic-discussion
  taskDescription?: string
  referenceText?: string
}

function parseContent(raw: string): WritingContent {
  try {
    const parsed = JSON.parse(raw)
    // For academic-discussion, use professorPrompt as the main prompt
    if (parsed.professorPrompt && !parsed.prompt) {
      return {
        ...parsed,
        prompt: parsed.professorPrompt
      }
    }
    return parsed as WritingContent
  } catch {
    return { prompt: raw }
  }
}

const MIN_WORD_COUNTS: Record<WritingQuestion['type'], number> = {
  'build-sentence': 10,
  email: 50,
  'academic-discussion': 150,
}

const TYPE_LABELS: Record<WritingQuestion['type'], string> = {
  'build-sentence': 'Sentence Building',
  email: 'Email Writing',
  'academic-discussion': 'Academic Discussion',
}

/**
 * WritingSection Component
 *
 * Displays a writing prompt, a TextEditor for response input,
 * and handles submission to the /api/grade/writing endpoint.
 *
 * Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 19.2
 */
export function WritingSection({ question, onSubmit, className = '' }: WritingSectionProps) {
  const { updateAnswer, setSectionScore, answers } = useExamStore()
  
  // Load saved answer from store (fix for answer persistence)
  // Ensure we get a string value (answers can be string | number | string[])
  const savedAnswer = String(answers.get(question.id) || '')
  const [text, setText] = useState(savedAnswer)
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const content = parseContent(question.content)
  const minWords = MIN_WORD_COUNTS[question.type]

  // Update text when question changes (fix for switching between questions)
  useEffect(() => {
    const savedAnswer = String(answers.get(question.id) || '')
    setText(savedAnswer)
    setSubmitted(false) // Reset submission state for new question
    setError(null) // Clear errors
  }, [question.id, answers])

  const handleTextChange = (newText: string) => {
    setText(newText)
    updateAnswer(question.id, newText)
  }

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError('Please write a response before submitting.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/grade/writing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, taskType: question.type }),
      })

      if (!response.ok) {
        throw new Error(`Grading failed: ${response.status}`)
      }

      const data = (await response.json()) as {
        cefrBand: number
        scaleScore: number
        feedback?: string
        details?: Record<string, unknown>
      }

      const score: SectionScore = {
        cefrBand: data.cefrBand,
        scaleScore: data.scaleScore,
        feedback: data.feedback,
        details: data.details,
      }

      setSectionScore('writing', score)
      setSubmitted(true)
      onSubmit?.(score)
    } catch (err) {
      // Fallback scores as per Requirement 19.2
      const fallback: SectionScore = { cefrBand: 3, scaleScore: 15 }
      setSectionScore('writing', fallback)
      setError(
        'Grading service unavailable. A provisional score has been assigned and your response saved. ' +
          'This will be reviewed manually.',
      )
      setSubmitted(true)
      onSubmit?.(fallback)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`flex flex-col gap-6 ${className}`} role="main" aria-label="Writing task">
      {/* Task type badge */}
      <div className="flex items-center gap-3">
        <span className="inline-block bg-ets-blue text-white text-xs font-semibold px-3 py-1 rounded uppercase tracking-wide">
          {TYPE_LABELS[question.type]}
        </span>
        <span className="text-gray-400 text-xs">
          Aim for {minWords}+ words
        </span>
      </div>

      {/* Prompt */}
      <div
        className="bg-ets-charcoal border border-gray-600 rounded p-5"
        aria-label="Writing prompt"
      >
        {content.taskDescription && (
          <p className="text-ets-light-blue text-sm mb-3 font-semibold">
            {content.taskDescription}
          </p>
        )}
        <p className="text-white text-sm leading-relaxed">{content.prompt}</p>
        {content.referenceText && (
          <blockquote className="mt-4 border-l-4 border-ets-blue pl-4 text-gray-300 text-sm italic">
            {content.referenceText}
          </blockquote>
        )}
      </div>

      {/* Editor — disabled after submission */}
      <TextEditor
        value={text}
        onChange={handleTextChange}
        label="Your Response"
        placeholder="Type your response here..."
        minWordCount={minWords}
        readOnly={submitted}
        ariaLabel="Writing response"
      />

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="bg-yellow-900 border border-yellow-600 text-yellow-200 rounded p-3 text-sm"
        >
          {error}
        </div>
      )}

      {/* Submit button */}
      {!submitted ? (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading || !text.trim()}
          className="self-end bg-ets-blue hover:bg-ets-blue-dark text-white font-semibold px-8 py-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ets-blue focus:ring-offset-2 focus:ring-offset-gray-900"
          aria-label="Submit writing response"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Grading...
            </span>
          ) : (
            'Submit Response'
          )}
        </button>
      ) : (
        <div
          role="status"
          className="self-end bg-green-900 border border-green-600 text-green-200 rounded px-6 py-3 text-sm font-semibold"
        >
          Response submitted
        </div>
      )}
    </div>
  )
}
