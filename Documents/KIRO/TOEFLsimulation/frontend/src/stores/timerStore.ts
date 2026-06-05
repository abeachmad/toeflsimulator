import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createStoreStorage } from './persist'

type TimerSyncPayload = {
  serverTime: number
  expirationTime: number
  driftThresholdMs?: number
}

type TimerStoreState = {
  remainingTime: number
  expirationTime: number | null
  driftDetected: boolean
  serverTime: number | null
  isExpired: boolean
  sessionId: string | null
  countdownIntervalId: number | null
  heartbeatIntervalId: number | null
}

type TimerStoreActions = {
  initializeTimer: (durationMinutes: number, now?: number) => void
  updateRemainingTime: (remainingTime: number) => void
  syncWithServer: (payload: TimerSyncPayload) => void
  tick: (now?: number) => void
  handleExpiration: () => void
  startCountdown: () => void
  stopCountdown: () => void
  startHeartbeat: (sessionId: string) => void
  stopHeartbeat: () => void
  reset: () => void
}

export type TimerStore = TimerStoreState & TimerStoreActions

export const TIMER_STORE_VERSION = 1
export const TIMER_STORE_NAME = 'toefl-timer-store'

const createInitialState = (): TimerStoreState => ({
  remainingTime: 0,
  expirationTime: null,
  driftDetected: false,
  serverTime: null,
  isExpired: false,
  sessionId: null,
  countdownIntervalId: null,
  heartbeatIntervalId: null,
})

/**
 * Heartbeat polling interval (30 seconds)
 */
const HEARTBEAT_INTERVAL_MS = 30_000

/**
 * Countdown tick interval (1 second)
 */
const COUNTDOWN_INTERVAL_MS = 1_000

/**
 * Send heartbeat to server to sync time
 */
async function sendHeartbeat(sessionId: string): Promise<void> {
  try {
    const clientTimestamp = Date.now()
    
    const response = await fetch(`/api/timers/${sessionId}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clientTimestamp }),
    })

    if (!response.ok) {
      console.error('Heartbeat request failed:', response.status, response.statusText)
      return
    }

    const result = await response.json()
    const heartbeatData = result.data

    // Sync with server response
    useTimerStore.getState().syncWithServer({
      serverTime: heartbeatData.serverTime,
      expirationTime: heartbeatData.expirationTime,
    })
  } catch (error) {
    console.error('Heartbeat error:', error)
    // Continue with local timer on network error (Requirement 19.3)
  }
}

export const useTimerStore = create<TimerStore>()(
  persist(
    (set, get) => ({
      ...createInitialState(),
      initializeTimer: (durationMinutes, now = Date.now()) => {
        const expirationTime = now + durationMinutes * 60_000
        set({
          expirationTime,
          remainingTime: Math.max(0, Math.ceil((expirationTime - now) / 1000)),
          serverTime: now,
          driftDetected: false,
          isExpired: false,
        })
      },
      updateRemainingTime: (remainingTime) => {
        set({
          remainingTime: Math.max(0, remainingTime),
          isExpired: remainingTime <= 0,
        })
      },
      syncWithServer: ({
        serverTime,
        expirationTime,
        driftThresholdMs = 5_000,
      }) => {
        const localTime = Date.now()
        const remainingTime = Math.max(
          0,
          Math.ceil((expirationTime - serverTime) / 1000),
        )

        set({
          serverTime,
          expirationTime,
          remainingTime,
          driftDetected: Math.abs(localTime - serverTime) > driftThresholdMs,
          isExpired: remainingTime <= 0,
        })
      },
      tick: (now = Date.now()) => {
        const { expirationTime } = get()

        if (!expirationTime) {
          return
        }

        const remainingTime = Math.max(
          0,
          Math.ceil((expirationTime - now) / 1000),
        )

        if (remainingTime <= 0) {
          get().handleExpiration()
          return
        }

        set({ remainingTime, isExpired: false })
      },
      handleExpiration: () => {
        // Stop countdown and heartbeat when timer expires
        get().stopCountdown()
        get().stopHeartbeat()
        
        set({
          remainingTime: 0,
          isExpired: true,
        })
      },
      startCountdown: () => {
        // Clear any existing countdown interval
        const { countdownIntervalId } = get()
        if (countdownIntervalId !== null) {
          clearInterval(countdownIntervalId)
        }

        // Start new countdown interval (tick every second)
        // Use bare setInterval (not window.setInterval) so vi.useFakeTimers() wraps it
        const intervalId = setInterval(() => {
          get().tick()
        }, COUNTDOWN_INTERVAL_MS) as unknown as number

        set({ countdownIntervalId: intervalId })
      },
      stopCountdown: () => {
        const { countdownIntervalId } = get()
        if (countdownIntervalId !== null) {
          clearInterval(countdownIntervalId)
          set({ countdownIntervalId: null })
        }
      },
      startHeartbeat: (sessionId: string) => {
        // Clear any existing heartbeat interval
        const { heartbeatIntervalId } = get()
        if (heartbeatIntervalId !== null) {
          clearInterval(heartbeatIntervalId)
        }

        // Store sessionId
        set({ sessionId })

        // Send initial heartbeat immediately
        sendHeartbeat(sessionId)

        // Start heartbeat interval (every 30 seconds)
        // Use bare setInterval (not window.setInterval) so vi.useFakeTimers() wraps it
        const intervalId = setInterval(() => {
          sendHeartbeat(sessionId)
        }, HEARTBEAT_INTERVAL_MS) as unknown as number

        set({ heartbeatIntervalId: intervalId })
      },
      stopHeartbeat: () => {
        const { heartbeatIntervalId } = get()
        if (heartbeatIntervalId !== null) {
          clearInterval(heartbeatIntervalId)
          set({ heartbeatIntervalId: null, sessionId: null })
        }
      },
      reset: () => {
        // Clean up intervals before reset
        get().stopCountdown()
        get().stopHeartbeat()
        
        set(createInitialState())
      },
    }),
    {
      name: TIMER_STORE_NAME,
      version: TIMER_STORE_VERSION,
      storage: createStoreStorage(),
      // Don't persist interval IDs (they're runtime-only)
      partialize: (state) => ({
        remainingTime: state.remainingTime,
        expirationTime: state.expirationTime,
        driftDetected: state.driftDetected,
        serverTime: state.serverTime,
        isExpired: state.isExpired,
        sessionId: state.sessionId,
      }),
    },
  ),
)

/**
 * Reset the timer store for testing.
 * Saves localStorage state before reset so rehydration tests can restore it.
 */
export const resetTimerStore = () => {
  const saved = localStorage.getItem(TIMER_STORE_NAME)
  useTimerStore.getState().reset()
  // Restore pre-reset localStorage so persist.rehydrate() tests work
  if (saved !== null) {
    localStorage.setItem(TIMER_STORE_NAME, saved)
  }
}