import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ScoreReport } from './ScoreReport'
import type { SectionScore } from '../stores/examStore'

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...original,
    useNavigate: () => mockNavigate,
  }
})

// Mock examStore
const mockReset = vi.fn()
let mockSessionId: string | null = 'session-abc123'
let mockSectionScores: Partial<Record<string, SectionScore>> = {}

vi.mock('../stores', () => ({
  useExamStore: () => ({
    sessionId: mockSessionId,
    sectionScores: mockSectionScores,
    reset: mockReset,
  }),
}))

function renderScoreReport() {
  return render(
    <MemoryRouter>
      <ScoreReport />
    </MemoryRouter>,
  )
}

describe('ScoreReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionId = 'session-abc123'
    mockSectionScores = {}
  })

  it('shows "No Session Found" when sessionId is null', () => {
    mockSessionId = null
    renderScoreReport()
    expect(screen.getByText(/no session found/i)).toBeInTheDocument()
  })

  it('renders the score report header', () => {
    renderScoreReport()
    expect(screen.getByText(/TOEFL iBT 2026 Score Report/i)).toBeInTheDocument()
  })

  it('shows -- for sections without scores', () => {
    renderScoreReport()
    // 4 sections × 2 dashes = 8 "--/30" and 4 "--"
    const placeholders = screen.getAllByText('--/30')
    expect(placeholders).toHaveLength(4)
  })

  it('displays scale score when section score is provided', () => {
    mockSectionScores = {
      reading: { cefrBand: 5, scaleScore: 26 },
    }
    renderScoreReport()
    expect(screen.getByText('26/30')).toBeInTheDocument()
  })

  it('displays CEFR band label correctly (B5 → C1)', () => {
    mockSectionScores = {
      reading: { cefrBand: 5, scaleScore: 26 },
    }
    renderScoreReport()
    expect(screen.getByText('C1')).toBeInTheDocument()
  })

  it('shows total score as sum of available section scores', () => {
    mockSectionScores = {
      reading: { cefrBand: 5, scaleScore: 26 },
      listening: { cefrBand: 4, scaleScore: 20 },
      writing: { cefrBand: 3, scaleScore: 15 },
      speaking: { cefrBand: 4, scaleScore: 18 },
    }
    renderScoreReport()
    // 26 + 20 + 15 + 18 = 79
    expect(screen.getByText(/79/)).toBeInTheDocument()
  })

  it('shows total score even when only some sections complete', () => {
    mockSectionScores = {
      reading: { cefrBand: 5, scaleScore: 25 },
      listening: { cefrBand: 4, scaleScore: 22 },
    }
    renderScoreReport()
    // 25 + 22 = 47
    expect(screen.getByText(/47/)).toBeInTheDocument()
  })

  it('shows "2/4 sections completed" badge when incomplete', () => {
    mockSectionScores = {
      reading: { cefrBand: 5, scaleScore: 25 },
      listening: { cefrBand: 4, scaleScore: 22 },
    }
    renderScoreReport()
    expect(screen.getByText(/2\/4 sections completed/)).toBeInTheDocument()
  })

  it('calls reset and navigate to / on Return Home click', () => {
    renderScoreReport()
    fireEvent.click(screen.getByRole('button', { name: /return to home/i }))
    expect(mockReset).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('renders feedback when provided', () => {
    mockSectionScores = {
      writing: {
        cefrBand: 4,
        scaleScore: 20,
        feedback: 'Good use of vocabulary.',
      },
    }
    renderScoreReport()
    expect(screen.getByText('Good use of vocabulary.')).toBeInTheDocument()
  })

  it('has proper aria-label for main region', () => {
    renderScoreReport()
    expect(screen.getByRole('main', { name: /toefl score report/i })).toBeInTheDocument()
  })

  it('renders all four section cards', () => {
    renderScoreReport()
    expect(screen.getByRole('region', { name: /reading score/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /listening score/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /writing score/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /speaking score/i })).toBeInTheDocument()
  })
})
