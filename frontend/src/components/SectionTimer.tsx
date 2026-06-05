import { useEffect, useState, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

interface SectionTimerProps {
  section: 'reading' | 'listening' | 'writing' | 'speaking'
  timeLimit: number // in minutes
  onExpire: () => void
}

/**
 * SectionTimer Component
 * Displays countdown timer for exam sections with backend synchronization
 * Changes color at 5 minutes (orange) and 1 minute (red) remaining
 * Requirements: 2.5, 2.6, 2.7, 2.8
 */
export function SectionTimer({ section, timeLimit, onExpire }: SectionTimerProps) {
  const [timerId, setTimerId] = useState<string | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(timeLimit * 60)
  const [isExpired, setIsExpired] = useState(false)

  // Format seconds to MM:SS format (Requirement 2.5)
  const formatTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  // Get color based on remaining time (Requirements 2.7, 2.8)
  const getTimerColor = (): string => {
    if (remainingSeconds <= 60) {
      return 'text-red-600' // Red when < 1 minute
    } else if (remainingSeconds <= 300) {
      return 'text-orange-500' // Orange when < 5 minutes
    }
    return 'text-gray-700' // Default color
  }

  // Start timer with backend API
  const startTimer = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/timers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sectionName: section,
          duration: timeLimit
        })
      })

      if (!response.ok) {
        console.error('Failed to start timer:', response.statusText)
        return
      }

      const data = await response.json()
      setTimerId(data.data.timerId)
      setRemainingSeconds(data.data.remainingTime)
    } catch (error) {
      console.error('Error starting timer:', error)
    }
  }, [section, timeLimit])

  // Poll timer state from backend
  const pollTimerState = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/timers/${id}`)

      if (response.status === 410) {
        // Timer expired (Requirement 2.6)
        setIsExpired(true)
        setRemainingSeconds(0)
        onExpire()
        return
      }

      if (!response.ok) {
        console.error('Failed to fetch timer state:', response.statusText)
        return
      }

      const data = await response.json()
      setRemainingSeconds(Math.max(0, data.data.remainingTime))

      // Check if timer just expired
      if (data.data.remainingTime <= 0 && !isExpired) {
        setIsExpired(true)
        onExpire()
      }
    } catch (error) {
      console.error('Error polling timer state:', error)
    }
  }, [onExpire, isExpired])

  // Initialize timer on mount
  useEffect(() => {
    const sessionId = localStorage.getItem('sessionId')
    if (!sessionId) {
      console.error('No session ID found for timer')
      return
    }

    startTimer(sessionId)
  }, [startTimer])

  // Poll timer state every second
  useEffect(() => {
    if (!timerId || isExpired) return

    const interval = setInterval(() => {
      pollTimerState(timerId)
    }, 1000)

    return () => clearInterval(interval)
  }, [timerId, isExpired, pollTimerState])

  // Stop timer on unmount
  useEffect(() => {
    return () => {
      if (timerId) {
        fetch(`${API_URL}/api/timers/${timerId}`, { method: 'DELETE' })
          .catch(err => console.error('Error stopping timer:', err))
      }
    }
  }, [timerId])

  return (
    <div 
      className={`font-mono text-lg font-semibold ${getTimerColor()}`}
      role="timer"
      aria-live="polite"
      aria-label={`Time remaining: ${formatTime(remainingSeconds)}`}
    >
      {formatTime(remainingSeconds)}
    </div>
  )
}
