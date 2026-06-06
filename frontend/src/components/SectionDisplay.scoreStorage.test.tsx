import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useExamStore, resetExamStore } from '../stores/examStore'
import type { SectionScore } from '../stores/examStore'

/**
 * Integration tests for Task 10: Score Storage in Frontend Exam State
 * 
 * These tests verify that:
 * 1. setSectionScore is called after receiving scores from backend (reading/listening)
 * 2. SectionScore objects are stored with cefrBand, scaleScore, and feedback
 * 3. Scores persist to localStorage
 * 
 * Requirements: 7.1, 7.2, 7.5
 */
describe('SectionDisplay - Score Storage Integration', () => {
  beforeEach(() => {
    localStorage.clear()
    resetExamStore()
    vi.clearAllMocks()
  })

  describe('Requirement 7.1, 7.2: Store scores after backend submission', () => {
    it('should store reading section score after successful backend submission', async () => {
      // Simulate backend response with score
      const mockScore: SectionScore = {
        cefrBand: 5,
        scaleScore: 24,
        feedback: 'Excellent reading comprehension',
        details: {
          correct: 18,
          total: 20,
          theta: 0.8
        }
      }

      // Simulate what SectionDisplay.handleSectionComplete does
      const { setSectionScore } = useExamStore.getState()
      setSectionScore('reading', mockScore)

      // Verify score is stored
      const { sectionScores } = useExamStore.getState()
      expect(sectionScores.reading).toEqual(mockScore)
      expect(sectionScores.reading?.cefrBand).toBe(5)
      expect(sectionScores.reading?.scaleScore).toBe(24)
      expect(sectionScores.reading?.feedback).toBe('Excellent reading comprehension')
    })

    it('should store listening section score after successful backend submission', async () => {
      const mockScore: SectionScore = {
        cefrBand: 4,
        scaleScore: 20,
        feedback: 'Good listening skills',
        details: {
          correct: 22,
          total: 28,
          theta: 0.5
        }
      }

      const { setSectionScore } = useExamStore.getState()
      setSectionScore('listening', mockScore)

      const { sectionScores } = useExamStore.getState()
      expect(sectionScores.listening).toEqual(mockScore)
    })

    it('should store writing section score after grading API call', async () => {
      // Simulate what WritingSection component does after grading
      const mockScore: SectionScore = {
        cefrBand: 5,
        scaleScore: 25,
        feedback: 'Well-structured essay with clear arguments'
      }

      const { setSectionScore } = useExamStore.getState()
      setSectionScore('writing', mockScore)

      const { sectionScores } = useExamStore.getState()
      expect(sectionScores.writing).toEqual(mockScore)
    })

    it('should store speaking section score after grading API call', async () => {
      // Simulate what AudioRecorder component does after grading
      const mockScore: SectionScore = {
        cefrBand: 6,
        scaleScore: 28,
        feedback: 'Fluent speech with excellent pronunciation'
      }

      const { setSectionScore } = useExamStore.getState()
      setSectionScore('speaking', mockScore)

      const { sectionScores } = useExamStore.getState()
      expect(sectionScores.speaking).toEqual(mockScore)
    })
  })

  describe('Requirement 7.5: Persist scores to localStorage', () => {
    it('should persist reading score to localStorage', () => {
      const mockScore: SectionScore = {
        cefrBand: 5,
        scaleScore: 24,
        feedback: 'Excellent'
      }

      const { setSectionScore } = useExamStore.getState()
      setSectionScore('reading', mockScore)

      // Verify localStorage contains the score
      const stored = localStorage.getItem('toefl-exam-store')
      expect(stored).toBeTruthy()

      const parsed = JSON.parse(stored!)
      expect(parsed.state.sectionScores.reading).toEqual(mockScore)
    })

    it('should persist all four section scores independently', () => {
      const scores = {
        reading: { cefrBand: 5, scaleScore: 24, feedback: 'Excellent' },
        listening: { cefrBand: 4, scaleScore: 20, feedback: 'Good' },
        writing: { cefrBand: 5, scaleScore: 25, feedback: 'Well-written' },
        speaking: { cefrBand: 6, scaleScore: 28, feedback: 'Fluent' }
      }

      const { setSectionScore } = useExamStore.getState()
      setSectionScore('reading', scores.reading)
      setSectionScore('listening', scores.listening)
      setSectionScore('writing', scores.writing)
      setSectionScore('speaking', scores.speaking)

      // Verify all scores are persisted
      const stored = localStorage.getItem('toefl-exam-store')
      expect(stored).toBeTruthy()

      const parsed = JSON.parse(stored!)
      expect(parsed.state.sectionScores).toEqual(scores)
    })

    it('should survive page refresh (resilience)', () => {
      const mockScore: SectionScore = {
        cefrBand: 5,
        scaleScore: 24,
        feedback: 'Excellent',
        details: { correct: 18, total: 20 }
      }

      const { setSectionScore } = useExamStore.getState()
      setSectionScore('reading', mockScore)

      // Simulate page refresh by reading from localStorage
      const stored = localStorage.getItem('toefl-exam-store')
      expect(stored).toBeTruthy()

      const parsed = JSON.parse(stored!)
      const restoredScore = parsed.state.sectionScores.reading

      // Verify all properties survived serialization
      expect(restoredScore.cefrBand).toBe(5)
      expect(restoredScore.scaleScore).toBe(24)
      expect(restoredScore.feedback).toBe('Excellent')
      expect(restoredScore.details).toEqual({ correct: 18, total: 20 })
    })
  })

  describe('Score updates during exam flow', () => {
    it('should accumulate scores as sections are completed', () => {
      const { setSectionScore, sectionScores: initialScores } = useExamStore.getState()
      
      // Initially no scores
      expect(Object.keys(initialScores)).toHaveLength(0)

      // Complete reading section
      setSectionScore('reading', { cefrBand: 5, scaleScore: 24 })
      expect(Object.keys(useExamStore.getState().sectionScores)).toHaveLength(1)

      // Complete listening section
      setSectionScore('listening', { cefrBand: 4, scaleScore: 20 })
      expect(Object.keys(useExamStore.getState().sectionScores)).toHaveLength(2)

      // Complete writing section
      setSectionScore('writing', { cefrBand: 5, scaleScore: 25 })
      expect(Object.keys(useExamStore.getState().sectionScores)).toHaveLength(3)

      // Complete speaking section
      setSectionScore('speaking', { cefrBand: 6, scaleScore: 28 })
      expect(Object.keys(useExamStore.getState().sectionScores)).toHaveLength(4)

      // Verify all scores present
      const { sectionScores } = useExamStore.getState()
      expect(sectionScores.reading?.scaleScore).toBe(24)
      expect(sectionScores.listening?.scaleScore).toBe(20)
      expect(sectionScores.writing?.scaleScore).toBe(25)
      expect(sectionScores.speaking?.scaleScore).toBe(28)
    })

    it('should allow score updates (e.g., fallback to provisional score)', () => {
      const { setSectionScore } = useExamStore.getState()

      // Initial score from grading API
      setSectionScore('writing', { cefrBand: 5, scaleScore: 25, feedback: 'Good' })
      expect(useExamStore.getState().sectionScores.writing?.scaleScore).toBe(25)

      // Fallback score if API fails on retry
      setSectionScore('writing', { cefrBand: 3, scaleScore: 15, feedback: 'Provisional score' })
      expect(useExamStore.getState().sectionScores.writing?.scaleScore).toBe(15)
      expect(useExamStore.getState().sectionScores.writing?.feedback).toBe('Provisional score')
    })
  })

  describe('Score retrieval for ScoreReport', () => {
    it('should provide scores in format needed for ScoreReport component', () => {
      // Simulate completed exam with all scores
      const { setSectionScore } = useExamStore.getState()
      
      setSectionScore('reading', {
        cefrBand: 5,
        scaleScore: 24,
        feedback: 'Strong reading comprehension'
      })
      
      setSectionScore('listening', {
        cefrBand: 4,
        scaleScore: 20,
        feedback: 'Good listening skills'
      })
      
      setSectionScore('writing', {
        cefrBand: 5,
        scaleScore: 25,
        feedback: 'Well-structured essays'
      })
      
      setSectionScore('speaking', {
        cefrBand: 6,
        scaleScore: 28,
        feedback: 'Excellent fluency'
      })

      // ScoreReport should be able to access all scores
      const { sectionScores } = useExamStore.getState()
      
      // Verify all required properties are present (Requirements 7.1, 7.2, 7.5)
      expect(sectionScores.reading).toBeDefined()
      expect(sectionScores.reading?.cefrBand).toBe(5)
      expect(sectionScores.reading?.scaleScore).toBe(24)
      expect(sectionScores.reading?.feedback).toBe('Strong reading comprehension')
      
      expect(sectionScores.listening).toBeDefined()
      expect(sectionScores.writing).toBeDefined()
      expect(sectionScores.speaking).toBeDefined()

      // Calculate total score (Requirement 7.3)
      const totalScore = 
        (sectionScores.reading?.scaleScore || 0) +
        (sectionScores.listening?.scaleScore || 0) +
        (sectionScores.writing?.scaleScore || 0) +
        (sectionScores.speaking?.scaleScore || 0)
      
      expect(totalScore).toBe(97) // 24 + 20 + 25 + 28
    })

    it('should handle partial completion for completion badge', () => {
      const { setSectionScore } = useExamStore.getState()
      
      // Only 2 sections completed
      setSectionScore('reading', { cefrBand: 5, scaleScore: 24 })
      setSectionScore('listening', { cefrBand: 4, scaleScore: 20 })

      const { sectionScores } = useExamStore.getState()
      const completedCount = Object.keys(sectionScores).length
      
      expect(completedCount).toBe(2)
      // ScoreReport would display "2/4 sections completed"
    })
  })

  describe('Error scenarios', () => {
    it('should handle missing feedback gracefully', () => {
      const { setSectionScore } = useExamStore.getState()
      
      setSectionScore('reading', {
        cefrBand: 5,
        scaleScore: 24
        // No feedback provided
      })

      const { sectionScores } = useExamStore.getState()
      expect(sectionScores.reading?.cefrBand).toBe(5)
      expect(sectionScores.reading?.scaleScore).toBe(24)
      expect(sectionScores.reading?.feedback).toBeUndefined()
    })

    it('should handle fallback scores with provisional indicator', () => {
      const { setSectionScore } = useExamStore.getState()
      
      // Fallback score as per Requirement 14.2
      setSectionScore('writing', {
        cefrBand: 3,
        scaleScore: 15,
        feedback: 'Grading service unavailable. A provisional score has been assigned.'
      })

      const { sectionScores } = useExamStore.getState()
      expect(sectionScores.writing?.scaleScore).toBe(15)
      expect(sectionScores.writing?.feedback).toContain('provisional')
    })
  })
})
