import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Header } from './Header'
import { useTimerStore } from '../stores/timerStore'
import { useUIStore } from '../stores/uiStore'

// Mock the stores
vi.mock('../stores/timerStore')
vi.mock('../stores/uiStore')

describe('Header Component', () => {
  const mockOpenReviewModal = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock implementations
    vi.mocked(useTimerStore).mockReturnValue({
      remainingTime: 1800, // 30 minutes
    } as ReturnType<typeof useTimerStore>)

    vi.mocked(useUIStore).mockReturnValue({
      openReviewModal: mockOpenReviewModal,
    } as ReturnType<typeof useUIStore>)
  })

  describe('Timer Display', () => {
    it('should display timer in HH:MM:SS format', () => {
      render(<Header />)

      // 1800 seconds = 00:30:00
      expect(screen.getByText('00:30:00')).toBeInTheDocument()
    })

    it('should format time correctly for 1 hour 23 minutes 45 seconds', () => {
      vi.mocked(useTimerStore).mockReturnValue({
        remainingTime: 5025, // 1:23:45
      } as ReturnType<typeof useTimerStore>)

      render(<Header />)

      expect(screen.getByText('01:23:45')).toBeInTheDocument()
    })

    it('should display timer in red when less than 5 minutes remaining', () => {
      vi.mocked(useTimerStore).mockReturnValue({
        remainingTime: 290, // 4:50 (< 300 seconds)
      } as ReturnType<typeof useTimerStore>)

      render(<Header />)

      const timerElement = screen.getByText('00:04:50')
      expect(timerElement).toHaveClass('text-red-400')
    })

    it('should display timer in white when more than 5 minutes remaining', () => {
      render(<Header />)

      const timerElement = screen.getByText('00:30:00')
      expect(timerElement).toHaveClass('text-white')
    })
  })

  describe('Section Name', () => {
    it('should display section name when provided', () => {
      render(<Header sectionName="Reading" />)

      expect(screen.getByText('Reading')).toBeInTheDocument()
    })

    it('should not display section name when not provided', () => {
      render(<Header />)

      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })
  })

  describe('Volume Control Button', () => {
    it('should not show volume control by default', () => {
      render(<Header />)

      expect(screen.queryByLabelText('Volume control')).not.toBeInTheDocument()
    })

    it('should show volume control when showVolumeControl is true', () => {
      render(<Header showVolumeControl />)

      expect(screen.getByLabelText('Volume control')).toBeInTheDocument()
    })

    it('should call onVolumeClick when volume button is clicked', async () => {
      const user = userEvent.setup()
      const mockVolumeClick = vi.fn()

      render(<Header showVolumeControl onVolumeClick={mockVolumeClick} />)

      const volumeButton = screen.getByLabelText('Volume control')
      await user.click(volumeButton)

      expect(mockVolumeClick).toHaveBeenCalledOnce()
    })

    it('should display volume level in title', () => {
      render(<Header showVolumeControl volumeLevel={50} />)

      const volumeButton = screen.getByLabelText('Volume control')
      expect(volumeButton).toHaveAttribute('title', 'Volume: 50%')
    })
  })

  describe('Help Button', () => {
    it('should render help button', () => {
      render(<Header />)

      expect(screen.getByLabelText('Help')).toBeInTheDocument()
    })

    it('should call onHelp when help button is clicked', async () => {
      const user = userEvent.setup()
      const mockHelp = vi.fn()

      render(<Header onHelp={mockHelp} />)

      const helpButton = screen.getByLabelText('Help')
      await user.click(helpButton)

      expect(mockHelp).toHaveBeenCalledOnce()
    })
  })

  describe('Review Button', () => {
    it('should render review button', () => {
      render(<Header />)

      expect(screen.getByLabelText('Review')).toBeInTheDocument()
    })

    it('should call openReviewModal when review button is clicked', async () => {
      const user = userEvent.setup()

      render(<Header />)

      const reviewButton = screen.getByLabelText('Review')
      await user.click(reviewButton)

      expect(mockOpenReviewModal).toHaveBeenCalledOnce()
    })
  })

  describe('Hide Button', () => {
    it('should not render hide button when onHide is not provided', () => {
      render(<Header />)

      expect(screen.queryByLabelText('Hide')).not.toBeInTheDocument()
    })

    it('should render hide button when onHide is provided', () => {
      render(<Header onHide={vi.fn()} />)

      expect(screen.getByLabelText('Hide')).toBeInTheDocument()
    })

    it('should call onHide when hide button is clicked', async () => {
      const user = userEvent.setup()
      const mockHide = vi.fn()

      render(<Header onHide={mockHide} />)

      const hideButton = screen.getByLabelText('Hide')
      await user.click(hideButton)

      expect(mockHide).toHaveBeenCalledOnce()
    })
  })

  describe('Next Button', () => {
    it('should not render next button when onNext is not provided', () => {
      render(<Header />)

      expect(screen.queryByLabelText('Next')).not.toBeInTheDocument()
    })

    it('should render next button when onNext is provided', () => {
      render(<Header onNext={vi.fn()} />)

      expect(screen.getByLabelText('Next')).toBeInTheDocument()
    })

    it('should call onNext when next button is clicked', async () => {
      const user = userEvent.setup()
      const mockNext = vi.fn()

      render(<Header onNext={mockNext} />)

      const nextButton = screen.getByLabelText('Next')
      await user.click(nextButton)

      expect(mockNext).toHaveBeenCalledOnce()
    })

    it('should disable next button when nextDisabled is true', () => {
      render(<Header onNext={vi.fn()} nextDisabled />)

      const nextButton = screen.getByLabelText('Next')
      expect(nextButton).toBeDisabled()
    })

    it('should not call onNext when disabled button is clicked', async () => {
      const user = userEvent.setup()
      const mockNext = vi.fn()

      render(<Header onNext={mockNext} nextDisabled />)

      const nextButton = screen.getByLabelText('Next')
      await user.click(nextButton)

      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('Styling', () => {
    it('should have dark charcoal background', () => {
      const { container } = render(<Header />)

      const header = container.querySelector('header')
      expect(header).toHaveClass('bg-ets-charcoal')
    })

    it('should have ETS navy background for timer container', () => {
      const { container } = render(<Header />)

      const timerContainer = container.querySelector('.bg-ets-navy')
      expect(timerContainer).toBeInTheDocument()
    })

    it('should have ETS blue background for review button', () => {
      render(<Header />)

      const reviewButton = screen.getByLabelText('Review')
      expect(reviewButton).toHaveClass('bg-ets-blue')
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero time remaining', () => {
      vi.mocked(useTimerStore).mockReturnValue({
        remainingTime: 0,
      } as ReturnType<typeof useTimerStore>)

      render(<Header />)

      expect(screen.getByText('00:00:00')).toBeInTheDocument()
    })

    it('should handle very large time values', () => {
      vi.mocked(useTimerStore).mockReturnValue({
        remainingTime: 359999, // 99:59:59
      } as ReturnType<typeof useTimerStore>)

      render(<Header />)

      expect(screen.getByText('99:59:59')).toBeInTheDocument()
    })

    it('should render correctly with all props provided', () => {
      render(
        <Header
          showVolumeControl
          sectionName="Listening"
          onHide={vi.fn()}
          onNext={vi.fn()}
          nextDisabled={false}
          onHelp={vi.fn()}
          onVolumeClick={vi.fn()}
          volumeLevel={80}
        />
      )

      expect(screen.getByText('Listening')).toBeInTheDocument()
      expect(screen.getByLabelText('Volume control')).toBeInTheDocument()
      expect(screen.getByLabelText('Help')).toBeInTheDocument()
      expect(screen.getByLabelText('Review')).toBeInTheDocument()
      expect(screen.getByLabelText('Hide')).toBeInTheDocument()
      expect(screen.getByLabelText('Next')).toBeInTheDocument()
    })
  })

  describe('Accessibility - Keyboard Navigation (Requirement 23.2)', () => {
    it('should allow help button to be activated with Enter key', async () => {
      const user = userEvent.setup()
      const mockHelp = vi.fn()

      render(<Header onHelp={mockHelp} />)

      const helpButton = screen.getByLabelText('Help')
      helpButton.focus()

      expect(helpButton).toHaveFocus()

      await user.keyboard('{Enter}')

      expect(mockHelp).toHaveBeenCalledOnce()
    })

    it('should allow help button to be activated with Space key', async () => {
      const user = userEvent.setup()
      const mockHelp = vi.fn()

      render(<Header onHelp={mockHelp} />)

      const helpButton = screen.getByLabelText('Help')
      helpButton.focus()

      await user.keyboard(' ')

      expect(mockHelp).toHaveBeenCalledOnce()
    })

    it('should allow review button to be activated with Enter key', async () => {
      const user = userEvent.setup()

      render(<Header />)

      const reviewButton = screen.getByLabelText('Review')
      reviewButton.focus()

      expect(reviewButton).toHaveFocus()

      await user.keyboard('{Enter}')

      expect(mockOpenReviewModal).toHaveBeenCalledOnce()
    })

    it('should allow review button to be activated with Space key', async () => {
      const user = userEvent.setup()

      render(<Header />)

      const reviewButton = screen.getByLabelText('Review')
      reviewButton.focus()

      await user.keyboard(' ')

      expect(mockOpenReviewModal).toHaveBeenCalledOnce()
    })

    it('should allow volume control to be activated with keyboard', async () => {
      const user = userEvent.setup()
      const mockVolumeClick = vi.fn()

      render(<Header showVolumeControl onVolumeClick={mockVolumeClick} />)

      const volumeButton = screen.getByLabelText('Volume control')
      volumeButton.focus()

      expect(volumeButton).toHaveFocus()

      await user.keyboard('{Enter}')

      expect(mockVolumeClick).toHaveBeenCalledOnce()
    })

    it('should allow hide button to be activated with keyboard', async () => {
      const user = userEvent.setup()
      const mockHide = vi.fn()

      render(<Header onHide={mockHide} />)

      const hideButton = screen.getByLabelText('Hide')
      hideButton.focus()

      await user.keyboard('{Enter}')

      expect(mockHide).toHaveBeenCalledOnce()
    })

    it('should allow next button to be activated with keyboard', async () => {
      const user = userEvent.setup()
      const mockNext = vi.fn()

      render(<Header onNext={mockNext} />)

      const nextButton = screen.getByLabelText('Next')
      nextButton.focus()

      await user.keyboard('{Enter}')

      expect(mockNext).toHaveBeenCalledOnce()
    })

    it('should not activate disabled next button with keyboard', async () => {
      const user = userEvent.setup()
      const mockNext = vi.fn()

      render(<Header onNext={mockNext} nextDisabled />)

      const nextButton = screen.getByLabelText('Next')
      nextButton.focus()

      await user.keyboard('{Enter}')

      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should allow tab navigation through all interactive elements', async () => {
      const user = userEvent.setup()

      render(
        <Header
          showVolumeControl
          onHelp={vi.fn()}
          onHide={vi.fn()}
          onNext={vi.fn()}
        />
      )

      // Tab through all buttons
      await user.tab()
      expect(screen.getByLabelText('Volume control')).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText('Help')).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText('Review')).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText('Hide')).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText('Next')).toHaveFocus()
    })

    it('should allow reverse tab navigation through interactive elements', async () => {
      const user = userEvent.setup()

      render(
        <Header
          showVolumeControl
          onHelp={vi.fn()}
          onHide={vi.fn()}
          onNext={vi.fn()}
        />
      )

      // Focus on the last button
      const nextButton = screen.getByLabelText('Next')
      nextButton.focus()

      // Shift+Tab backwards through all buttons
      await user.tab({ shift: true })
      expect(screen.getByLabelText('Hide')).toHaveFocus()

      await user.tab({ shift: true })
      expect(screen.getByLabelText('Review')).toHaveFocus()

      await user.tab({ shift: true })
      expect(screen.getByLabelText('Help')).toHaveFocus()

      await user.tab({ shift: true })
      expect(screen.getByLabelText('Volume control')).toHaveFocus()
    })
  })

  describe('Accessibility - ARIA Labels (Requirement 23.1)', () => {
    it('should have proper ARIA label for volume control button', () => {
      render(<Header showVolumeControl />)

      const volumeButton = screen.getByLabelText('Volume control')
      expect(volumeButton).toHaveAttribute('aria-label', 'Volume control')
    })

    it('should have proper ARIA label for help button', () => {
      render(<Header />)

      const helpButton = screen.getByLabelText('Help')
      expect(helpButton).toHaveAttribute('aria-label', 'Help')
    })

    it('should have proper ARIA label for review button', () => {
      render(<Header />)

      const reviewButton = screen.getByLabelText('Review')
      expect(reviewButton).toHaveAttribute('aria-label', 'Review')
    })

    it('should have proper ARIA label for hide button', () => {
      render(<Header onHide={vi.fn()} />)

      const hideButton = screen.getByLabelText('Hide')
      expect(hideButton).toHaveAttribute('aria-label', 'Hide')
    })

    it('should have proper ARIA label for next button', () => {
      render(<Header onNext={vi.fn()} />)

      const nextButton = screen.getByLabelText('Next')
      expect(nextButton).toHaveAttribute('aria-label', 'Next')
    })

    it('should provide descriptive title for volume control showing level', () => {
      render(<Header showVolumeControl volumeLevel={75} />)

      const volumeButton = screen.getByLabelText('Volume control')
      expect(volumeButton).toHaveAttribute('title', 'Volume: 75%')
    })
  })

  describe('Accessibility - Screen Reader Support (Requirement 23.4)', () => {
    it('should have accessible timer display with visible text', () => {
      render(<Header />)

      const timerText = screen.getByText('00:30:00')
      expect(timerText).toBeVisible()
      expect(timerText).toHaveClass('font-mono')
    })

    it('should provide visual and semantic section name', () => {
      render(<Header sectionName="Reading" />)

      const sectionHeading = screen.getByText('Reading')
      expect(sectionHeading).toBeVisible()
      expect(sectionHeading.tagName).toBe('H1')
    })

    it('should have visible text labels on all buttons', () => {
      render(
        <Header
          showVolumeControl
          onHelp={vi.fn()}
          onHide={vi.fn()}
          onNext={vi.fn()}
        />
      )

      expect(screen.getByText('Volume')).toBeVisible()
      expect(screen.getByText('Help')).toBeVisible()
      expect(screen.getByText('Review')).toBeVisible()
      expect(screen.getByText('Hide')).toBeVisible()
      expect(screen.getByText('Next')).toBeVisible()
    })

    it('should have semantic button elements for all actions', () => {
      render(
        <Header
          showVolumeControl
          onHelp={vi.fn()}
          onHide={vi.fn()}
          onNext={vi.fn()}
        />
      )

      expect(screen.getByLabelText('Volume control').tagName).toBe('BUTTON')
      expect(screen.getByLabelText('Help').tagName).toBe('BUTTON')
      expect(screen.getByLabelText('Review').tagName).toBe('BUTTON')
      expect(screen.getByLabelText('Hide').tagName).toBe('BUTTON')
      expect(screen.getByLabelText('Next').tagName).toBe('BUTTON')
    })

    it('should properly indicate disabled state for screen readers', () => {
      render(<Header onNext={vi.fn()} nextDisabled />)

      const nextButton = screen.getByLabelText('Next')
      expect(nextButton).toHaveAttribute('disabled')
      expect(nextButton).toBeDisabled()
    })
  })

  describe('Timer Display Updates (Requirement 10.1)', () => {
    it('should update timer display when remainingTime changes', () => {
      const { rerender } = render(<Header />)

      expect(screen.getByText('00:30:00')).toBeInTheDocument()

      // Update the store mock to return different time
      vi.mocked(useTimerStore).mockReturnValue({
        remainingTime: 1500, // 25 minutes
      } as ReturnType<typeof useTimerStore>)

      rerender(<Header />)

      expect(screen.getByText('00:25:00')).toBeInTheDocument()
    })

    it('should show visual warning when time is running low', () => {
      vi.mocked(useTimerStore).mockReturnValue({
        remainingTime: 120, // 2 minutes
      } as ReturnType<typeof useTimerStore>)

      render(<Header />)

      const timerElement = screen.getByText('00:02:00')
      expect(timerElement).toHaveClass('text-red-400')
    })

    it('should display timer with clock icon for visual identification', () => {
      const { container } = render(<Header />)

      // Check for SVG clock icon
      const clockIcon = container.querySelector('svg path[d*="M12 8v4l3 3"]')
      expect(clockIcon).toBeInTheDocument()
    })
  })

  describe('Integration - Multiple Button States', () => {
    it('should handle multiple button interactions in sequence', async () => {
      const user = userEvent.setup()
      const mockHelp = vi.fn()
      const mockHide = vi.fn()
      const mockNext = vi.fn()

      render(<Header onHelp={mockHelp} onHide={mockHide} onNext={mockNext} />)

      await user.click(screen.getByLabelText('Help'))
      expect(mockHelp).toHaveBeenCalledOnce()

      await user.click(screen.getByLabelText('Review'))
      expect(mockOpenReviewModal).toHaveBeenCalledOnce()

      await user.click(screen.getByLabelText('Hide'))
      expect(mockHide).toHaveBeenCalledOnce()

      await user.click(screen.getByLabelText('Next'))
      expect(mockNext).toHaveBeenCalledOnce()
    })
  })
})
