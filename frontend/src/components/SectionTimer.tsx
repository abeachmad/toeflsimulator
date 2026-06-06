import { useEffect, useState, useCallback } from 'react'
import { useExamStore } from '../stores'

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

  // Retrieve existing timer state from backend (Requirement 12.2)
  const retrieveTimerState = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/timers/${sessionId}`)

      if (response.status === 410) {
        // Timer expired (Requirement 2.6)
        console.log('[SectionTimer] Timer already expired')
        setTimerId(sessionId)
        setRemainingSeconds(0)
        setIsExpired(true)
        onExpire()
        return true // Timer exists but expired
      }

      if (response.status === 404) {
        // Timer doesn't exist yet
        console.log('[SectionTimer] No existing timer found')
        return false
      }

      if (!response.ok) {
        console.error('Failed to retrieve timer state:', response.statusText)
        return false
      }

      const data = await response.json()
      const { startTime, expirationTime, remainingTime } = data.data

      // Calculate remaining time from start_time and current_time (Requirements 12.3, 12.4)
      const now = Date.now()
      const expiration = new Date(expirationTime).getTime()
      const calculatedRemaining = Math.floor((expiration - now) / 1000)
      
      // Clamp remaining time to zero if calculated value is negative (Requirement 12.4)
      const clampedRemaining = Math.max(0, calculatedRemaining)
      
      console.log('[SectionTimer] Retrieved timer state:', {
        startTime,
        expirationTime,
        serverRemainingTime: remainingTime,
        calculatedRemaining,
        clampedRemaining
      })

      setTimerId(sessionId)
      setRemainingSeconds(clampedRemaining)
      
      if (clampedRemaining === 0) {
        setIsExpired(true)
        onExpire()
      }
      
      return true // Timer exists
    } catch (error) {
      console.error('Error retrieving timer state:', error)
      return false
    }
  }, [onExpire])

  // Start timer with backend API (Requirement 12.1)
  const startTimer = useCallback(async (sessionId: string) => {
    try {
      console.log('[SectionTimer] Starting new timer:', { sessionId, section, duration: timeLimit })
      
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
      console.log('[SectionTimer] Timer started successfully:', data.data)
      
      setTimerId(data.data.timerId)
      setRemainingSeconds(data.data.remainingTime)
    } catch (error) {
      console.error('Error starting timer:', error)
    }
  }, [section, timeLimit])

  // Stop timer via backend API (Requirement 12.5)
  const stopTimer = useCallback(async (id: string) => {
    try {
      console.log('[SectionTimer] Stopping timer:', id)
      
      const response = await fetch(`${API_URL}/api/timers/${id}`, { 
        method: 'DELETE' 
      })
      
      if (response.ok) {
        console.log('[SectionTimer] Timer stopped successfully')
      } else {
        console.error('Failed to stop timer:', response.statusText)
      }
    } catch (error) {
      console.error('Error stopping timer:', error)
    }
  }, [])

  // Poll timer state from backend
  const pollTimerState = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/timers/${id}`)

      if (response.status === 410) {
        // Timer expired (Requirement 2.6)
        if (!isExpired) {
          console.log('[SectionTimer] Timer expired (410 response)')
          setIsExpired(true)
          setRemainingSeconds(0)
          // Call backend stop API when timer reaches zero (Requirement 12.5)
          await stopTimer(id)
          onExpire()
        }
        return
      }

      if (!response.ok) {
        console.error('Failed to fetch timer state:', response.statusText)
        return
      }

      const data = await response.json()
      const { expirationTime } = data.data
      
      // Calculate remaining time from expiration time and current time (Requirements 12.3, 12.4)
      const now = Date.now()
      const expiration = new Date(expirationTime).getTime()
      const calculatedRemaining = Math.floor((expiration - now) / 1000)
      
      // Clamp remaining time to zero if calculated value is negative (Requirement 12.4)
      const clampedRemaining = Math.max(0, calculatedRemaining)
      
      setRemainingSeconds(clampedRemaining)

      // Check if timer just expired
      if (clampedRemaining <= 0 && !isExpired) {
        console.log('[SectionTimer] Timer just expired')
        setIsExpired(true)
        // Call backend stop API when timer reaches zero (Requirement 12.5)
        await stopTimer(id)
        onExpire()
      }
    } catch (error) {
      console.error('Error polling timer state:', error)
    }
  }, [onExpire, isExpired, stopTimer])

  // Initialize timer on mount - retrieve existing state or start new (Requirement 12.2)
  useEffect(() => {
    // ✅ FIX: Read sessionId from Zustand store instead of localStorage directly
    const { sessionId } = useExamStore.getState()
    
    if (!sessionId) {
      console.error('[SectionTimer] No session ID found for timer')
      return
    }

    console.log('[SectionTimer] Initializing timer with sessionId:', sessionId)

    const initializeTimer = async () => {
      // First, try to retrieve existing timer state (Requirement 12.2)
      const timerExists = await retrieveTimerState(sessionId)
      
      // If no timer exists, start a new one (Requirement 12.1)
      if (!timerExists) {
        await startTimer(sessionId)
      }
    }

    initializeTimer()
  }, [retrieveTimerState, startTimer])

  // Poll timer state every second
  useEffect(() => {
    if (!timerId || isExpired) return

    const interval = setInterval(() => {
      pollTimerState(timerId)
    }, 1000)

    return () => clearInterval(interval)
  }, [timerId, isExpired, pollTimerState])

  // Call backend stop API when section completes (Requirement 12.5)
  // Stop timer on unmount
  useEffect(() => {
    return () => {
      if (timerId) {
        stopTimer(timerId)
      }
    }
  }, [timerId, stopTimer])

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
