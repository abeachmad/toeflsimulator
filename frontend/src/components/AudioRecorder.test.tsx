import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AudioRecorder } from './AudioRecorder'
import type { SpeakingQuestion } from './AudioRecorder'

// Mock zustand stores
vi.mock('../stores/examStore', () => ({
  useExamStore: () => ({
    setSectionScore: vi.fn(),
  }),
}))

const mockQuestion: SpeakingQuestion = {
  id: 'sp-001',
  section: 'speaking',
  type: 'independent',
  difficulty_level: 'medium',
  stage: 1,
  content: JSON.stringify({ prompt: 'Describe your favorite place.' }),
  irt_a: 1.0,
  irt_b: 0.0,
  irt_c: 0.15,
}

// ---- MediaRecorder mock ----
class MockMediaRecorder {
  state = 'inactive'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  start = vi.fn(() => { this.state = 'recording' })
  stop = vi.fn(() => {
    this.state = 'inactive'
    this.onstop?.()
  })
  static isTypeSupported = vi.fn(() => true)
}

describe('AudioRecorder', () => {
  const originalMediaDevices = Object.getOwnPropertyDescriptor(
    navigator,
    'mediaDevices',
  )
  const originalMediaRecorder = (globalThis as Record<string, unknown>).MediaRecorder

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock MediaRecorder
    ;(globalThis as Record<string, unknown>).MediaRecorder = MockMediaRecorder
  })

  afterEach(() => {
    ;(globalThis as Record<string, unknown>).MediaRecorder = originalMediaRecorder
    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices)
    }
  })

  function mockMicrophoneGranted() {
    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    }
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
    })
  }

  function mockMicrophoneDenied() {
    const error = new Error('NotAllowedError')
    error.name = 'NotAllowedError'
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockRejectedValue(error),
      },
      configurable: true,
    })
  }

  it('renders the speaking prompt', () => {
    render(<AudioRecorder question={mockQuestion} />)
    expect(screen.getByText('Describe your favorite place.')).toBeInTheDocument()
  })

  it('shows Start Recording button initially', () => {
    render(<AudioRecorder question={mockQuestion} />)
    expect(screen.getByRole('button', { name: /start recording/i })).toBeInTheDocument()
  })

  it('shows Stop Recording button after recording starts', async () => {
    const user = userEvent.setup()
    mockMicrophoneGranted()

    render(<AudioRecorder question={mockQuestion} />)
    await user.click(screen.getByRole('button', { name: /start recording/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument()
    })
  })

  it('shows microphone denial error with browser-specific instructions', async () => {
    const user = userEvent.setup()
    mockMicrophoneDenied()

    render(<AudioRecorder question={mockQuestion} />)
    await user.click(screen.getByRole('button', { name: /start recording/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/microphone access is required/i)).toBeInTheDocument()
    })
    
    // Verify Retry button appears after error (text changes but aria-label stays "Start recording")
    await waitFor(() => {
      expect(screen.getByText(/retry recording/i)).toBeInTheDocument()
    })
  })

  it('shows Re-record button after stopping', async () => {
    const user = userEvent.setup()
    mockMicrophoneGranted()

    render(<AudioRecorder question={mockQuestion} />)
    await user.click(screen.getByRole('button', { name: /start recording/i }))

    await waitFor(() =>
      screen.getByRole('button', { name: /stop recording/i }),
    )
    await user.click(screen.getByRole('button', { name: /stop recording/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /re-record/i })).toBeInTheDocument()
    })
  })

  it('calls onSubmit with fallback score when grading API fails', async () => {
    const user = userEvent.setup()
    mockMicrophoneGranted()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const onSubmit = vi.fn()
    render(<AudioRecorder question={mockQuestion} onSubmit={onSubmit} maxDurationSeconds={120} />)

    await user.click(screen.getByRole('button', { name: /start recording/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: /stop recording/i }))
    // Use aria-label for precise matching
    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: /submit speaking response/i }),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    )
    await user.click(screen.getByRole('button', { name: /submit speaking response/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ cefrBand: 3, scaleScore: 15 })
    })
  })

  it('shows progress bar while recording', async () => {
    const user = userEvent.setup()
    mockMicrophoneGranted()

    render(<AudioRecorder question={mockQuestion} />)
    await user.click(screen.getByRole('button', { name: /start recording/i }))

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  it('has main aria-label for accessibility', () => {
    render(<AudioRecorder question={mockQuestion} />)
    expect(screen.getByRole('main', { name: /speaking task/i })).toBeInTheDocument()
  })

  // Requirements 13.1, 13.2, 13.3 - Microphone Permission Error Handling
  describe('Microphone Permission Error Handling', () => {
    it('detects permission denial and prevents recording interface from activating', async () => {
      const user = userEvent.setup()
      mockMicrophoneDenied()

      render(<AudioRecorder question={mockQuestion} />)
      
      // Try to start recording
      await user.click(screen.getByRole('button', { name: /start recording/i }))

      // Verify error state is set
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByText(/unable to access microphone/i)).toBeInTheDocument()
      })

      // Verify recording interface did not activate (no stop button, no progress bar)
      expect(screen.queryByRole('button', { name: /stop recording/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('displays error message explaining microphone access is required', async () => {
      const user = userEvent.setup()
      mockMicrophoneDenied()

      render(<AudioRecorder question={mockQuestion} />)
      await user.click(screen.getByRole('button', { name: /start recording/i }))

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toBeInTheDocument()
        expect(alert.textContent).toMatch(/microphone access is required/i)
      })
    })

    it('displays instructions for enabling microphone in browser settings', async () => {
      const user = userEvent.setup()
      mockMicrophoneDenied()

      render(<AudioRecorder question={mockQuestion} />)
      await user.click(screen.getByRole('button', { name: /start recording/i }))

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        // Should contain browser-specific instructions (Chrome, Firefox, Safari, Edge, or generic)
        expect(alert.textContent).toMatch(/(Chrome|Firefox|Safari|Edge|browser settings)/i)
      })
    })

    it('allows retry after permission denial', async () => {
      const user = userEvent.setup()
      mockMicrophoneDenied()

      render(<AudioRecorder question={mockQuestion} />)
      await user.click(screen.getByRole('button', { name: /start recording/i }))

      // Wait for error state (text changes to "Retry Recording")
      await waitFor(() => {
        expect(screen.getByText(/retry recording/i)).toBeInTheDocument()
      })

      // Now grant permission
      mockMicrophoneGranted()

      // Click retry (use aria-label which is still "Start recording")
      await user.click(screen.getByRole('button', { name: /start recording/i }))

      // Should start recording successfully
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument()
      })
    })

    it('handles NotFoundError (no microphone device)', async () => {
      const user = userEvent.setup()
      const error = new Error('NotFoundError')
      error.name = 'NotFoundError'
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockRejectedValue(error),
        },
        configurable: true,
      })

      render(<AudioRecorder question={mockQuestion} />)
      await user.click(screen.getByRole('button', { name: /start recording/i }))

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert.textContent).toMatch(/no microphone was found/i)
      })
    })
  })
})
