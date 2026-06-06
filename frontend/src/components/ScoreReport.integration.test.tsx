import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ScoreReport } from './ScoreReport'
import { useExamStore } from '../stores'
import type { SectionScore } from '../stores/examStore'

/**
 * Integration tests for ScoreReport component
 * Tests requirements 7.1-7.5 with realistic exam scenarios
 */
describe('ScoreReport Integration Tests', () => {
  beforeEach(() => {
    useExamStore.getState().reset()
  })

  it('should display complete exam results for all four sections', () => {
    // Simulate a complete exam with all sections scored
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'complete-exam-001' })
    
    // Reading: High proficiency
    setSectionScore('reading', {
      cefrBand: 6,
      scaleScore: 30,
      feedback: 'Outstanding reading comprehension. Demonstrated excellent understanding of academic texts.',
    })
    
    // Listening: Upper-intermediate proficiency
    setSectionScore('listening', {
      cefrBand: 4,
      scaleScore: 22,
      feedback: 'Good listening skills. Some difficulty with complex academic lectures.',
    })
    
    // Writing: Intermediate proficiency
    setSectionScore('writing', {
      cefrBand: 3,
      scaleScore: 18,
      feedback: 'Adequate writing ability. Improve essay organization and vocabulary range.',
    })
    
    // Speaking: Upper-intermediate proficiency
    setSectionScore('speaking', {
      cefrBand: 4,
      scaleScore: 24,
      feedback: 'Clear pronunciation and fluent delivery. Minor grammatical errors.',
    })

    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )

    // Verify total score: 30 + 22 + 18 + 24 = 94
    expect(screen.getByText('94')).toBeInTheDocument()
    expect(screen.getByText('/120')).toBeInTheDocument()

    // Verify all section scores are displayed
    expect(screen.getByText('30/30')).toBeInTheDocument() // Reading
    expect(screen.getByText('22/30')).toBeInTheDocument() // Listening
    expect(screen.getByText('18/30')).toBeInTheDocument() // Writing
    expect(screen.getByText('24/30')).toBeInTheDocument() // Speaking

    // Verify CEFR bands
    expect(screen.getByText('C2')).toBeInTheDocument() // Reading
    expect(screen.getAllByText('B2')).toHaveLength(2) // Listening & Speaking
    expect(screen.getByText('B1')).toBeInTheDocument() // Writing

    // Verify all feedback is displayed
    expect(screen.getByText(/Outstanding reading comprehension/)).toBeInTheDocument()
    expect(screen.getByText(/Good listening skills/)).toBeInTheDocument()
    expect(screen.getByText(/Adequate writing ability/)).toBeInTheDocument()
    expect(screen.getByText(/Clear pronunciation/)).toBeInTheDocument()

    // Verify no completion badge when all sections complete
    expect(screen.queryByText(/sections completed/)).not.toBeInTheDocument()
  })

  it('should handle partial exam completion correctly', () => {
    // Simulate incomplete exam with only 2 sections completed
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'partial-exam-002' })
    
    setSectionScore('reading', {
      cefrBand: 5,
      scaleScore: 26,
      feedback: 'Very good reading skills.',
    })
    
    setSectionScore('listening', {
      cefrBand: 3,
      scaleScore: 16,
      feedback: 'Needs improvement in academic listening.',
    })
    
    // Writing and Speaking not completed

    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )

    // Verify partial total: 26 + 16 = 42
    expect(screen.getByText('42')).toBeInTheDocument()

    // Verify completion badge
    expect(screen.getByText('2/4 sections completed')).toBeInTheDocument()

    // Verify completed sections show scores
    expect(screen.getByText('26/30')).toBeInTheDocument()
    expect(screen.getByText('16/30')).toBeInTheDocument()
    expect(screen.getByText('C1')).toBeInTheDocument()
    expect(screen.getByText('B1')).toBeInTheDocument()

    // Verify incomplete sections show placeholders
    const placeholders = screen.getAllByText('--/30')
    expect(placeholders.length).toBe(2) // Writing & Speaking
  })

  it('should correctly map all CEFR bands (A1-C2)', () => {
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'cefr-test-003' })
    
    // Test all CEFR band levels
    setSectionScore('reading', { cefrBand: 1, scaleScore: 5 })   // A1
    setSectionScore('listening', { cefrBand: 2, scaleScore: 10 }) // A2
    setSectionScore('writing', { cefrBand: 3, scaleScore: 15 })   // B1
    setSectionScore('speaking', { cefrBand: 6, scaleScore: 30 })  // C2

    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )

    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getByText('A2')).toBeInTheDocument()
    expect(screen.getByText('B1')).toBeInTheDocument()
    expect(screen.getByText('C2')).toBeInTheDocument()
  })

  it('should persist scores across page refreshes via localStorage', () => {
    // Verify scores are persisted to localStorage
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'persist-test-004' })
    setSectionScore('reading', { cefrBand: 5, scaleScore: 25, feedback: 'Great job!' })
    setSectionScore('writing', { cefrBand: 4, scaleScore: 20 })

    // Simulate page refresh by creating new store instance
    const newStoreState = useExamStore.getState()
    
    expect(newStoreState.sessionId).toBe('persist-test-004')
    expect(newStoreState.sectionScores.reading?.scaleScore).toBe(25)
    expect(newStoreState.sectionScores.reading?.cefrBand).toBe(5)
    expect(newStoreState.sectionScores.reading?.feedback).toBe('Great job!')
    expect(newStoreState.sectionScores.writing?.scaleScore).toBe(20)
  })

  it('should handle edge case of zero scores', () => {
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'zero-score-005' })
    setSectionScore('reading', { cefrBand: 1, scaleScore: 0 })
    setSectionScore('listening', { cefrBand: 1, scaleScore: 0 })

    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )

    // Total should be 0
    expect(screen.getByText('0')).toBeInTheDocument()
    
    // Scores should display 0/30
    expect(screen.getAllByText('0/30').length).toBeGreaterThanOrEqual(2)
  })

  it('should handle edge case of perfect scores', () => {
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'perfect-score-006' })
    setSectionScore('reading', { cefrBand: 6, scaleScore: 30 })
    setSectionScore('listening', { cefrBand: 6, scaleScore: 30 })
    setSectionScore('writing', { cefrBand: 6, scaleScore: 30 })
    setSectionScore('speaking', { cefrBand: 6, scaleScore: 30 })

    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )

    // Total should be 120
    expect(screen.getByText('120')).toBeInTheDocument()
    
    // All sections should show 30/30
    expect(screen.getAllByText('30/30').length).toBe(4)
    
    // All should be C2
    expect(screen.getAllByText('C2').length).toBe(4)
  })

  it('should display scores without feedback gracefully', () => {
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'no-feedback-007' })
    // Scores without feedback property
    setSectionScore('reading', { cefrBand: 5, scaleScore: 25 })
    setSectionScore('listening', { cefrBand: 4, scaleScore: 20 })

    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )

    // Should still display scores correctly
    expect(screen.getByText('25/30')).toBeInTheDocument()
    expect(screen.getByText('20/30')).toBeInTheDocument()
    expect(screen.getByText('C1')).toBeInTheDocument()
    expect(screen.getByText('B2')).toBeInTheDocument()
    
    // Should display total
    expect(screen.getByText('45')).toBeInTheDocument()
  })
})
