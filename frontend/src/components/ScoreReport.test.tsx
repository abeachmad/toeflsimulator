import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ScoreReport } from './ScoreReport'
import { useExamStore } from '../stores'

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('ScoreReport Component', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    useExamStore.getState().reset()
  })

  it('should display "No Session Found" when sessionId is null', () => {
    // Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )

    expect(screen.getByText('No Session Found')).toBeInTheDocument()
    expect(screen.getByText('Please complete an exam before viewing scores.')).toBeInTheDocument()
  })

  it('should display section scores with scale score and CEFR band', () => {
    // Requirement 7.1, 7.2
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'test-session-123' })
    setSectionScore('reading', { cefrBand: 5, scaleScore: 25, feedback: 'Good job!' })
    setSectionScore('listening', { cefrBand: 4, scaleScore: 20 })

    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )

    // Check Reading section
    expect(screen.getByText('25/30')).toBeInTheDocument()
    expect(screen.getByText('C1')).toBeInTheDocument()
    expect(screen.getByText('Good job!')).toBeInTheDocument()

    // Check Listening section
    expect(screen.getByText('20/30')).toBeInTheDocument()
    expect(screen.getByText('B2')).toBeInTheDocument()
  })

  it('should calculate and display total score as sum of section scores', () => {
    // Requirement 7.3
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'test-session-123' })
    setSectionScore('reading', { cefrBand: 5, scaleScore: 25 })
    setSectionScore('listening', { cefrBand: 4, scaleScore: 20 })
    setSectionScore('writing', { cefrBand: 3, scaleScore: 18 })
    setSectionScore('speaking', { cefrBand: 4, scaleScore: 22 })

    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )

    // Total should be 25 + 20 + 18 + 22 = 85
    expect(screen.getByText('85')).toBeInTheDocument()
    expect(screen.getByText('/120')).toBeInTheDocument()
  })

  it('should display completion badge with count of completed sections', () => {
    // Requirement 7.4
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'test-session-123' })
    setSectionScore('reading', { cefrBand: 5, scaleScore: 25 })
    setSectionScore('listening', { cefrBand: 4, scaleScore: 20 })
    setSectionScore('writing', { cefrBand: 3, scaleScore: 18 })
    // Speaking not completed

    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )

    expect(screen.getByText('3/4 sections completed')).toBeInTheDocument()
  })

  it('should display AI-generated feedback for completed sections', () => {
    // Requirement 7.5
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'test-session-123' })
    setSectionScore('reading', { 
      cefrBand: 5, 
      scaleScore: 25, 
      feedback: 'Excellent reading comprehension demonstrated.'
    })
    setSectionScore('writing', { 
      cefrBand: 4, 
      scaleScore: 22, 
      feedback: 'Strong essay structure with minor grammatical errors.'
    })

    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )

    expect(screen.getByText('Excellent reading comprehension demonstrated.')).toBeInTheDocument()
    expect(screen.getByText('Strong essay structure with minor grammatical errors.')).toBeInTheDocument()
  })

  it('should navigate to home when "Return to Home" button is clicked', () => {
    // Requirement 7.5 (Return to Home button)
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'test-session-123' })
    setSectionScore('reading', { cefrBand: 5, scaleScore: 25 })

    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )

    const returnButton = screen.getByRole('button', { name: /return to home/i })
    fireEvent.click(returnButton)

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('should reset exam store when returning home', () => {
    // Verify store is reset on navigation
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'test-session-123' })
    setSectionScore('reading', { cefrBand: 5, scaleScore: 25 })

    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )

    const returnButton = screen.getByRole('button', { name: /return to home/i })
    fireEvent.click(returnButton)

    const state = useExamStore.getState()
    expect(state.sessionId).toBeNull()
    expect(Object.keys(state.sectionScores).length).toBe(0)
  })

  it('should show placeholder scores for incomplete sections', () => {
    // Verify incomplete sections show --/30
    const { setSession, setSectionScore } = useExamStore.getState()
    
    setSession({ sessionId: 'test-session-123' })
    setSectionScore('reading', { cefrBand: 5, scaleScore: 25 })
    // Other sections incomplete

    render(
      <BrowserRouter>
        <ScoreReport />
      </BrowserRouter>
    )

    const placeholders = screen.getAllByText('--/30')
    expect(placeholders.length).toBe(3) // 3 incomplete sections

    const cefrPlaceholders = screen.getAllByText('--')
    expect(cefrPlaceholders.length).toBeGreaterThanOrEqual(3)
  })
})
