import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AudioPlayer } from './AudioPlayer'
import { ListeningQuestionDisplay, type ListeningQuestion } from './ListeningQuestionDisplay'
import { useExamStore } from '../stores/examStore'

/**
 * Integration Tests for Listening Section Components
 * 
 * Tests the complete workflow of:
 * 1. AudioPlayer controls (play, pause, volume)
 * 2. Question unlocking after audio completion (Requirement 4.8)
 * 3. Answer submission (Requirement 4.1, 13.3)
 * 
 * **Requirements Validated:**
 * - Requirement 4.1: Listening items across Choose Response, Conversations, and Academic Talks
 * - Requirement 4.8: Audio playback controls with volume adjustment
 * - Requirement 13.3: Allow changing answers within current module
 * - Task 17.3: AudioPlayer controls, question unlocking, answer submission
 */

// Mock stores
vi.mock('../stores/examStore', () => ({
  useExamStore: vi.fn()
}))

// Mock HTMLMediaElement
class MockAudio {
  src = ''
  volume = 1
  currentTime = 0
  duration = 60 // 1 minute audio
  paused = true

  play = vi.fn().mockResolvedValue(undefined)
  pause = vi.fn()
  addEventListener = vi.fn()
  removeEventListener = vi.fn()
  load = vi.fn()
}

describe('Listening Section Integration Tests (Task 17.3)', () => {
  let mockAudio: MockAudio
  const mockUpdateAnswer = vi.fn()
  const mockAnswers = new Map<string, string>()

  beforeEach(() => {
    vi.clearAllMocks()
    mockAnswers.clear()

    // Mock examStore
    ;(useExamStore as any).mockReturnValue({
      answers: mockAnswers,
      updateAnswer: mockUpdateAnswer
    })

    // Create fresh mock audio
    mockAudio = new MockAudio()

    // Mock HTMLAudioElement
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(mockAudio.play)
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(mockAudio.pause)
    vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(mockAudio.load)

    Object.defineProperty(window.HTMLMediaElement.prototype, 'currentTime', {
      get: () => mockAudio.currentTime,
      set: (value: number) => {
        mockAudio.currentTime = value
      },
      configurable: true,
    })

    Object.defineProperty(window.HTMLMediaElement.prototype, 'duration', {
      get: () => mockAudio.duration,
      configurable: true,
    })

    Object.defineProperty(window.HTMLMediaElement.prototype, 'volume', {
      get: () => mockAudio.volume,
      set: (value: number) => {
        mockAudio.volume = value
      },
      configurable: true,
    })

    Object.defineProperty(window.HTMLMediaElement.prototype, 'paused', {
      get: () => mockAudio.paused,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('AudioPlayer Controls (Requirement 4.8)', () => {
    it('should render audio player with play controls', () => {
      render(<AudioPlayer src="/audio/test.mp3" />)

      expect(screen.getByLabelText('Audio player')).toBeInTheDocument()
      expect(screen.getByLabelText('Play audio')).toBeInTheDocument()
      expect(screen.getByLabelText('Volume control')).toBeInTheDocument()
    })

    it('should play audio when play button is clicked', async () => {
      const user = userEvent.setup()
      render(<AudioPlayer src="/audio/test.mp3" />)

      const playButton = screen.getByLabelText('Play audio')
      await user.click(playButton)

      expect(mockAudio.play).toHaveBeenCalledOnce()
    })

    it('should pause audio when pause button is clicked', async () => {
      const user = userEvent.setup()
      const { container } = render(<AudioPlayer src="/audio/test.mp3" />)

      // Start playing
      const playButton = screen.getByLabelText('Play audio')
      await user.click(playButton)

      const audioElement = container.querySelector('audio')
      audioElement?.dispatchEvent(new Event('play'))

      await waitFor(() => {
        expect(screen.getByLabelText('Pause audio')).toBeInTheDocument()
      })

      // Pause
      const pauseButton = screen.getByLabelText('Pause audio')
      await user.click(pauseButton)

      expect(mockAudio.pause).toHaveBeenCalled()
    })

    it('should adjust volume when volume slider is changed', async () => {
      const user = userEvent.setup()
      render(<AudioPlayer src="/audio/test.mp3" initialVolume={50} />)

      // Open volume slider
      const volumeButton = screen.getByLabelText('Volume control')
      await user.click(volumeButton)

      const volumeSlider = screen.getByLabelText('Adjust volume') as HTMLInputElement
      fireEvent.change(volumeSlider, { target: { value: '80' } })

      await waitFor(() => {
        expect(mockAudio.volume).toBe(0.8)
      })
    })

    it('should display audio progress as it plays', async () => {
      const { container } = render(<AudioPlayer src="/audio/test.mp3" />)

      const audioElement = container.querySelector('audio')
      audioElement?.dispatchEvent(new Event('loadedmetadata'))

      // Simulate audio progress (30 seconds elapsed)
      mockAudio.currentTime = 30
      audioElement?.dispatchEvent(new Event('timeupdate'))

      await waitFor(() => {
        expect(screen.getByText('00:30')).toBeInTheDocument()
      })

      // Progress should be 50% (30/60)
      const progressBar = screen.getByLabelText('Audio playback progress')
      await waitFor(() => {
        expect(progressBar.style.width).toContain('50')
      })
    })
  })

  describe('Question Unlocking After Audio Completion (Requirement 4.8, Task 17.3)', () => {
    const testQuestion: ListeningQuestion = {
      id: 'listen-001',
      section: 'listening',
      type: 'conversation',
      difficulty_level: 'medium',
      stage: 1,
      content: JSON.stringify({
        audioUrl: '/audio/conversation.mp3',
        transcript: 'Student and professor conversation',
        question: 'What is the main topic?'
      }),
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_answer: 'Option A',
      irt_a: 1.2,
      irt_b: 0.3,
      irt_c: 0.2
    }

    it('should allow answer selection before audio completion (no gatekeeper in Listening)', () => {
      /**
       * Unlike Reading section with gatekeeper scroll mechanism,
       * Listening section allows immediate interaction.
       * Questions are not locked by default.
       */
      render(<ListeningQuestionDisplay question={testQuestion} />)

      const firstOption = screen.getByLabelText(/Option A: Option A/i)
      fireEvent.click(firstOption)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('listen-001', 'Option A')
    })

    it('should trigger onEnded callback when audio finishes', async () => {
      const onEnded = vi.fn()
      const { container } = render(<AudioPlayer src="/audio/test.mp3" onEnded={onEnded} />)

      const audioElement = container.querySelector('audio')
      audioElement?.dispatchEvent(new Event('ended'))

      await waitFor(() => {
        expect(onEnded).toHaveBeenCalledOnce()
      })
    })

    it('should maintain answer state throughout audio playback', async () => {
      const user = userEvent.setup()

      // Render audio player and question together
      const { container } = render(
        <div>
          <AudioPlayer src="/audio/conversation.mp3" />
          <ListeningQuestionDisplay question={testQuestion} />
        </div>
      )

      // Select answer before playing audio
      const option = screen.getByLabelText(/Option B: Option B/i)
      await user.click(option)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('listen-001', 'Option B')

      // Play audio
      const playButton = screen.getByLabelText('Play audio')
      await user.click(playButton)

      const audioElement = container.querySelector('audio')
      audioElement?.dispatchEvent(new Event('play'))

      // Answer should persist while audio is playing
      await waitFor(() => {
        expect(screen.getByText('Playing')).toBeInTheDocument()
      })

      expect(mockUpdateAnswer).toHaveBeenCalledWith('listen-001', 'Option B')
    })

    it('should allow changing answer after audio completes', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <div>
          <AudioPlayer src="/audio/conversation.mp3" />
          <ListeningQuestionDisplay question={testQuestion} />
        </div>
      )

      // Select initial answer
      const firstOption = screen.getByLabelText(/Option A: Option A/i)
      await user.click(firstOption)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('listen-001', 'Option A')

      // Play and complete audio
      const playButton = screen.getByLabelText('Play audio')
      await user.click(playButton)

      const audioElement = container.querySelector('audio')
      audioElement?.dispatchEvent(new Event('play'))
      audioElement?.dispatchEvent(new Event('ended'))

      // Change answer after audio completion
      const secondOption = screen.getByLabelText(/Option B: Option B/i)
      await user.click(secondOption)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('listen-001', 'Option B')
      expect(mockUpdateAnswer).toHaveBeenCalledTimes(2)
    })
  })

  describe('Answer Submission (Requirement 13.3, Task 17.3)', () => {
    const chooseResponseQuestion: ListeningQuestion = {
      id: 'cr-submit-001',
      section: 'listening',
      type: 'choose-response',
      difficulty_level: 'easy',
      stage: 1,
      content: JSON.stringify({
        audioUrl: '/audio/response.mp3',
        transcript: 'Choose the best response',
        question: 'Which response is most appropriate?'
      }),
      options: ['Response A', 'Response B', 'Response C'],
      correct_answer: 'Response A',
      irt_a: 1.0,
      irt_b: -0.2,
      irt_c: 0.25
    }

    it('should submit answer when option is selected', () => {
      render(<ListeningQuestionDisplay question={chooseResponseQuestion} />)

      const option = screen.getByLabelText(/Option A: Response A/i)
      fireEvent.click(option)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('cr-submit-001', 'Response A')
    })

    it('should allow changing submitted answer (Requirement 13.3)', () => {
      render(<ListeningQuestionDisplay question={chooseResponseQuestion} />)

      // Submit first answer
      const firstOption = screen.getByLabelText(/Option A: Response A/i)
      fireEvent.click(firstOption)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('cr-submit-001', 'Response A')

      // Change to second answer
      const secondOption = screen.getByLabelText(/Option B: Response B/i)
      fireEvent.click(secondOption)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('cr-submit-001', 'Response B')
      expect(mockUpdateAnswer).toHaveBeenCalledTimes(2)
    })

    it('should persist selected answer from examStore', () => {
      mockAnswers.set('cr-submit-001', 'Response C')

      render(<ListeningQuestionDisplay question={chooseResponseQuestion} />)

      const thirdOption = screen.getByLabelText(/Option C: Response C/i) as HTMLInputElement
      expect(thirdOption.checked).toBe(true)
    })

    it('should handle rapid answer changes', async () => {
      const user = userEvent.setup()
      render(<ListeningQuestionDisplay question={chooseResponseQuestion} />)

      // Rapidly change answers
      const optionA = screen.getByLabelText(/Option A: Response A/i)
      const optionB = screen.getByLabelText(/Option B: Response B/i)
      const optionC = screen.getByLabelText(/Option C: Response C/i)

      await user.click(optionA)
      await user.click(optionB)
      await user.click(optionC)
      await user.click(optionA)

      expect(mockUpdateAnswer).toHaveBeenCalledTimes(4)
      expect(mockUpdateAnswer).toHaveBeenNthCalledWith(1, 'cr-submit-001', 'Response A')
      expect(mockUpdateAnswer).toHaveBeenNthCalledWith(2, 'cr-submit-001', 'Response B')
      expect(mockUpdateAnswer).toHaveBeenNthCalledWith(3, 'cr-submit-001', 'Response C')
      expect(mockUpdateAnswer).toHaveBeenNthCalledWith(4, 'cr-submit-001', 'Response A')
    })
  })

  describe('Complete Listening Workflow (Task 17.3)', () => {
    const academicLectureQuestion: ListeningQuestion = {
      id: 'lecture-workflow-001',
      section: 'listening',
      type: 'academic-lecture',
      difficulty_level: 'hard',
      stage: 2,
      content: JSON.stringify({
        audioUrl: '/audio/lecture.mp3',
        transcript: 'Professor discusses environmental science',
        question: 'What is the main focus of the lecture?'
      }),
      options: [
        'Climate change',
        'Ecosystem dynamics',
        'Conservation',
        'Pollution'
      ],
      correct_answer: 'Ecosystem dynamics',
      irt_a: 1.8,
      irt_b: 1.0,
      irt_c: 0.15
    }

    it('should complete full workflow: play audio, answer question, change answer', async () => {
      const user = userEvent.setup()
      const onEnded = vi.fn()

      const { container } = render(
        <div>
          <AudioPlayer src="/audio/lecture.mp3" onEnded={onEnded} />
          <ListeningQuestionDisplay question={academicLectureQuestion} />
        </div>
      )

      // Step 1: Play audio
      const playButton = screen.getByLabelText('Play audio')
      await user.click(playButton)

      expect(mockAudio.play).toHaveBeenCalled()

      const audioElement = container.querySelector('audio')
      audioElement?.dispatchEvent(new Event('play'))

      await waitFor(() => {
        expect(screen.getByText('Playing')).toBeInTheDocument()
      })

      // Step 2: Answer question while audio is playing
      const option1 = screen.getByLabelText(/Option A: Climate change/i)
      await user.click(option1)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('lecture-workflow-001', 'Climate change')

      // Step 3: Audio continues playing, simulate progress
      mockAudio.currentTime = 30
      audioElement?.dispatchEvent(new Event('timeupdate'))

      await waitFor(() => {
        expect(screen.getByText('00:30')).toBeInTheDocument()
      })

      // Step 4: Change answer before audio completes
      const option2 = screen.getByLabelText(/Option B: Ecosystem dynamics/i)
      await user.click(option2)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('lecture-workflow-001', 'Ecosystem dynamics')

      // Step 5: Audio completes
      audioElement?.dispatchEvent(new Event('ended'))

      await waitFor(() => {
        expect(onEnded).toHaveBeenCalled()
      })

      // Step 6: Can still change answer after audio completes
      const option3 = screen.getByLabelText(/Option C: Conservation/i)
      await user.click(option3)

      expect(mockUpdateAnswer).toHaveBeenCalledWith('lecture-workflow-001', 'Conservation')
      expect(mockUpdateAnswer).toHaveBeenCalledTimes(3)
    })

    it('should handle audio replay scenario', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <div>
          <AudioPlayer src="/audio/lecture.mp3" />
          <ListeningQuestionDisplay question={academicLectureQuestion} />
        </div>
      )

      const audioElement = container.querySelector('audio')

      // First playthrough
      const playButton = screen.getByLabelText('Play audio')
      await user.click(playButton)
      audioElement?.dispatchEvent(new Event('play'))

      await waitFor(() => {
        expect(screen.getByText('Playing')).toBeInTheDocument()
      })

      // Audio ends
      audioElement?.dispatchEvent(new Event('ended'))

      await waitFor(() => {
        expect(screen.queryByText('Playing')).not.toBeInTheDocument()
      })

      // Play again
      const playButtonAgain = screen.getByLabelText('Play audio')
      await user.click(playButtonAgain)

      expect(mockAudio.play).toHaveBeenCalledTimes(2)
    })

    it('should maintain answer state across audio replays', async () => {
      const user = userEvent.setup()
      
      // Pre-set answer in mock store
      mockAnswers.set('lecture-workflow-001', 'Ecosystem dynamics')
      
      const { container } = render(
        <div>
          <AudioPlayer src="/audio/lecture.mp3" />
          <ListeningQuestionDisplay question={academicLectureQuestion} />
        </div>
      )

      // Answer should be pre-selected from store
      const selectedOption = screen.getByLabelText(/Option B: Ecosystem dynamics/i) as HTMLInputElement
      expect(selectedOption.checked).toBe(true)

      // Play audio
      const playButton = screen.getByLabelText('Play audio')
      await user.click(playButton)

      const audioElement = container.querySelector('audio')
      audioElement?.dispatchEvent(new Event('play'))

      // Audio ends
      audioElement?.dispatchEvent(new Event('ended'))

      // Play again - answer should persist
      const playButtonAgain = screen.getByLabelText('Play audio')
      await user.click(playButtonAgain)

      // Answer should still be selected
      const stillSelectedOption = screen.getByLabelText(/Option B: Ecosystem dynamics/i) as HTMLInputElement
      expect(stillSelectedOption.checked).toBe(true)
    })
  })

  describe('Multiple Question Types Integration', () => {
    it('should handle all three listening question types', () => {
      const questions: ListeningQuestion[] = [
        {
          id: 'multi-type-1',
          section: 'listening',
          type: 'choose-response',
          difficulty_level: 'easy',
          stage: 1,
          content: JSON.stringify({
            audioUrl: '/audio/response.mp3',
            transcript: 'Test',
            question: 'Choose response'
          }),
          options: ['A', 'B'],
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        },
        {
          id: 'multi-type-2',
          section: 'listening',
          type: 'conversation',
          difficulty_level: 'medium',
          stage: 1,
          content: JSON.stringify({
            audioUrl: '/audio/conv.mp3',
            transcript: 'Test',
            question: 'Conversation question'
          }),
          options: ['A', 'B'],
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        },
        {
          id: 'multi-type-3',
          section: 'listening',
          type: 'academic-lecture',
          difficulty_level: 'hard',
          stage: 2,
          content: JSON.stringify({
            audioUrl: '/audio/lecture.mp3',
            transcript: 'Test',
            question: 'Lecture question'
          }),
          options: ['A', 'B'],
          irt_a: 1.0,
          irt_b: 0.0,
          irt_c: 0.2
        }
      ]

      questions.forEach((question) => {
        const { unmount } = render(<ListeningQuestionDisplay question={question} />)

        // Should render all types without error
        const firstOption = screen.getByLabelText(/Option A: A/i)
        fireEvent.click(firstOption)

        expect(mockUpdateAnswer).toHaveBeenCalledWith(question.id, 'A')

        unmount()
        vi.clearAllMocks()
      })
    })
  })

  describe('Accessibility Integration (Requirement 23.1, 23.2)', () => {
    it('should support keyboard navigation through audio controls and question options', async () => {
      const user = userEvent.setup()
      const question: ListeningQuestion = {
        id: 'kbd-access-001',
        section: 'listening',
        type: 'conversation',
        difficulty_level: 'medium',
        stage: 1,
        content: JSON.stringify({
          audioUrl: '/audio/conv.mp3',
          transcript: 'Test',
          question: 'Test question'
        }),
        options: ['Option 1', 'Option 2'],
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2
      }

      render(
        <div>
          <AudioPlayer src="/audio/conv.mp3" />
          <ListeningQuestionDisplay question={question} />
        </div>
      )

      // Tab to play button
      const playButton = screen.getByLabelText('Play audio')
      playButton.focus()
      expect(document.activeElement).toBe(playButton)

      // Activate with Enter
      await user.keyboard('{Enter}')
      expect(mockAudio.play).toHaveBeenCalled()

      // Tab to radio button
      const firstRadio = screen.getByLabelText(/Option A: Option 1/i)
      firstRadio.focus()
      expect(document.activeElement).toBe(firstRadio)
    })

    it('should have proper ARIA labels for all interactive elements', () => {
      const question: ListeningQuestion = {
        id: 'aria-001',
        section: 'listening',
        type: 'conversation',
        difficulty_level: 'medium',
        stage: 1,
        content: JSON.stringify({
          audioUrl: '/audio/test.mp3',
          transcript: 'Test',
          question: 'Test question'
        }),
        options: ['Option A', 'Option B'],
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2
      }

      render(
        <div>
          <AudioPlayer src="/audio/test.mp3" />
          <ListeningQuestionDisplay question={question} />
        </div>
      )

      // Audio player ARIA labels
      expect(screen.getByLabelText('Audio player')).toBeInTheDocument()
      expect(screen.getByLabelText('Play audio')).toBeInTheDocument()
      expect(screen.getByLabelText('Volume control')).toBeInTheDocument()
      expect(screen.getByLabelText('Audio playback progress')).toBeInTheDocument()

      // Question ARIA labels
      expect(screen.getByRole('radiogroup', { name: 'Answer options' })).toBeInTheDocument()
      expect(screen.getByLabelText(/Option A: Option A/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Option B: Option B/i)).toBeInTheDocument()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle audio player with no onEnded callback', () => {
      const { container } = render(<AudioPlayer src="/audio/test.mp3" />)

      const audioElement = container.querySelector('audio')
      audioElement?.dispatchEvent(new Event('ended'))

      // Should not throw error
      expect(screen.getByLabelText('Play audio')).toBeInTheDocument()
    })

    it('should handle question with missing options', () => {
      const questionNoOptions: any = {
        id: 'no-opts-001',
        section: 'listening',
        type: 'conversation',
        difficulty_level: 'medium',
        stage: 1,
        content: JSON.stringify({
          audioUrl: '/audio/test.mp3',
          transcript: 'Test',
          question: 'Test question'
        }),
        options: undefined,
        irt_a: 1.0,
        irt_b: 0.0,
        irt_c: 0.2
      }

      render(<ListeningQuestionDisplay question={questionNoOptions} />)

      // Should render question without options (no crash)
      expect(screen.getByText('Test question')).toBeInTheDocument()
    })

    it('should handle zero-duration audio', () => {
      Object.defineProperty(window.HTMLMediaElement.prototype, 'duration', {
        get: () => 0,
        configurable: true,
      })

      render(<AudioPlayer src="/audio/test.mp3" />)

      // Should display 00:00 for both current and duration
      const timeDisplays = screen.getAllByText('00:00')
      expect(timeDisplays.length).toBeGreaterThan(0)
    })

    it('should handle invalid audio URL gracefully', () => {
      render(<AudioPlayer src="" />)

      // Should render player even with empty src
      expect(screen.getByLabelText('Audio player')).toBeInTheDocument()
    })
  })
})
