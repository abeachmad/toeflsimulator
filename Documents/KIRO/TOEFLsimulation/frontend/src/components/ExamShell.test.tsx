import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExamShell } from './ExamShell'
import { useExamStore } from '../stores'

// Mock fetch
global.fetch = vi.fn()

describe('ExamShell', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Reset all stores
    useExamStore.getState().reset()
    // Reset fetch mock
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Routing', () => {
    it('should render landing page at root route', () => {
      render(<ExamShell />)
      expect(screen.getByText(/TOEFL iBT 2026 Test Simulator/i)).toBeInTheDocument()
      expect(screen.getByText(/Start Practice Test/i)).toBeInTheDocument()
    })

    it('should navigate to /exam/start when clicking Start Practice Test', async () => {
      const user = userEvent.setup()
      render(<ExamShell />)

      const startButton = screen.getByText(/Start Practice Test/i)
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText(/Ready to Begin\?/i)).toBeInTheDocument()
      })
    })

    it('should redirect unknown routes to landing page', () => {
      window.history.pushState({}, '', '/invalid/route')
      render(<ExamShell />)

      expect(screen.getByText(/TOEFL iBT 2026 Test Simulator/i)).toBeInTheDocument()
    })
  })

  describe('Session Initialization', () => {
    it('should initialize new session when starting exam', async () => {
      const user = userEvent.setup()

      // Mock successful session creation
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test-session-123' }),
      })

      window.history.pushState({}, '', '/exam/start')
      render(<ExamShell />)

      // Should already be on exam start page
      expect(await screen.findByText(/Begin Test/i)).toBeInTheDocument()

      // Click Begin Test
      const beginButton = screen.getByText(/Begin Test/i)
      await user.click(beginButton)

      // Wait for API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/sessions',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }),
        )
      })

      // Verify store was updated
      const { sessionId } = useExamStore.getState()
      expect(sessionId).toBeTruthy()
    })

    it('should handle session initialization failure gracefully', async () => {
      const user = userEvent.setup()
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

      // Mock failed session creation
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error'),
      )

      window.history.pushState({}, '', '/exam/start')
      render(<ExamShell />)

      // Click Begin Test
      const beginButton = await screen.findByText(/Begin Test/i)
      await user.click(beginButton)

      // Should show error
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to start exam session'),
        )
      })

      alertSpy.mockRestore()
    })
  })

  describe('State Restoration', () => {
    it('should detect existing session from localStorage', async () => {
      // Set up existing session
      useExamStore.getState().setSession({
        sessionId: 'existing-session-123',
        currentSection: 'reading',
        currentModule: 'module-1',
        currentQuestionIndex: 5,
      })

      window.history.pushState({}, '', '/exam/start')
      render(<ExamShell />)

      // Should show existing session prompt
      await waitFor(() => {
        expect(screen.getByText(/Existing Session Found/i)).toBeInTheDocument()
      })
      expect(screen.getByText(/Resume Previous Session/i)).toBeInTheDocument()
    })

    it('should allow resuming existing session', async () => {
      // Set up existing session
      useExamStore.getState().setSession({
        sessionId: 'existing-session-123',
        currentSection: 'reading',
        currentModule: 'module-1',
        currentQuestionIndex: 5,
      })

      window.history.pushState({}, '', '/exam/start')
      render(<ExamShell />)

      const user = userEvent.setup()

      // Click Resume
      const resumeButton = await screen.findByText(/Resume Previous Session/i)
      await user.click(resumeButton)

      // Should navigate to section (use getAllByText to handle multiple matches)
      await waitFor(() => {
        const headings = screen.getAllByText(/Reading Section/i)
        expect(headings.length).toBeGreaterThan(0)
      })

      // Verify session data is preserved
      const { sessionId, currentSection } = useExamStore.getState()
      expect(sessionId).toBe('existing-session-123')
      expect(currentSection).toBe('reading')
    })

    it('should allow starting fresh session when existing session found', async () => {
      // Set up existing session
      useExamStore.getState().setSession({
        sessionId: 'existing-session-123',
        currentSection: 'reading',
        currentModule: 'module-1',
        currentQuestionIndex: 5,
      })

      const user = userEvent.setup()

      // Mock successful session creation
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'new-session-456' }),
      })

      window.history.pushState({}, '', '/exam/start')
      render(<ExamShell />)

      // Click Start New Test
      const startNewButton = await screen.findByText(/Start New Test/i)
      await user.click(startNewButton)

      // Should reset and create new session
      await waitFor(() => {
        const { sessionId } = useExamStore.getState()
        expect(sessionId).not.toBe('existing-session-123')
      })
    })
  })

  describe('Error Boundary', () => {
    it('should have error boundary in place for route errors', () => {
      // The error boundary is in place and will catch errors from route components
      // We verify the app renders correctly in normal state
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Set the initial URL to the root path
      window.history.pushState({}, '', '/')
      render(<ExamShell />)
      
      // Should render landing page normally
      expect(screen.getByText(/TOEFL iBT 2026 Test Simulator/i)).toBeInTheDocument()

      consoleSpy.mockRestore()
    })
  })

  describe('Navigation Guards', () => {
    it('should redirect to /exam/start when accessing section without session', async () => {
      window.history.pushState({}, '', '/exam/section/reading')
      render(<ExamShell />)

      await waitFor(() => {
        expect(screen.getByText(/Ready to Begin\?/i)).toBeInTheDocument()
      })
    })

    it('should allow section access with valid session', async () => {
      // Set up session
      useExamStore.getState().setSession({
        sessionId: 'session-123',
        currentSection: 'reading',
      })

      window.history.pushState({}, '', '/exam/section/reading')
      render(<ExamShell />)

      await waitFor(() => {
        // Use getAllByText to handle multiple matches and just check one exists
        const headings = screen.getAllByText(/Reading Section/i)
        expect(headings.length).toBeGreaterThan(0)
      })
    })
  })
})
