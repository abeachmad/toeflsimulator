import { useState, useRef, useEffect } from 'react'

interface AudioPlayerProps {
  /**
   * URL of the audio file to play
   */
  src: string
  /**
   * Callback fired when audio finishes playing
   */
  onEnded?: () => void
  /**
   * Callback fired when audio starts playing
   */
  onPlay?: () => void
  /**
   * Callback fired when audio is paused
   */
  onPause?: () => void
  /**
   * Initial volume level (0-100)
   */
  initialVolume?: number
  /**
   * Optional CSS class name
   */
  className?: string
}

/**
 * AudioPlayer Component
 * 
 * HTML5 audio player with custom controls for TOEFL Listening section
 * Implements official ETS audio player design specifications
 * 
 * Requirements: 4.8, 10.2
 * 
 * Features:
 * - Play/Pause control
 * - Volume adjustment (0-100)
 * - Progress bar (no seeking - per TOEFL rules)
 * - Current time and duration display (MM:SS format)
 * - Official ETS color scheme and styling
 * - Accessible keyboard controls
 * 
 * Note: Seeking is disabled per official TOEFL iBT exam rules.
 * Test takers cannot skip ahead or rewind audio content.
 */
export function AudioPlayer({
  src,
  onEnded,
  onPlay,
  onPause,
  initialVolume = 75,
  className = '',
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(initialVolume / 100)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const [hasError, setHasError] = useState(false)

  /**
   * Format time in MM:SS format
   */
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '00:00'
    
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  /**
   * Toggle play/pause
   */
  const handlePlayPause = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
  }

  /**
   * Handle volume change
   */
  const handleVolumeChange = (newVolume: number) => {
    if (!audioRef.current) return

    const volumeValue = newVolume / 100
    setVolume(volumeValue)
    audioRef.current.volume = volumeValue
  }

  /**
   * Audio event handlers
   */
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handlePlay = () => {
      setIsPlaying(true)
      onPlay?.()
    }

    const handlePause = () => {
      setIsPlaying(false)
      onPause?.()
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      onEnded?.()
    }

    const handleError = () => {
      setIsPlaying(false)
      setHasError(true)
      // Treat missing audio as "already played" so the test can proceed
      onEnded?.()
    }

    // Set initial volume
    audio.volume = volume

    // Attach event listeners
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    // Cleanup
    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [volume, onPlay, onPause, onEnded])

  /**
   * Calculate progress percentage
   */
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      className={`bg-ets-charcoal border border-gray-600 rounded-lg p-4 ${className}`}
      role="region"
      aria-label="Audio player"
    >
      {/* Hidden HTML5 audio element */}
      <audio ref={audioRef} src={src || undefined} preload="metadata" />

      {/* Fallback UI when audio is unavailable */}
      {hasError ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="flex items-center gap-2 text-yellow-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium">Audio Unavailable</span>
          </div>
          <p className="text-gray-400 text-xs text-center">
            The audio file could not be loaded. You may proceed with the question.
          </p>
        </div>
      ) : (
        /* Audio controls container */
        <div className="flex flex-col gap-4">
        {/* Progress bar (non-interactive - no seeking allowed) */}
        <div className="flex items-center gap-3">
          <span className="text-white text-sm font-mono min-w-[45px]">
            {formatTime(currentTime)}
          </span>
          
          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-ets-blue transition-all duration-100"
              style={{ width: `${progressPercentage}%` }}
              role="progressbar"
              aria-valuenow={Math.round(progressPercentage)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Audio playback progress"
            />
          </div>
          
          <span className="text-white text-sm font-mono min-w-[45px]">
            {formatTime(duration)}
          </span>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play/Pause button */}
            <button
              onClick={handlePlayPause}
              className="bg-ets-blue hover:bg-ets-light-blue text-white rounded-full p-3 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ets-light-blue focus:ring-offset-2 focus:ring-offset-ets-charcoal"
              aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
              type="button"
            >
              {isPlaying ? (
                // Pause icon
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                // Play icon
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Volume control */}
            <div className="relative">
              <button
                onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                className="bg-gray-700 hover:bg-gray-600 text-white rounded-md px-3 py-2 transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ets-light-blue focus:ring-offset-2 focus:ring-offset-ets-charcoal"
                aria-label="Volume control"
                aria-expanded={showVolumeSlider}
                type="button"
              >
                {volume === 0 ? (
                  // Muted icon
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                    />
                  </svg>
                ) : volume < 0.5 ? (
                  // Low volume icon
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  </svg>
                ) : (
                  // High volume icon
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  </svg>
                )}
                <span className="text-sm">{Math.round(volume * 100)}%</span>
              </button>

              {/* Volume slider dropdown */}
              {showVolumeSlider && (
                <div className="absolute bottom-full left-0 mb-2 bg-ets-navy border border-gray-600 rounded-md p-4 shadow-lg">
                  <div className="flex flex-col items-center gap-2">
                    <label htmlFor="volume-slider" className="text-white text-xs">
                      Volume
                    </label>
                    <input
                      id="volume-slider"
                      type="range"
                      min="0"
                      max="100"
                      value={volume * 100}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="w-32 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-ets-blue focus:outline-none focus:ring-2 focus:ring-ets-light-blue"
                      aria-label="Adjust volume"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            {isPlaying && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-white text-sm">Playing</span>
              </div>
            )}
          </div>
        </div>

        {/* Info message about seeking */}
        <div className="text-gray-400 text-xs text-center">
          Note: Seeking is not allowed per official TOEFL exam rules
        </div>
      </div>
      )}
    </div>
  )
}
