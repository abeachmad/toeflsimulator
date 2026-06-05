/**
 * Unit tests for timerStore
 * Tests Task 13.2 implementation: Timer store with server sync
 * 
 * Requirements: 2.2, 2.3, 19.3
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useTimerStore, resetTimerStore, TIMER_STORE_NAME } from './timerStore'

// Mock fetch for heartbeat tests
global.fetch = vi.fn()

describe('timerStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetTimerStore()
    vi.clearAllTimers()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('State Management', () => {
    it('has correct initial state', () => {
      const state = useTimerStore.getState()

      expect(state.remainingTime).toBe(0)
      expect(state.expirationTime).toBeNull()
      expect(state.driftDetected).toBe(false)
      expect(state.serverTime).toBeNull()
      expect(state.isExpired).toBe(false)
      expect(state.sessionId).toBeNull()
      expect(state.countdownIntervalId).toBeNull()
      expect(state.heartbeatIntervalId).toBeNull()
    })

    it('defines all required state properties (Requirement 2.2)', () => {
      const state = useTimerStore.getState()

      expect(state).toHaveProperty('remainingTime')
      expect(state).toHaveProperty('expirationTime')
      expect(state).toHaveProperty('driftDetected')
      expect(state).toHaveProperty('serverTime')
      expect(state).toHaveProperty('isExpired')
      expect(state).toHaveProperty('sessionId')
      expect(state).toHaveProperty('countdownIntervalId')
      expect(state).toHaveProperty('heartbeatIntervalId')
    })
  })

  describe('initializeTimer Action', () => {
    it('initializes timer with correct duration', () => {
      const now = 1000000
      vi.setSystemTime(now)

      useTimerStore.getState().initializeTimer(30, now)

      const state = useTimerStore.getState()
      expect(state.remainingTime).toBe(1800) // 30 minutes = 1800 seconds
      expect(state.expirationTime).toBe(now + 30 * 60_000)
      expect(state.serverTime).toBe(now)
      expect(state.driftDetected).toBe(false)
      expect(state.isExpired).toBe(false)
    })

    it('calculates expiration time correctly', () => {
      const now = 5000000
      const duration = 45 // minutes

      useTimerStore.getState().initializeTimer(duration, now)

      const state = useTimerStore.getState()
      const expectedExpiration = now + duration * 60_000
      expect(state.expirationTime).toBe(expectedExpiration)
    })

    it('uses Date.now() when no timestamp provided', () => {
      const now = 2000000
      vi.setSystemTime(now)

      useTimerStore.getState().initializeTimer(15)

      const state = useTimerStore.getState()
      expect(state.expirationTime).toBe(now + 15 * 60_000)
      expect(state.serverTime).toBe(now)
    })
  })

  describe('updateRemainingTime Action', () => {
    it('updates remaining time correctly', () => {
      useTimerStore.getState().updateRemainingTime(600)

      const state = useTimerStore.getState()
      expect(state.remainingTime).toBe(600)
    })

    it('never sets negative remaining time', () => {
      useTimerStore.getState().updateRemainingTime(-50)

      const state = useTimerStore.getState()
      expect(state.remainingTime).toBe(0)
    })

    it('marks timer as expired when remaining time is zero', () => {
      useTimerStore.getState().updateRemainingTime(0)

      const state = useTimerStore.getState()
      expect(state.isExpired).toBe(true)
    })

    it('marks timer as expired when remaining time is negative', () => {
      useTimerStore.getState().updateRemainingTime(-100)

      const state = useTimerStore.getState()
      expect(state.isExpired).toBe(true)
      expect(state.remainingTime).toBe(0)
    })
  })

  describe('syncWithServer Action (Requirement 2.3)', () => {
    it('syncs with server time and calculates remaining time', () => {
      const serverTime = 1000000
      const expirationTime = 1060000 // 60 seconds from serverTime

      useTimerStore.getState().syncWithServer({
        serverTime,
        expirationTime,
      })

      const state = useTimerStore.getState()
      expect(state.serverTime).toBe(serverTime)
      expect(state.expirationTime).toBe(expirationTime)
      expect(state.remainingTime).toBe(60) // 60 seconds
    })

    it('detects drift when client time differs from server time', () => {
      const serverTime = 1000000
      const localTime = 1010000 // 10 seconds ahead
      const expirationTime = 1060000

      vi.setSystemTime(localTime)

      useTimerStore.getState().syncWithServer({
        serverTime,
        expirationTime,
        driftThresholdMs: 5000, // 5 second threshold
      })

      const state = useTimerStore.getState()
      expect(state.driftDetected).toBe(true)
    })

    it('does not detect drift when difference is below threshold', () => {
      const serverTime = 1000000
      const localTime = 1002000 // 2 seconds ahead
      const expirationTime = 1060000

      vi.setSystemTime(localTime)

      useTimerStore.getState().syncWithServer({
        serverTime,
        expirationTime,
        driftThresholdMs: 5000, // 5 second threshold
      })

      const state = useTimerStore.getState()
      expect(state.driftDetected).toBe(false)
    })

    it('uses default drift threshold of 5 seconds', () => {
      const serverTime = 1000000
      const localTime = 1008000 // 8 seconds ahead (exceeds default 5s threshold)
      const expirationTime = 1060000

      vi.setSystemTime(localTime)

      useTimerStore.getState().syncWithServer({
        serverTime,
        expirationTime,
      })

      const state = useTimerStore.getState()
      expect(state.driftDetected).toBe(true)
    })

    it('marks as expired if server time indicates expiration', () => {
      const serverTime = 1060000
      const expirationTime = 1060000 // Already expired

      useTimerStore.getState().syncWithServer({
        serverTime,
        expirationTime,
      })

      const state = useTimerStore.getState()
      expect(state.isExpired).toBe(true)
      expect(state.remainingTime).toBe(0)
    })

    it('handles past expiration time gracefully', () => {
      const serverTime = 1070000
      const expirationTime = 1060000 // Expired 10 seconds ago

      useTimerStore.getState().syncWithServer({
        serverTime,
        expirationTime,
      })

      const state = useTimerStore.getState()
      expect(state.remainingTime).toBe(0)
      expect(state.isExpired).toBe(true)
    })
  })

  describe('tick Action (Countdown Logic)', () => {
    it('decrements remaining time by 1 second', () => {
      const now = 1000000
      const expirationTime = now + 60_000 // 60 seconds

      vi.setSystemTime(now)
      useTimerStore.getState().initializeTimer(1, now)

      // Advance 1 second
      vi.setSystemTime(now + 1000)
      useTimerStore.getState().tick(now + 1000)

      const state = useTimerStore.getState()
      expect(state.remainingTime).toBe(59)
    })

    it('does not go below zero remaining time', () => {
      const now = 1000000

      vi.setSystemTime(now)
      useTimerStore.getState().initializeTimer(1, now)
      // Override both remainingTime AND expirationTime so tick() calculates correctly
      useTimerStore.setState({ remainingTime: 1, expirationTime: now + 1000 })

      // Advance past expiration
      vi.setSystemTime(now + 3000)
      useTimerStore.getState().tick(now + 3000)

      const state = useTimerStore.getState()
      expect(state.remainingTime).toBe(0)
    })

    it('calls handleExpiration when time reaches zero', () => {
      const now = 1000000
      const handleExpirationSpy = vi.spyOn(
        useTimerStore.getState(),
        'handleExpiration',
      )

      vi.setSystemTime(now)
      useTimerStore.getState().initializeTimer(1, now)
      useTimerStore.setState({ remainingTime: 1 })

      // Advance to expiration
      vi.setSystemTime(now + 60_000)
      useTimerStore.getState().tick(now + 60_000)

      expect(handleExpirationSpy).toHaveBeenCalled()
    })

    it('does nothing if no expiration time is set', () => {
      const initialState = useTimerStore.getState()

      useTimerStore.getState().tick()

      const state = useTimerStore.getState()
      expect(state.remainingTime).toBe(initialState.remainingTime)
    })

    it('calculates remaining time from current time and expiration', () => {
      const now = 1000000
      const expirationTime = now + 120_000 // 120 seconds

      vi.setSystemTime(now)
      useTimerStore.getState().initializeTimer(2, now)

      // Advance 30 seconds
      vi.setSystemTime(now + 30_000)
      useTimerStore.getState().tick(now + 30_000)

      const state = useTimerStore.getState()
      expect(state.remainingTime).toBe(90) // 120 - 30 = 90
    })
  })

  describe('handleExpiration Action', () => {
    it('sets remainingTime to 0', () => {
      useTimerStore.getState().initializeTimer(1)
      useTimerStore.setState({ remainingTime: 30 })

      useTimerStore.getState().handleExpiration()

      const state = useTimerStore.getState()
      expect(state.remainingTime).toBe(0)
    })

    it('sets isExpired to true', () => {
      useTimerStore.getState().initializeTimer(1)

      useTimerStore.getState().handleExpiration()

      const state = useTimerStore.getState()
      expect(state.isExpired).toBe(true)
    })

    it('stops countdown and heartbeat intervals', () => {
      const stopCountdownSpy = vi.spyOn(useTimerStore.getState(), 'stopCountdown')
      const stopHeartbeatSpy = vi.spyOn(useTimerStore.getState(), 'stopHeartbeat')

      useTimerStore.getState().handleExpiration()

      expect(stopCountdownSpy).toHaveBeenCalled()
      expect(stopHeartbeatSpy).toHaveBeenCalled()
    })
  })

  describe('startCountdown Action', () => {
    it('starts countdown interval', () => {
      useTimerStore.getState().startCountdown()

      const state = useTimerStore.getState()
      // Interval ID is truthy (number in browser, Timeout object in some envs)
      expect(state.countdownIntervalId).not.toBeNull()
      expect(state.countdownIntervalId).toBeTruthy()
    })

    it('clears existing interval before starting new one', () => {
      // Start first countdown
      useTimerStore.getState().startCountdown()
      const firstIntervalId = useTimerStore.getState().countdownIntervalId

      // Start second countdown
      useTimerStore.getState().startCountdown()
      const secondIntervalId = useTimerStore.getState().countdownIntervalId

      expect(secondIntervalId).not.toBe(firstIntervalId)
      expect(secondIntervalId).not.toBeNull()
    })

    it('calls tick every second', () => {
      const now = 1000000
      vi.setSystemTime(now)
      useTimerStore.getState().initializeTimer(1, now)

      const tickSpy = vi.spyOn(useTimerStore.getState(), 'tick')
      useTimerStore.getState().startCountdown()

      // Fast-forward 1 second
      vi.advanceTimersByTime(1000)
      expect(tickSpy).toHaveBeenCalledTimes(1)

      // Fast-forward another 2 seconds
      vi.advanceTimersByTime(2000)
      expect(tickSpy).toHaveBeenCalledTimes(3)
    })
  })

  describe('stopCountdown Action', () => {
    it('clears countdown interval', () => {
      useTimerStore.getState().startCountdown()
      expect(useTimerStore.getState().countdownIntervalId).not.toBeNull()

      useTimerStore.getState().stopCountdown()

      const state = useTimerStore.getState()
      expect(state.countdownIntervalId).toBeNull()
    })

    it('does nothing if no interval is active', () => {
      expect(() => {
        useTimerStore.getState().stopCountdown()
      }).not.toThrow()
    })
  })

  describe('startHeartbeat Action', () => {
    it('starts heartbeat interval with sessionId', () => {
      const sessionId = 'test-session-123'

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            serverTime: Date.now(),
            expirationTime: Date.now() + 60000,
            remainingTime: 60,
            driftDetected: false,
          },
        }),
      } as Response)

      useTimerStore.getState().startHeartbeat(sessionId)

      const state = useTimerStore.getState()
      expect(state.heartbeatIntervalId).not.toBeNull()
      expect(state.sessionId).toBe(sessionId)
    })

    it('sends initial heartbeat immediately', async () => {
      const sessionId = 'test-session-456'

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            serverTime: Date.now(),
            expirationTime: Date.now() + 60000,
            remainingTime: 60,
            driftDetected: false,
          },
        }),
      } as Response)

      useTimerStore.getState().startHeartbeat(sessionId)

      // Flush the initial heartbeat's async fetch chain (2 awaits: fetch + response.json)
      await Promise.resolve()
      await Promise.resolve()

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/timers/${sessionId}/heartbeat`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      )
    })

    it('sends heartbeat every 30 seconds', async () => {
      const sessionId = 'test-session-789'

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            serverTime: Date.now(),
            expirationTime: Date.now() + 60000,
            remainingTime: 60,
            driftDetected: false,
          },
        }),
      } as Response)

      useTimerStore.getState().startHeartbeat(sessionId)

      // Flush initial heartbeat microtask chain
      await Promise.resolve()
      await Promise.resolve()
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Fast-forward 30 seconds (fires interval once)
      vi.advanceTimersByTime(30000)
      await Promise.resolve()
      await Promise.resolve()
      expect(global.fetch).toHaveBeenCalledTimes(2)

      // Fast-forward another 30 seconds
      vi.advanceTimersByTime(30000)
      await Promise.resolve()
      await Promise.resolve()
      expect(global.fetch).toHaveBeenCalledTimes(3)
    })

    it('clears existing heartbeat before starting new one', () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            serverTime: Date.now(),
            expirationTime: Date.now() + 60000,
            remainingTime: 60,
            driftDetected: false,
          },
        }),
      } as Response)

      useTimerStore.getState().startHeartbeat('session-1')
      const firstIntervalId = useTimerStore.getState().heartbeatIntervalId

      useTimerStore.getState().startHeartbeat('session-2')
      const secondIntervalId = useTimerStore.getState().heartbeatIntervalId

      expect(secondIntervalId).not.toBe(firstIntervalId)
      expect(secondIntervalId).not.toBeNull()
    })
  })

  describe('stopHeartbeat Action', () => {
    it('clears heartbeat interval and sessionId', () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            serverTime: Date.now(),
            expirationTime: Date.now() + 60000,
            remainingTime: 60,
            driftDetected: false,
          },
        }),
      } as Response)

      useTimerStore.getState().startHeartbeat('test-session')
      expect(useTimerStore.getState().heartbeatIntervalId).not.toBeNull()

      useTimerStore.getState().stopHeartbeat()

      const state = useTimerStore.getState()
      expect(state.heartbeatIntervalId).toBeNull()
      expect(state.sessionId).toBeNull()
    })

    it('does nothing if no heartbeat is active', () => {
      expect(() => {
        useTimerStore.getState().stopHeartbeat()
      }).not.toThrow()
    })
  })

  describe('Heartbeat Server Sync (Requirement 2.3)', () => {
    it('syncs timer state with server response', async () => {
      const sessionId = 'sync-test-session'
      const serverTime = 1000000
      const expirationTime = 1060000

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            serverTime,
            expirationTime,
            remainingTime: 60,
            driftDetected: false,
          },
        }),
      } as Response)

      useTimerStore.getState().startHeartbeat(sessionId)

      // Flush the initial heartbeat's async fetch chain
      await Promise.resolve()
      await Promise.resolve()

      const state = useTimerStore.getState()
      expect(state.serverTime).toBe(serverTime)
      expect(state.expirationTime).toBe(expirationTime)
    })

    it('handles heartbeat network errors gracefully (Requirement 19.3)', async () => {
      const sessionId = 'error-test-session'

      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      useTimerStore.getState().startHeartbeat(sessionId)

      // Flush async chain — error is caught inside sendHeartbeat, should not propagate
      await Promise.resolve()
      await Promise.resolve()
      // No throw expected — if sendHeartbeat threw, the test itself would fail
    })

    it('handles heartbeat server errors gracefully (Requirement 19.3)', async () => {
      const sessionId = 'server-error-session'

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response)

      useTimerStore.getState().startHeartbeat(sessionId)

      // Flush async chain — non-ok response is handled gracefully inside sendHeartbeat
      await Promise.resolve()
      await Promise.resolve()
      // No throw expected
    })
  })

  describe('reset Action', () => {
    it('resets all state to initial values', () => {
      // Set up some state
      useTimerStore.getState().initializeTimer(30)
      useTimerStore.getState().syncWithServer({
        serverTime: 1000000,
        expirationTime: 1060000,
      })

      // Reset
      useTimerStore.getState().reset()

      const state = useTimerStore.getState()
      expect(state.remainingTime).toBe(0)
      expect(state.expirationTime).toBeNull()
      expect(state.driftDetected).toBe(false)
      expect(state.serverTime).toBeNull()
      expect(state.isExpired).toBe(false)
      expect(state.sessionId).toBeNull()
      expect(state.countdownIntervalId).toBeNull()
      expect(state.heartbeatIntervalId).toBeNull()
    })

    it('cleans up countdown interval on reset', () => {
      useTimerStore.getState().startCountdown()
      expect(useTimerStore.getState().countdownIntervalId).not.toBeNull()

      useTimerStore.getState().reset()

      expect(useTimerStore.getState().countdownIntervalId).toBeNull()
    })

    it('cleans up heartbeat interval on reset', () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            serverTime: Date.now(),
            expirationTime: Date.now() + 60000,
            remainingTime: 60,
            driftDetected: false,
          },
        }),
      } as Response)

      useTimerStore.getState().startHeartbeat('test-session')
      expect(useTimerStore.getState().heartbeatIntervalId).not.toBeNull()

      useTimerStore.getState().reset()

      expect(useTimerStore.getState().heartbeatIntervalId).toBeNull()
    })
  })

  describe('Persistence (Requirement 18.2, 18.3)', () => {
    it('persists timer state to localStorage', async () => {
      useTimerStore.getState().initializeTimer(45)
      useTimerStore.getState().syncWithServer({
        serverTime: 2000000,
        expirationTime: 2060000,
      })

      // Zustand persist writes synchronously — no need to wait with fake timers
      await Promise.resolve()

      const stored = localStorage.getItem(TIMER_STORE_NAME)
      expect(stored).toBeTruthy()
      expect(stored).toContain('expirationTime')
      expect(stored).toContain('serverTime')
    })

    it('does not persist interval IDs', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            serverTime: Date.now(),
            expirationTime: Date.now() + 60000,
            remainingTime: 60,
            driftDetected: false,
          },
        }),
      } as Response)

      useTimerStore.getState().startCountdown()
      useTimerStore.getState().startHeartbeat('test-session')

      // Zustand persist writes synchronously — flush microtasks only
      await Promise.resolve()

      const stored = localStorage.getItem(TIMER_STORE_NAME)
      expect(stored).toBeTruthy()
      
      // Parse and check that interval IDs are not persisted
      const parsed = JSON.parse(stored!)
      expect(parsed.state.countdownIntervalId).toBeUndefined()
      expect(parsed.state.heartbeatIntervalId).toBeUndefined()
    })

    it('restores timer state from localStorage', async () => {
      useTimerStore.getState().initializeTimer(30, 1000000)
      useTimerStore.setState({ remainingTime: 456 })

      // Reset and rehydrate
      resetTimerStore()
      await useTimerStore.persist.rehydrate()

      const state = useTimerStore.getState()
      expect(state.remainingTime).toBe(456)
    })

    it('handles empty localStorage gracefully', async () => {
      localStorage.clear()

      await useTimerStore.persist.rehydrate()

      const state = useTimerStore.getState()
      expect(state.remainingTime).toBe(0)
      expect(state.expirationTime).toBeNull()
    })
  })

  describe('Integration: Timer Countdown Scenario', () => {
    it('simulates a complete timer countdown sequence', () => {
      const startTime = 1000000
      const duration = 1 // 1 minute

      vi.setSystemTime(startTime)
      useTimerStore.getState().initializeTimer(duration, startTime)

      let state = useTimerStore.getState()
      expect(state.remainingTime).toBe(60)

      // Tick after 10 seconds
      vi.setSystemTime(startTime + 10_000)
      useTimerStore.getState().tick(startTime + 10_000)

      state = useTimerStore.getState()
      expect(state.remainingTime).toBe(50)
      expect(state.isExpired).toBe(false)

      // Tick after 30 more seconds (40 total)
      vi.setSystemTime(startTime + 40_000)
      useTimerStore.getState().tick(startTime + 40_000)

      state = useTimerStore.getState()
      expect(state.remainingTime).toBe(20)
      expect(state.isExpired).toBe(false)

      // Tick to expiration (60 seconds total)
      vi.setSystemTime(startTime + 60_000)
      useTimerStore.getState().tick(startTime + 60_000)

      state = useTimerStore.getState()
      expect(state.remainingTime).toBe(0)
      expect(state.isExpired).toBe(true)
    })

    it('simulates heartbeat sync with server during countdown (Requirement 2.3)', async () => {
      const startTime = 1000000
      const duration = 2 // 2 minutes

      vi.setSystemTime(startTime)
      useTimerStore.getState().initializeTimer(duration, startTime)

      // After 30 seconds, simulate heartbeat
      vi.setSystemTime(startTime + 30_000)
      useTimerStore.getState().tick(startTime + 30_000)

      let state = useTimerStore.getState()
      expect(state.remainingTime).toBe(90) // 2 min - 30 sec

      // Server sync shows slight drift
      const serverTime = startTime + 32_000 // Server is 2 seconds ahead
      const serverExpiration = startTime + 120_000

      useTimerStore.getState().syncWithServer({
        serverTime,
        expirationTime: serverExpiration,
      })

      state = useTimerStore.getState()
      // Remaining time should be corrected based on server time
      expect(state.remainingTime).toBe(88) // 120 - 32 = 88
      expect(state.driftDetected).toBe(false) // 2 seconds is below 5 second threshold
    })

    it('simulates automatic countdown with startCountdown', () => {
      const startTime = 1000000
      const duration = 1 // 1 minute

      vi.setSystemTime(startTime)
      useTimerStore.getState().initializeTimer(duration, startTime)
      useTimerStore.getState().startCountdown()

      let state = useTimerStore.getState()
      expect(state.remainingTime).toBe(60)

      // Fast-forward 10 seconds (advances clock from startTime to startTime+10000)
      vi.advanceTimersByTime(10_000)

      state = useTimerStore.getState()
      expect(state.remainingTime).toBe(50)
    })

    it('simulates complete workflow with countdown and heartbeat', async () => {
      const sessionId = 'integration-test-session'
      const startTime = 1000000
      const duration = 2 // 2 minutes

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            serverTime: Date.now(),
            expirationTime: startTime + 120_000,
            remainingTime: Math.ceil((startTime + 120_000 - Date.now()) / 1000),
            driftDetected: false,
          },
        }),
      } as Response)

      // Initialize timer
      vi.setSystemTime(startTime)
      useTimerStore.getState().initializeTimer(duration, startTime)

      // Start countdown and heartbeat
      useTimerStore.getState().startCountdown()
      useTimerStore.getState().startHeartbeat(sessionId)

      // Verify initial state
      let state = useTimerStore.getState()
      expect(state.remainingTime).toBe(120)
      expect(state.countdownIntervalId).not.toBeNull()
      expect(state.heartbeatIntervalId).not.toBeNull()

      // Fast-forward 30 seconds (clock: startTime → startTime+30000)
      vi.advanceTimersByTime(30_000)
      // Flush async heartbeat call
      await Promise.resolve()
      await Promise.resolve()

      state = useTimerStore.getState()
      expect(state.remainingTime).toBe(90)
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/timers/${sessionId}/heartbeat`,
        expect.any(Object)
      )

      // Stop countdown and heartbeat
      useTimerStore.getState().stopCountdown()
      useTimerStore.getState().stopHeartbeat()

      state = useTimerStore.getState()
      expect(state.countdownIntervalId).toBeNull()
      expect(state.heartbeatIntervalId).toBeNull()
    })
  })

  describe('Error Handling (Requirement 19.3)', () => {
    it('handles missing expirationTime in tick gracefully', () => {
      // Don't initialize timer, just call tick
      expect(() => {
        useTimerStore.getState().tick()
      }).not.toThrow()

      const state = useTimerStore.getState()
      expect(state.remainingTime).toBe(0)
    })

    it('clamps negative remaining time from server to 0', () => {
      const serverTime = 2000000
      const expirationTime = 1990000 // Already expired

      useTimerStore.getState().syncWithServer({
        serverTime,
        expirationTime,
      })

      const state = useTimerStore.getState()
      expect(state.remainingTime).toBe(0)
      expect(state.isExpired).toBe(true)
    })
  })
})
