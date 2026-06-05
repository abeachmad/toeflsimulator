/**
 * Unit tests for useTimer hook
 * Tests Task 13.2 implementation: Timer countdown and heartbeat polling
 * 
 * Requirements: 2.2, 2.3, 19.3
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useTimer } from './useTimer'
import { useTimerStore, resetTimerStore } from '../stores/timerStore'

// Mock fetch globally
global.fetch = vi.fn()

describe('useTimer Hook', () => {
  beforeEach(() => {
    localStorage.clear()
    resetTimerStore()
    vi.clearAllTimers()
    vi.clearAllMocks()
    // shouldAdvanceTime: true lets waitFor's internal setTimeout fire even with fake timers
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Countdown Logic with setInterval', () => {
    it('starts countdown when expirationTime is set', () => {
      const now = 1000000
      vi.setSystemTime(now)

      // Initialize timer
      useTimerStore.getState().initializeTimer(1, now) // 1 minute

      // Render hook
      renderHook(() => useTimer({ countdownIntervalMs: 1000 }))

      // Initial state
      expect(useTimerStore.getState().remainingTime).toBe(60)

      // Advance 1 second
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Should have ticked once
      expect(useTimerStore.getState().remainingTime).toBe(59)

      // Advance another 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      // Should be at 54 seconds
      expect(useTimerStore.getState().remainingTime).toBe(54)
    })

    it('does not start countdown if no expiration time is set', () => {
      renderHook(() => useTimer({ countdownIntervalMs: 1000 }))

      // Advance time
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      // Remaining time should still be 0 (initial state)
      expect(useTimerStore.getState().remainingTime).toBe(0)
    })

    it('cleans up countdown interval on unmount', () => {
      const now = 1000000
      vi.setSystemTime(now)

      useTimerStore.getState().initializeTimer(1, now)

      const { unmount } = renderHook(() => useTimer({ countdownIntervalMs: 1000 }))

      // Advance time
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(useTimerStore.getState().remainingTime).toBe(59)

      // Unmount
      unmount()

      // Advance more time
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      // Should still be 59 (no more ticks after unmount)
      expect(useTimerStore.getState().remainingTime).toBe(59)
    })
  })

  describe('Heartbeat Polling (every 30 seconds) - Requirement 2.3', () => {
    it('sends initial heartbeat immediately when sessionId provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            serverTime: 1000000,
            expirationTime: 1060000,
            remainingTime: 60,
            driftDetected: false,
          },
        }),
      })
      global.fetch = mockFetch

      const now = 1000000
      vi.setSystemTime(now)

      useTimerStore.getState().initializeTimer(1, now)

      renderHook(() =>
        useTimer({
          sessionId: 'test-session',
          heartbeatIntervalSeconds: 30,
        }),
      )

      // Wait for initial heartbeat
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/timers/test-session/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientTimestamp: now }),
      })
    })

    it('polls heartbeat every 30 seconds', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            serverTime: 1000000,
            expirationTime: 1060000,
            remainingTime: 60,
            driftDetected: false,
          },
        }),
      })
      global.fetch = mockFetch

      const now = 1000000
      vi.setSystemTime(now)

      useTimerStore.getState().initializeTimer(1, now)

      renderHook(() =>
        useTimer({
          sessionId: 'test-session',
          heartbeatIntervalSeconds: 30,
        }),
      )

      // Wait for initial heartbeat
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Advance 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000)
      })

      // Should have sent second heartbeat
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })

      // Advance another 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000)
      })

      // Should have sent third heartbeat
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3)
      })
    })

    it('does not start heartbeat if sessionId is not provided', async () => {
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const now = 1000000
      vi.setSystemTime(now)

      useTimerStore.getState().initializeTimer(1, now)

      renderHook(() => useTimer({ heartbeatIntervalSeconds: 30 }))

      // Advance time
      act(() => {
        vi.advanceTimersByTime(60000)
      })

      // Should not have called fetch
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('syncs with server time on successful heartbeat', async () => {
      const serverTime = 1010000 // 10 seconds ahead of client (drift > 5000ms threshold)
      const expirationTime = 1065000
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            serverTime,
            expirationTime,
            remainingTime: 60,
            driftDetected: true,
            driftAmount: 10000,
          },
        }),
      })
      global.fetch = mockFetch

      const now = 1000000
      vi.setSystemTime(now)

      useTimerStore.getState().initializeTimer(1, now)

      renderHook(() =>
        useTimer({
          sessionId: 'test-session',
          heartbeatIntervalSeconds: 30,
        }),
      )

      // Wait for heartbeat to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      // Verify store was synced
      await waitFor(() => {
        const state = useTimerStore.getState()
        expect(state.serverTime).toBe(serverTime)
        expect(state.expirationTime).toBe(expirationTime)
        expect(state.driftDetected).toBe(true)
      })
    })

    it('handles 410 Gone status by calling handleExpiration', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 410,
      })
      global.fetch = mockFetch

      const now = 1000000
      vi.setSystemTime(now)

      useTimerStore.getState().initializeTimer(1, now)

      renderHook(() =>
        useTimer({
          sessionId: 'test-session',
          heartbeatIntervalSeconds: 30,
        }),
      )

      // Wait for heartbeat
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      // Verify timer was marked as expired
      await waitFor(() => {
        expect(useTimerStore.getState().isExpired).toBe(true)
      })
    })

    it('continues with local timer on network error (Requirement 19.3)', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      global.fetch = mockFetch

      const now = 1000000
      vi.setSystemTime(now)

      useTimerStore.getState().initializeTimer(1, now)

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      renderHook(() =>
        useTimer({
          sessionId: 'test-session',
          heartbeatIntervalSeconds: 30,
        }),
      )

      // Wait for heartbeat attempt
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalled()

      // Timer should continue with local countdown
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Local timer should still be working
      expect(useTimerStore.getState().remainingTime).toBe(59)

      consoleErrorSpy.mockRestore()
    })

    it('cleans up heartbeat interval on unmount', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            serverTime: 1000000,
            expirationTime: 1060000,
            remainingTime: 60,
            driftDetected: false,
          },
        }),
      })
      global.fetch = mockFetch

      const now = 1000000
      vi.setSystemTime(now)

      useTimerStore.getState().initializeTimer(1, now)

      const { unmount } = renderHook(() =>
        useTimer({
          sessionId: 'test-session',
          heartbeatIntervalSeconds: 30,
        }),
      )

      // Wait for initial heartbeat
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Unmount
      unmount()

      // Advance time
      act(() => {
        vi.advanceTimersByTime(60000)
      })

      // Should still be only 1 call (no more heartbeats after unmount)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Expiration Handling', () => {
    it('calls onExpiration callback when timer expires', async () => {
      const onExpiration = vi.fn()
      const now = 1000000
      vi.setSystemTime(now)

      useTimerStore.getState().initializeTimer(1, now)

      renderHook(() =>
        useTimer({
          onExpiration,
          countdownIntervalMs: 1000,
        }),
      )

      // Advance to expiration
      act(() => {
        vi.advanceTimersByTime(60000)
      })

      // Wait for expiration callback
      await waitFor(() => {
        expect(onExpiration).toHaveBeenCalled()
      })
    })

    it('does not call onExpiration multiple times', async () => {
      const onExpiration = vi.fn()
      const now = 1000000
      vi.setSystemTime(now)

      useTimerStore.getState().initializeTimer(1, now)

      renderHook(() =>
        useTimer({
          onExpiration,
          countdownIntervalMs: 1000,
        }),
      )

      // Advance past expiration
      act(() => {
        vi.advanceTimersByTime(120000)
      })

      // Wait a bit
      await waitFor(() => {
        expect(onExpiration).toHaveBeenCalled()
      })

      // Should only be called once
      expect(onExpiration).toHaveBeenCalledTimes(1)
    })
  })

  describe('Integration: Countdown + Heartbeat', () => {
    it('runs countdown and heartbeat simultaneously', async () => {
      const now = 1000000
      const expirationTime = now + 60000 // 1060000
      const mockFetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          data: {
            serverTime: Date.now(), // dynamic: returns current fake time at call time
            expirationTime,
            remainingTime: 60,
            driftDetected: false,
          },
        }),
      }))
      global.fetch = mockFetch

      vi.setSystemTime(now)

      useTimerStore.getState().initializeTimer(1, now)

      renderHook(() =>
        useTimer({
          sessionId: 'test-session',
          heartbeatIntervalSeconds: 10, // Shorter for testing
          countdownIntervalMs: 1000,
        }),
      )

      // Wait for initial heartbeat
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Initial state
      expect(useTimerStore.getState().remainingTime).toBe(60)

      // Advance 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      // Countdown should have ticked
      expect(useTimerStore.getState().remainingTime).toBe(55)

      // Advance 5 more seconds (10 total)
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      // Second heartbeat should have been sent
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })

      // Countdown should be at 50
      expect(useTimerStore.getState().remainingTime).toBe(50)
    })
  })
})
