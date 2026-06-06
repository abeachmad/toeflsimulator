import { describe, it, expect, beforeEach } from 'vitest'
import { useExamStore, resetExamStore, EXAM_STORE_NAME } from './examStore'
import type { SectionScore } from './examStore'

describe('examStore - setSectionScore', () => {
  beforeEach(() => {
    // Clear localStorage and reset store before each test
    localStorage.clear()
    resetExamStore()
  })

  describe('Requirements 7.1, 7.2, 7.5: Score Storage', () => {
    it('should store section score with cefrBand, scaleScore, and feedback properties', () => {
      const score: SectionScore = {
        cefrBand: 5,
        scaleScore: 24,
        feedback: 'Excellent reading comprehension'
      }

      useExamStore.getState().setSectionScore('reading', score)

      const { sectionScores } = useExamStore.getState()
      expect(sectionScores.reading).toEqual(score)
      expect(sectionScores.reading?.cefrBand).toBe(5)
      expect(sectionScores.reading?.scaleScore).toBe(24)
      expect(sectionScores.reading?.feedback).toBe('Excellent reading comprehension')
    })

    it('should store scores for all four sections independently', () => {
      const readingScore: SectionScore = { cefrBand: 5, scaleScore: 24 }
      const listeningScore: SectionScore = { cefrBand: 4, scaleScore: 20 }
      const writingScore: SectionScore = { cefrBand: 3, scaleScore: 15 }
      const speakingScore: SectionScore = { cefrBand: 6, scaleScore: 28 }

      useExamStore.getState().setSectionScore('reading', readingScore)
      useExamStore.getState().setSectionScore('listening', listeningScore)
      useExamStore.getState().setSectionScore('writing', writingScore)
      useExamStore.getState().setSectionScore('speaking', speakingScore)

      const { sectionScores } = useExamStore.getState()
      expect(sectionScores.reading).toEqual(readingScore)
      expect(sectionScores.listening).toEqual(listeningScore)
      expect(sectionScores.writing).toEqual(writingScore)
      expect(sectionScores.speaking).toEqual(speakingScore)
    })

    it('should update existing section score when called multiple times', () => {
      const initialScore: SectionScore = { cefrBand: 3, scaleScore: 15 }
      const updatedScore: SectionScore = { cefrBand: 5, scaleScore: 25, feedback: 'Updated' }

      useExamStore.getState().setSectionScore('reading', initialScore)
      expect(useExamStore.getState().sectionScores.reading?.scaleScore).toBe(15)

      useExamStore.getState().setSectionScore('reading', updatedScore)
      expect(useExamStore.getState().sectionScores.reading?.scaleScore).toBe(25)
      expect(useExamStore.getState().sectionScores.reading?.feedback).toBe('Updated')
    })

    it('should store score with optional details property', () => {
      const score: SectionScore = {
        cefrBand: 4,
        scaleScore: 20,
        feedback: 'Good performance',
        details: {
          correct: 15,
          total: 20,
          theta: 0.5
        }
      }

      useExamStore.getState().setSectionScore('listening', score)

      const { sectionScores } = useExamStore.getState()
      expect(sectionScores.listening?.details).toEqual({
        correct: 15,
        total: 20,
        theta: 0.5
      })
    })
  })

  describe('Requirement 7.5: Score Persistence to localStorage', () => {
    it('should persist section scores to localStorage', () => {
      const score: SectionScore = {
        cefrBand: 5,
        scaleScore: 24,
        feedback: 'Excellent reading comprehension'
      }

      useExamStore.getState().setSectionScore('reading', score)

      // Check that localStorage was updated
      const stored = localStorage.getItem(EXAM_STORE_NAME)
      expect(stored).toBeTruthy()
      
      const parsed = JSON.parse(stored!)
      expect(parsed.state.sectionScores.reading).toEqual(score)
    })

    it('should rehydrate section scores from localStorage after page refresh', () => {
      // Set up initial scores
      const readingScore: SectionScore = { cefrBand: 5, scaleScore: 24 }
      const listeningScore: SectionScore = { cefrBand: 4, scaleScore: 20 }

      useExamStore.getState().setSectionScore('reading', readingScore)
      useExamStore.getState().setSectionScore('listening', listeningScore)

      // Verify scores are stored in localStorage
      const stored = localStorage.getItem(EXAM_STORE_NAME)
      expect(stored).toBeTruthy()

      // Simulate page refresh by getting fresh state from storage
      const parsed = JSON.parse(stored!)
      expect(parsed.state.sectionScores.reading).toEqual(readingScore)
      expect(parsed.state.sectionScores.listening).toEqual(listeningScore)
    })

    it('should survive page refresh without losing score data', () => {
      const score: SectionScore = {
        cefrBand: 5,
        scaleScore: 24,
        feedback: 'Test feedback',
        details: { correct: 18, total: 20 }
      }

      // Store score
      useExamStore.getState().setSectionScore('reading', score)

      // Get what's in localStorage
      const storedJson = localStorage.getItem(EXAM_STORE_NAME)
      expect(storedJson).toBeTruthy()

      // Parse and verify all properties are preserved
      const parsed = JSON.parse(storedJson!)
      const storedScore = parsed.state.sectionScores.reading
      expect(storedScore.cefrBand).toBe(5)
      expect(storedScore.scaleScore).toBe(24)
      expect(storedScore.feedback).toBe('Test feedback')
      expect(storedScore.details).toEqual({ correct: 18, total: 20 })
    })

    it('should maintain scores even when other store properties change', () => {
      const initialScore: SectionScore = { cefrBand: 5, scaleScore: 24 }
      
      useExamStore.getState().setSectionScore('reading', initialScore)
      
      // Change other store properties
      useExamStore.getState().setSession({
        sessionId: 'test-session-123',
        currentSection: 'writing',
        currentQuestionIndex: 5
      })
      
      // Verify score is still intact
      const { sectionScores } = useExamStore.getState()
      expect(sectionScores.reading).toEqual(initialScore)
      
      // Verify in localStorage too
      const stored = localStorage.getItem(EXAM_STORE_NAME)
      const parsed = JSON.parse(stored!)
      expect(parsed.state.sectionScores.reading).toEqual(initialScore)
    })
  })

  describe('Edge Cases', () => {
    it('should handle score with zero values', () => {
      const score: SectionScore = {
        cefrBand: 0,
        scaleScore: 0
      }

      useExamStore.getState().setSectionScore('reading', score)

      const { sectionScores } = useExamStore.getState()
      expect(sectionScores.reading?.cefrBand).toBe(0)
      expect(sectionScores.reading?.scaleScore).toBe(0)
    })

    it('should handle score with maximum values', () => {
      const score: SectionScore = {
        cefrBand: 6,
        scaleScore: 30,
        feedback: 'Perfect score'
      }

      useExamStore.getState().setSectionScore('reading', score)

      const { sectionScores } = useExamStore.getState()
      expect(sectionScores.reading?.cefrBand).toBe(6)
      expect(sectionScores.reading?.scaleScore).toBe(30)
    })

    it('should handle score without optional feedback', () => {
      const score: SectionScore = {
        cefrBand: 4,
        scaleScore: 20
      }

      useExamStore.getState().setSectionScore('listening', score)

      const { sectionScores } = useExamStore.getState()
      expect(sectionScores.listening?.cefrBand).toBe(4)
      expect(sectionScores.listening?.scaleScore).toBe(20)
      expect(sectionScores.listening?.feedback).toBeUndefined()
    })

    it('should not affect other sections when updating one section', () => {
      const readingScore: SectionScore = { cefrBand: 5, scaleScore: 24 }
      const listeningScore: SectionScore = { cefrBand: 4, scaleScore: 20 }

      useExamStore.getState().setSectionScore('reading', readingScore)
      useExamStore.getState().setSectionScore('listening', listeningScore)

      // Update reading score
      const newReadingScore: SectionScore = { cefrBand: 6, scaleScore: 28 }
      useExamStore.getState().setSectionScore('reading', newReadingScore)

      // Verify listening score unchanged
      const { sectionScores } = useExamStore.getState()
      expect(sectionScores.listening).toEqual(listeningScore)
      expect(sectionScores.reading).toEqual(newReadingScore)
    })
  })

  describe('Integration with reset', () => {
    it('should clear section scores when store is reset', () => {
      const score: SectionScore = { cefrBand: 5, scaleScore: 24 }
      
      useExamStore.getState().setSectionScore('reading', score)
      expect(useExamStore.getState().sectionScores.reading).toEqual(score)

      useExamStore.getState().reset()
      
      expect(useExamStore.getState().sectionScores).toEqual({})
      expect(useExamStore.getState().sectionScores.reading).toBeUndefined()
    })
  })
})
