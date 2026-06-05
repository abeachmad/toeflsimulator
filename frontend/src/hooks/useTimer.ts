/**
 * useTimer Hook
 * 
 * Implements Task 13.2: Timer countdown and heartbeat polling
 * 
 * Features:
 * - Countdown logic with setInterval (updates every second)
 * - Heartbeat polling (every 30 seconds) to sync with server
 * - Drift detection and automatic correction
 * - Auto-expiration handling
 * 
 * Requirements: 2.2, 2.3, 19.3
 */

import { useEffect, useRef } from 'react'
import { useTimerStore } from '../stores/timerStore'

interface UseTimerOptions {
  sessionId?: string
  onExpiration?: () => void
  heartbeatIntervalSeconds?: number
  countdownIntervalMs?: number
}

interface HeartbeatResponse {
  serverTime: number
  expirationTime: number
  remainingTime: number
  driftDetected: boolean
  driftAmount?: number
}

/**
 * Custom hook for managing timer countdown and server synchronization
 * 
 * @param options - Configuration options
 * @param options.sessionId - Current exam session ID (required for heartbeat)
 * @param options.onExpiration - Callback when timer expires
 * @param options.heartbeatIntervalSeconds - Heartbeat interval in seconds (default: 30)
 * @param options.countdownIntervalMs - Countdown update interval in ms (default: 1000)
 */
export function useTimer({
  sessionId,
  onExpiration,
  heartbeatIntervalSeconds = 30,
  countdownIntervalMs = 1000,
}: UseTimerOptions = {}) {
  const { tick, syncWithServer, handleExpiration, isExpired, expirationTime } =
    useTimerStore()

  const countdownIntervalRef = useRef<number | null>(null)
  const heartbeatIntervalRef = useRef<number | null>(null)
  const onExpirationRef = useRef(onExpiration)

  // Update ref when callback changes
  useEffect(() => {
    onExpirationRef.current = onExpiration
  }, [onExpiration])

  /**
   * Send heartbeat to server to sync time and detect drift
   */
  const sendHeartbeat = async () => {
    if (!sessionId) {
      console.warn('useTimer: sessionId not provided, skipping heartbeat')
      return
    }

    try {
      const clientTimestamp = Date.now()

      const response = await fetch(
        `/api/timers/${sessionId}/heartbeat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ clientTimestamp }),
        },
      )

      if (!response.ok) {
        // Handle timer expired (410 Gone)
        if (response.status === 410) {
          console.warn('useTimer: Timer has expired on server')
          handleExpiration()
          return
        }

        console.error(
          `useTimer: Heartbeat failed with status ${response.status}`,
        )
        return
      }

      const result = await response.json()
      const data: HeartbeatResponse = result.data

      // Sync with server time
      syncWithServer({
        serverTime: data.serverTime,
        expirationTime: data.expirationTime,
        driftThresholdMs: 5000, // 5 seconds threshold
      })

      // Log drift detection
      if (data.driftDetected) {
        console.warn(
          `useTimer: Time drift detected (${data.driftAmount}ms), synchronized with server`,
        )
      }
    } catch (error) {
      console.error('useTimer: Heartbeat request failed:', error)
      // Continue with local timer (fallback per Requirement 19.3)
    }
  }

  /**
   * Start countdown interval
   */
  useEffect(() => {
    // Don't start countdown if no expiration time set
    if (!expirationTime) {
      return
    }

    // Clear existing interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }

    // Start countdown with setInterval
    countdownIntervalRef.current = setInterval(() => {
      tick()
    }, countdownIntervalMs)

    // Cleanup on unmount
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
    }
  }, [expirationTime, countdownIntervalMs, tick])

  /**
   * Start heartbeat polling interval
   */
  useEffect(() => {
    // Don't start heartbeat if no session ID or no expiration time
    if (!sessionId || !expirationTime) {
      return
    }

    // Clear existing interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }

    // Send initial heartbeat immediately
    sendHeartbeat()

    // Start heartbeat polling
    heartbeatIntervalRef.current = setInterval(
      () => {
        sendHeartbeat()
      },
      heartbeatIntervalSeconds * 1000,
    )

    // Cleanup on unmount
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, expirationTime, heartbeatIntervalSeconds])

  /**
   * Handle expiration callback
   */
  useEffect(() => {
    if (isExpired && onExpirationRef.current) {
      onExpirationRef.current()
    }
  }, [isExpired])

  return {
    sendHeartbeat,
  }
}
