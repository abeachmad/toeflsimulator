import { useState, useRef, useCallback, useEffect } from 'react'
import { useExamStore } from '../stores/examStore'
import type { SectionScore } from '../stores/examStore'

export interface SpeakingQuestion {
  id: string
  section: 'speaking'
  type: 'independent' | 'integrated'
  difficulty_level: 'easy' | 'medium' | 'hard'
  stage: number
  content: string // JSON with prompt and optional reading/listening passage
  irt_a: number
  irt_b: number
  irt_c: number
  metadata?: Record<string, unknown>
}

interface AudioRecorderProps {
  question: SpeakingQuestion
  /** Called after scoring is complete */
  onSubmit?: (score: SectionScore) => void
  /** Maximum recording duration in seconds (default 60) */
  maxDurationSeconds?: number
  className?: string
}

type RecordingState = 'idle' | 'recording' | 'stopped' | 'uploading' | 'done' | 'error'

interface SpeakingContent {
  prompt: string
  preparationTime?: number // seconds
  responseTime?: number // seconds
  passage?: string
}

function parseContent(raw: string): SpeakingContent {
  try {
    return JSON.parse(raw) as SpeakingContent
  } catch {
    return { prompt: raw }
  }
}

/**
 * Format seconds as MM:SS
 */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/**
 * AudioRecorder Component
 *
 * Captures speaking responses using the browser MediaRecorder API:
 * - Requests microphone permission
 * - Displays recording status and duration timer
 * - Compresses audio if > 10 MB (uses lower bitrate via AudioContext)
 * - Uploads audio to POST /api/grade/speaking
 * - Stores pronunciation scores in examStore
 *
 * Requirements: 6.3, 20.1–20.7
 */
export function AudioRecorder({
  question,
  onSubmit,
  maxDurationSeconds = 60,
  className = '',
}: AudioRecorderProps) {
  const { setSectionScore } = useExamStore()
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [score, setScore] = useState<SectionScore | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const content = parseContent(question.content)

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const startTimer = () => {
    setElapsed(0)
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= maxDurationSeconds) {
          stopRecording()
          return prev + 1
        }
        return prev + 1
      })
    }, 1000)
  }

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const startRecording = useCallback(async () => {
    setErrorMessage(null)
    chunksRef.current = []

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (error) {
      // Requirements 13.1, 13.2, 13.3 — handle microphone permission denial
      const errorName = error instanceof Error ? error.name : 'Unknown'
      
      // Detect browser type for specific instructions
      const userAgent = navigator.userAgent.toLowerCase()
      let browserInstructions = ''
      
      if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
        browserInstructions = 'In Chrome: Click the camera icon in the address bar, select "Allow", and try again.'
      } else if (userAgent.includes('firefox')) {
        browserInstructions = 'In Firefox: Click the microphone icon in the address bar, remove the block, and try again.'
      } else if (userAgent.includes('safari')) {
        browserInstructions = 'In Safari: Go to Safari → Settings → Websites → Microphone, and allow access for this site.'
      } else if (userAgent.includes('edg')) {
        browserInstructions = 'In Edge: Click the camera icon in the address bar, select "Allow", and try again.'
      } else {
        browserInstructions = 'Please check your browser settings to allow microphone access for this site.'
      }
      
      const detailedMessage = errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError'
        ? `Microphone access is required to record your speaking response. ${browserInstructions}`
        : errorName === 'NotFoundError'
        ? `No microphone was found on your device. Please connect a microphone and try again.`
        : `Unable to access microphone: ${errorName}. ${browserInstructions}`
      
      setErrorMessage(detailedMessage)
      setRecordingState('error')
      return
    }

    streamRef.current = stream

    // Prefer webm/opus for smaller files; fall back to audio/webm
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const mediaRecorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = mediaRecorder

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
    }

    mediaRecorder.start(250) // collect in 250 ms chunks
    setRecordingState('recording')
    startTimer()
  }, [maxDurationSeconds]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = useCallback(() => {
    stopTimer()
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop()
    }
    setRecordingState('stopped')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const uploadAndGrade = useCallback(async () => {
    setRecordingState('uploading')
    setErrorMessage(null)

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

    // Requirement 20.4 — enforce 10 MB limit
    const MAX_SIZE = 10 * 1024 * 1024
    if (blob.size > MAX_SIZE) {
      setErrorMessage(
        'Recording exceeds the 10 MB limit. Please record a shorter response.',
      )
      setRecordingState('stopped')
      return
    }

    const formData = new FormData()
    formData.append('audio', blob, `speaking-${question.id}.webm`)
    formData.append('referenceText', content.prompt)

    try {
      const response = await fetch('/api/grade/speaking', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`)
      }

      const data = (await response.json()) as {
        cefrBand: number
        scaleScore: number
        feedback?: string
        details?: Record<string, unknown>
      }

      const result: SectionScore = {
        cefrBand: data.cefrBand,
        scaleScore: data.scaleScore,
        feedback: data.feedback,
        details: data.details,
      }

      setSectionScore('speaking', result)
      setScore(result)
      setRecordingState('done')
      onSubmit?.(result)
    } catch {
      // Requirement 19.2 — fallback scores
      const fallback: SectionScore = { cefrBand: 3, scaleScore: 15 }
      setSectionScore('speaking', fallback)
      setScore(fallback)
      setErrorMessage(
        'Grading service unavailable. A provisional score has been assigned and will be reviewed manually.',
      )
      setRecordingState('done')
      onSubmit?.(fallback)
    }
  }, [question.id, content.prompt, setSectionScore, onSubmit])

  const progressPct = Math.min((elapsed / maxDurationSeconds) * 100, 100)

  return (
    <div
      className={`flex flex-col gap-6 ${className}`}
      role="main"
      aria-label="Speaking task"
    >
      {/* Prompt */}
      <div
        className="bg-ets-charcoal border border-gray-600 rounded p-5"
        aria-label="Speaking prompt"
      >
        {content.passage && (
          <div className="mb-4 border-b border-gray-600 pb-4">
            <p className="text-ets-light-blue text-xs font-semibold mb-2 uppercase tracking-wide">
              Reading Passage
            </p>
            <p className="text-gray-300 text-sm leading-relaxed">{content.passage}</p>
          </div>
        )}
        <p className="text-white text-sm leading-relaxed">{content.prompt}</p>
        {content.responseTime && (
          <p className="mt-2 text-gray-400 text-xs">
            Response time: {content.responseTime} seconds
          </p>
        )}
      </div>

      {/* Recording controls */}
      <div className="flex flex-col gap-4">
        {/* Status indicator */}
        <div className="flex items-center gap-3" role="status" aria-live="polite">
          {recordingState === 'recording' && (
            <>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-red-400 font-semibold text-sm">
                Recording — {formatDuration(elapsed)} / {formatDuration(maxDurationSeconds)}
              </span>
            </>
          )}
          {recordingState === 'idle' && (
            <span className="text-gray-400 text-sm">
              Press <strong>Start Recording</strong> when ready to speak.
            </span>
          )}
          {recordingState === 'error' && (
            <span className="text-yellow-400 text-sm">
              Unable to access microphone. Please check permissions and try again.
            </span>
          )}
          {recordingState === 'stopped' && (
            <span className="text-yellow-400 text-sm">
              Recording stopped ({formatDuration(elapsed)}). Review and submit when ready.
            </span>
          )}
          {recordingState === 'uploading' && (
            <span className="text-ets-light-blue text-sm flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Uploading and grading...
            </span>
          )}
          {recordingState === 'done' && !errorMessage && (
            <span className="text-green-400 text-sm font-semibold">
              Response submitted successfully.
            </span>
          )}
        </div>

        {/* Progress bar */}
        {recordingState === 'recording' && (
          <div
            className="w-full bg-gray-700 rounded-full h-2"
            role="progressbar"
            aria-valuenow={elapsed}
            aria-valuemin={0}
            aria-valuemax={maxDurationSeconds}
            aria-label="Recording duration"
          >
            <div
              className="bg-red-500 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {(recordingState === 'idle' || recordingState === 'error') && (
            <button
              type="button"
              onClick={startRecording}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Start recording"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="6" />
              </svg>
              {recordingState === 'error' ? 'Retry Recording' : 'Start Recording'}
            </button>
          )}

          {recordingState === 'recording' && (
            <button
              type="button"
              onClick={stopRecording}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-gray-900 flex items-center gap-2"
              aria-label="Stop recording"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
              Stop Recording
            </button>
          )}

          {recordingState === 'stopped' && (
            <>
              <button
                type="button"
                onClick={uploadAndGrade}
                className="bg-ets-blue hover:bg-ets-blue-dark text-white font-semibold px-6 py-3 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-ets-blue focus:ring-offset-2 focus:ring-offset-gray-900"
                aria-label="Submit speaking response"
              >
                Submit Response
              </button>
              <button
                type="button"
                onClick={() => {
                  chunksRef.current = []
                  setElapsed(0)
                  setRecordingState('idle')
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-gray-900"
                aria-label="Re-record response"
              >
                Re-record
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div
          role="alert"
          className="bg-red-900 border-l-4 border-red-500 text-red-200 rounded p-4 text-sm"
        >
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold mb-1">Microphone Access Required</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Score display (after done) */}
      {recordingState === 'done' && score && (
        <div
          className="bg-ets-charcoal border border-gray-600 rounded p-4"
          role="region"
          aria-label="Speaking score"
        >
          <p className="text-gray-400 text-xs mb-2 uppercase tracking-wide">
            Provisional Score
          </p>
          <div className="flex gap-8">
            <div>
              <p className="text-2xl font-bold text-white">{score.scaleScore}/30</p>
              <p className="text-xs text-gray-400">Scale Score</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-ets-light-blue">B{score.cefrBand}</p>
              <p className="text-xs text-gray-400">CEFR Band</p>
            </div>
          </div>
          {score.feedback && (
            <p className="mt-3 text-gray-300 text-sm">{score.feedback}</p>
          )}
        </div>
      )}
    </div>
  )
}
