import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ScoreReport } from './ScoreReport'
import { useExamStore } from '../stores'

/**
 * Workflow tests simulating the complete exam flow ending at ScoreReport
 * Validates Requirements 7.1-7.5 in context of full exam completion
 */
describe('ScoreReport Workflow Tests', () => {
  beforeEach(() => {
    useExamStore.getState().reset()
    localStorage.clear()
  })

  it('should display scores after completing all four sections', () => {
    // Simulate the workflow from SectionDisplay to ScoreReport
    const { setSession, setSectionScore } = useExamStore.getState()
    
    // Step 1: Start exam
    setSession({ sessionId: 'workflow-session-001' })
    
    // Step 2: Complete Reading section
    setSectionScore('reading', {
      cefrBand: 5,
      scaleScore: 26,
      feedback: 'Strong comprehension of academic texts.',
    })
    
    // Step 3: Complete Listening section  
    setSectionScore('listening', {
      cefrBand: 4,
      scaleScore: 22,
      feedback: 'Good understanding of conversations and lectures.',
    })
    
    // Step 4: Complete Writing section
    setSectionScore('writing', {
      cefrBand: 4,
      scaleScore: 21,
      feedback: 'Well-structured essays with clear arguments.',
    })
    
    // Step 5: Complete Speaking section
    setSectionScore('speaking', {
      cefrBand: 4,
      scaleScore: 23,
      feedback: 'Fluent speech with minor pronunciation issues.',
    })
    
    // Step 6: Navigate to ScoreReport (simulated)
    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )
    
    // Verify complete exam display
    
    // Total score: 26 + 22 + 21 + 23 = 92
    expect(screen.getByText('92')).toBeInTheDocument()
    expect(screen.getByText('/120')).toBeInTheDocument()
    
    // All section scores visible
    expect(screen.getByText('26/30')).toBeInTheDocument()
    expect(screen.getByText('22/30')).toBeInTheDocument()
    expect(screen.getByText('21/30')).toBeInTheDocument()
    expect(screen.getByText('23/30')).toBeInTheDocument()
    
    // CEFR bands: C1 for Reading, B2 for others
    expect(screen.getByText('C1')).toBeInTheDocument()
    expect(screen.getAllByText('B2')).toHaveLength(3)
    
    // All feedback displayed
    expect(screen.getByText(/Strong comprehension/)).toBeInTheDocument()
    expect(screen.getByText(/Good understanding/)).toBeInTheDocument()
    expect(screen.getByText(/Well-structured essays/)).toBeInTheDocument()
    expect(screen.getByText(/Fluent speech/)).toBeInTheDocument()
    
    // No completion badge when all complete
    expect(screen.queryByText(/sections completed/)).not.toBeInTheDocument()
  })

  it('should handle Reading and Listening auto-scored, Writing/Speaking pending', () => {
    // Simulate workflow where Reading/Listening are auto-scored immediately
    // but Writing/Speaking are still being graded by AI
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'workflow-session-002' })
    
    // Auto-scored sections (immediate)
    setSectionScore('reading', {
      cefrBand: 4,
      scaleScore: 20,
      feedback: 'IRT-based scoring completed.',
    })
    
    setSectionScore('listening', {
      cefrBand: 3,
      scaleScore: 17,
      feedback: 'IRT-based scoring completed.',
    })
    
    // Writing and Speaking not yet graded (AI pending)
    
    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )
    
    // Partial total: 20 + 17 = 37
    expect(screen.getByText('37')).toBeInTheDocument()
    
    // Completion badge
    expect(screen.getByText('2/4 sections completed')).toBeInTheDocument()
    
    // Completed sections show scores
    expect(screen.getByText('20/30')).toBeInTheDocument()
    expect(screen.getByText('17/30')).toBeInTheDocument()
    
    // Incomplete sections show placeholders
    const placeholders = screen.getAllByText('--/30')
    expect(placeholders.length).toBe(2)
  })

  it('should persist scores through localStorage and survive page refresh', () => {
    // First render: Set scores
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'persist-workflow-003' })
    setSectionScore('reading', { cefrBand: 6, scaleScore: 30 })
    setSectionScore('writing', { cefrBand: 5, scaleScore: 25 })
    
    const { unmount } = render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )
    
    expect(screen.getByText('55')).toBeInTheDocument() // 30 + 25
    
    unmount()
    
    // Simulate page refresh: Create new component instance
    // Data should persist from localStorage
    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )
    
    // Scores should still be visible
    expect(screen.getByText('55')).toBeInTheDocument()
    expect(screen.getByText('30/30')).toBeInTheDocument()
    expect(screen.getByText('25/30')).toBeInTheDocument()
  })

  it('should allow user to return home and start new exam', () => {
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'return-home-004' })
    setSectionScore('reading', { cefrBand: 5, scaleScore: 25 })
    setSectionScore('listening', { cefrBand: 4, scaleScore: 20 })
    
    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )
    
    // Click Return to Home button
    const returnButton = screen.getByRole('button', { name: /return to home/i })
    fireEvent.click(returnButton)
    
    // Verify store is reset (ready for new exam)
    const state = useExamStore.getState()
    expect(state.sessionId).toBeNull()
    expect(state.sectionScores).toEqual({})
    expect(state.currentSection).toBeNull()
    expect(state.answers.size).toBe(0)
  })

  it('should correctly display scores from backend submission format', () => {
    // Simulate the exact format returned by backend endpoint
    // POST /api/sessions/:sessionId/sections/:section/submit
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'backend-format-005' })
    
    // Reading section backend response
    const readingScore = {
      cefrBand: 5,
      scaleScore: 27,
      feedback: 'Auto-graded based on IRT parameters',
      details: {
        correct: 18,
        total: 20,
        theta: 1.2,
      }
    }
    setSectionScore('reading', readingScore)
    
    // Listening section backend response
    const listeningScore = {
      cefrBand: 4,
      scaleScore: 21,
      feedback: 'Auto-graded based on IRT parameters',
      details: {
        correct: 22,
        total: 28,
        theta: 0.5,
      }
    }
    setSectionScore('listening', listeningScore)
    
    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )
    
    // Verify scores display correctly
    expect(screen.getByText('48')).toBeInTheDocument() // 27 + 21
    expect(screen.getByText('27/30')).toBeInTheDocument()
    expect(screen.getByText('21/30')).toBeInTheDocument()
    expect(screen.getByText('C1')).toBeInTheDocument()
    expect(screen.getByText('B2')).toBeInTheDocument()
    
    // Feedback displayed
    expect(screen.getAllByText(/Auto-graded based on IRT parameters/).length).toBe(2)
  })

  it('should handle Gemini API grading format for Writing/Speaking', () => {
    // Simulate format from Gemini API grading endpoints
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'gemini-format-006' })
    
    // Writing section Gemini response
    const writingScore = {
      cefrBand: 4,
      scaleScore: 22,
      feedback: 'The essay demonstrates good organization and coherent arguments. Grammar is mostly accurate with minor errors. Vocabulary range is appropriate for academic context.',
      details: {
        rubric: 'Integrated Writing',
        wordCount: 287,
        grammarErrors: 3,
      }
    }
    setSectionScore('writing', writingScore)
    
    // Speaking section Gemini response
    const speakingScore = {
      cefrBand: 4,
      scaleScore: 24,
      feedback: 'Clear pronunciation and good fluency. Response addresses the prompt effectively. Minor grammatical inconsistencies noted.',
      details: {
        taskType: 'Independent Speaking',
        duration: 44,
        pronunciationScore: 0.85,
      }
    }
    setSectionScore('speaking', speakingScore)
    
    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )
    
    // Verify scores
    expect(screen.getByText('46')).toBeInTheDocument() // 22 + 24
    expect(screen.getByText('22/30')).toBeInTheDocument()
    expect(screen.getByText('24/30')).toBeInTheDocument()
    
    // Verify AI feedback
    expect(screen.getByText(/essay demonstrates good organization/)).toBeInTheDocument()
    expect(screen.getByText(/Clear pronunciation and good fluency/)).toBeInTheDocument()
  })
})
