/**
 * Unit Tests for TimerService
 * 
 * Tests server-side timer management, validation, and drift detection
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool } from 'pg';
import { EventEmitter } from 'events';
import { TimerService } from './TimerService.js';
import * as fc from 'fast-check';

// Mock pg Pool
const mockQuery = vi.fn();
const mockPool = {
  query: mockQuery,
} as unknown as Pool;

describe('TimerService', () => {
  let timerService: TimerService;

  beforeEach(() => {
    timerService = new TimerService(mockPool);
    mockQuery.mockReset();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initializeTimer', () => {
    it('should initialize timer with correct start and expiration times', async () => {
      // **Validates: Requirement 2.1**
      const sessionId = 'test-session-1';
      const durationMinutes = 30;
      const startTime = new Date('2024-01-01T10:00:00Z');

      vi.setSystemTime(startTime);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await timerService.initializeTimer(sessionId, durationMinutes);

      expect(result.sessionId).toBe(sessionId);
      expect(result.startTime).toEqual(startTime);
      expect(result.expirationTime).toEqual(new Date('2024-01-01T10:30:00Z'));
      expect(result.remainingTime).toBe(1800); // 30 minutes in seconds

      // Verify database update was called
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE exam_sessions'),
        [startTime, new Date('2024-01-01T10:30:00Z'), sessionId]
      );
    });

    it('should persist start_time and expiration_time to database', async () => {
      // **Validates: Requirement 2.1**
      const sessionId = 'test-session-2';
      const durationMinutes = 90;

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await timerService.initializeTimer(sessionId, durationMinutes);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE exam_sessions'),
        expect.arrayContaining([expect.any(Date), expect.any(Date), sessionId])
      );
    });

    it('should setup auto-submit setTimeout with correct duration', async () => {
      // **Validates: Requirement 2.4**
      const sessionId = 'test-session-3';
      const durationMinutes = 5;
      const autoSubmitSpy = vi.spyOn(timerService, 'autoSubmit').mockResolvedValue();

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await timerService.initializeTimer(sessionId, durationMinutes);

      // Fast-forward time by 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(autoSubmitSpy).toHaveBeenCalledWith(sessionId);
      autoSubmitSpy.mockRestore();
    });

    it('should store timer in internal map', async () => {
      const sessionId = 'test-session-4';
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await timerService.initializeTimer(sessionId, 30);

      expect(timerService.getActiveTimers()).toContain(sessionId);
    });
  });

  describe('getRemainingTime', () => {
    it('should return remaining time based on server-side calculation', async () => {
      // **Validates: Requirement 2.3**
      const sessionId = 'test-session-5';
      const now = new Date('2024-01-01T10:15:00Z');
      const expirationTime = new Date('2024-01-01T10:30:00Z');

      vi.setSystemTime(now);
      mockQuery.mockResolvedValueOnce({
        rows: [{ expiration_time: expirationTime }]
      });

      const remainingTime = await timerService.getRemainingTime(sessionId);

      expect(remainingTime).toBe(900); // 15 minutes = 900 seconds
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT expiration_time'),
        [sessionId]
      );
    });

    it('should return 0 when time has expired', async () => {
      // **Validates: Requirement 2.3**
      const sessionId = 'test-session-6';
      const now = new Date('2024-01-01T10:35:00Z');
      const expirationTime = new Date('2024-01-01T10:30:00Z');

      vi.setSystemTime(now);
      mockQuery.mockResolvedValueOnce({
        rows: [{ expiration_time: expirationTime }]
      });

      const remainingTime = await timerService.getRemainingTime(sessionId);

      expect(remainingTime).toBe(0);
    });

    it('should throw error if session not found', async () => {
      const sessionId = 'non-existent-session';
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(timerService.getRemainingTime(sessionId))
        .rejects.toThrow('Session non-existent-session not found');
    });

    it('should calculate remaining time accurately for various durations', async () => {
      // **Validates: Requirement 2.3**
      const testCases = [
        { now: '2024-01-01T10:00:00Z', exp: '2024-01-01T10:01:00Z', expected: 60 },
        { now: '2024-01-01T10:00:00Z', exp: '2024-01-01T10:00:30Z', expected: 30 },
        { now: '2024-01-01T10:00:00Z', exp: '2024-01-01T11:30:00Z', expected: 5400 },
      ];

      for (const testCase of testCases) {
        vi.setSystemTime(new Date(testCase.now));
        mockQuery.mockResolvedValueOnce({
          rows: [{ expiration_time: new Date(testCase.exp) }]
        });

        const remainingTime = await timerService.getRemainingTime('session');
        expect(remainingTime).toBe(testCase.expected);
      }
    });
  });

  describe('validateSubmission', () => {
    it('should accept submission before expiration time', async () => {
      // **Validates: Requirement 2.5**
      const sessionId = 'test-session-7';
      const expirationTime = new Date('2024-01-01T10:30:00Z');
      const submissionTimestamp = new Date('2024-01-01T10:25:00Z').getTime();

      mockQuery.mockResolvedValueOnce({
        rows: [{ expiration_time: expirationTime }]
      });

      const isValid = await timerService.validateSubmission(sessionId, submissionTimestamp);

      expect(isValid).toBe(true);
    });

    it('should accept submission exactly at expiration time', async () => {
      // **Validates: Requirement 2.5**
      const sessionId = 'test-session-8';
      const expirationTime = new Date('2024-01-01T10:30:00Z');
      const submissionTimestamp = new Date('2024-01-01T10:30:00Z').getTime();

      mockQuery.mockResolvedValueOnce({
        rows: [{ expiration_time: expirationTime }]
      });

      const isValid = await timerService.validateSubmission(sessionId, submissionTimestamp);

      expect(isValid).toBe(true);
    });

    it('should reject submission after expiration time', async () => {
      // **Validates: Requirement 2.6**
      const sessionId = 'test-session-9';
      const expirationTime = new Date('2024-01-01T10:30:00Z');
      const submissionTimestamp = new Date('2024-01-01T10:30:01Z').getTime();

      mockQuery.mockResolvedValueOnce({
        rows: [{ expiration_time: expirationTime }]
      });

      const isValid = await timerService.validateSubmission(sessionId, submissionTimestamp);

      expect(isValid).toBe(false);
    });

    it('should reject submission if session not found', async () => {
      const sessionId = 'non-existent-session';
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const isValid = await timerService.validateSubmission(sessionId, Date.now());

      expect(isValid).toBe(false);
    });

    it('should validate submissions at boundary conditions', async () => {
      // **Validates: Requirements 2.5, 2.6**
      const expirationTime = new Date('2024-01-01T10:30:00.000Z');
      
      const testCases = [
        { offset: -1000, expected: true, desc: '1 second before' },
        { offset: -1, expected: true, desc: '1 ms before' },
        { offset: 0, expected: true, desc: 'exactly at expiration' },
        { offset: 1, expected: false, desc: '1 ms after' },
        { offset: 1000, expected: false, desc: '1 second after' },
      ];

      for (const testCase of testCases) {
        mockQuery.mockResolvedValueOnce({
          rows: [{ expiration_time: expirationTime }]
        });

        const submissionTimestamp = expirationTime.getTime() + testCase.offset;
        const isValid = await timerService.validateSubmission('session', submissionTimestamp);

        expect(isValid).toBe(testCase.expected);
      }
    });
  });

  describe('autoSubmit', () => {
    it('should update session status to expired', async () => {
      // **Validates: Requirement 2.4**
      const sessionId = 'test-session-10';
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await timerService.autoSubmit(sessionId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(`SET status = 'expired'`),
        [sessionId]
      );
    });

    it('should emit timer-expired event', async () => {
      // **Validates: Requirement 2.4**
      const sessionId = 'test-session-11';
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const eventPromise = new Promise((resolve) => {
        timerService.once('timer-expired', (data) => {
          resolve(data);
        });
      });

      await timerService.autoSubmit(sessionId);

      const eventData = await eventPromise;
      expect(eventData).toEqual({ sessionId });
    });

    it('should clean up timer from internal map', async () => {
      const sessionId = 'test-session-12';
      mockQuery.mockResolvedValueOnce({ rows: [] }); // initializeTimer
      mockQuery.mockResolvedValueOnce({ rows: [] }); // autoSubmit

      await timerService.initializeTimer(sessionId, 30);
      expect(timerService.getActiveTimers()).toContain(sessionId);

      await timerService.autoSubmit(sessionId);
      expect(timerService.getActiveTimers()).not.toContain(sessionId);
    });

    it('should throw error if database update fails', async () => {
      const sessionId = 'test-session-13';
      const dbError = new Error('Database connection lost');
      mockQuery.mockRejectedValueOnce(dbError);

      await expect(timerService.autoSubmit(sessionId))
        .rejects.toThrow('Database connection lost');
    });
  });

  describe('heartbeat', () => {
    it('should return server time and expiration time', async () => {
      // **Validates: Requirement 2.3** (implicit)
      const sessionId = 'test-session-14';
      const serverTime = new Date('2024-01-01T10:15:00Z');
      const expirationTime = new Date('2024-01-01T10:30:00Z');

      vi.setSystemTime(serverTime);
      mockQuery.mockResolvedValueOnce({
        rows: [{ expiration_time: expirationTime }]
      }); // getRemainingTime
      mockQuery.mockResolvedValueOnce({
        rows: [{ expiration_time: expirationTime }]
      }); // heartbeat

      const response = await timerService.heartbeat(sessionId, serverTime.getTime());

      expect(response.serverTime).toBe(serverTime.getTime());
      expect(response.expirationTime).toBe(expirationTime.getTime());
      expect(response.remainingTime).toBe(900); // 15 minutes
    });

    it('should detect drift when client time differs by more than 5 seconds', async () => {
      // **Validates: Requirement 2.3** (prevents client-side manipulation)
      const sessionId = 'test-session-15';
      const serverTime = new Date('2024-01-01T10:15:00Z');
      const expirationTime = new Date('2024-01-01T10:30:00Z');
      const manipulatedClientTime = new Date('2024-01-01T10:14:50Z').getTime(); // 10 seconds behind

      vi.setSystemTime(serverTime);
      mockQuery.mockResolvedValueOnce({
        rows: [{ expiration_time: expirationTime }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ expiration_time: expirationTime }]
      });

      const response = await timerService.heartbeat(sessionId, manipulatedClientTime);

      expect(response.driftDetected).toBe(true);
      expect(response.driftAmount).toBeGreaterThan(5);
    });

    it('should not detect drift when client time is within 5 seconds', async () => {
      const sessionId = 'test-session-16';
      const serverTime = new Date('2024-01-01T10:15:00Z');
      const expirationTime = new Date('2024-01-01T10:30:00Z');
      const clientTime = new Date('2024-01-01T10:15:02Z').getTime(); // 2 seconds ahead

      vi.setSystemTime(serverTime);
      mockQuery.mockResolvedValueOnce({
        rows: [{ expiration_time: expirationTime }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ expiration_time: expirationTime }]
      });

      const response = await timerService.heartbeat(sessionId, clientTime);

      expect(response.driftDetected).toBe(false);
      expect(response.driftAmount).toBeUndefined();
    });

    it('should throw error if session not found', async () => {
      const sessionId = 'non-existent-session';
      mockQuery.mockResolvedValueOnce({ rows: [] }); // getRemainingTime will throw

      await expect(timerService.heartbeat(sessionId, Date.now()))
        .rejects.toThrow('Session non-existent-session not found');
    });

    it('should detect exactly 5 seconds drift at threshold boundary', async () => {
      const sessionId = 'test-session-17';
      const serverTime = new Date('2024-01-01T10:15:00Z');
      const expirationTime = new Date('2024-01-01T10:30:00Z');
      const clientTime = new Date('2024-01-01T10:14:55Z').getTime(); // exactly 5 seconds

      vi.setSystemTime(serverTime);
      mockQuery.mockResolvedValueOnce({
        rows: [{ expiration_time: expirationTime }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ expiration_time: expirationTime }]
      });

      const response = await timerService.heartbeat(sessionId, clientTime);

      // At exactly 5 seconds, should NOT detect drift (threshold is >5)
      expect(response.driftDetected).toBe(false);
    });
  });

  describe('clearTimer', () => {
    it('should clear setTimeout and remove from internal map', async () => {
      const sessionId = 'test-session-18';
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await timerService.initializeTimer(sessionId, 30);
      expect(timerService.getActiveTimers()).toContain(sessionId);

      timerService.clearTimer(sessionId);
      expect(timerService.getActiveTimers()).not.toContain(sessionId);
    });

    it('should not throw error if timer does not exist', () => {
      expect(() => timerService.clearTimer('non-existent-timer')).not.toThrow();
    });

    it('should prevent autoSubmit after clearing timer', async () => {
      const sessionId = 'test-session-19';
      const autoSubmitSpy = vi.spyOn(timerService, 'autoSubmit').mockResolvedValue();
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await timerService.initializeTimer(sessionId, 5);
      timerService.clearTimer(sessionId);

      // Fast-forward past expiration
      vi.advanceTimersByTime(6 * 60 * 1000);

      expect(autoSubmitSpy).not.toHaveBeenCalled();
      autoSubmitSpy.mockRestore();
    });
  });

  describe('getActiveTimers', () => {
    it('should return empty array when no timers are active', () => {
      expect(timerService.getActiveTimers()).toEqual([]);
    });

    it('should return all active timer session IDs', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await timerService.initializeTimer('session-1', 30);
      await timerService.initializeTimer('session-2', 30);
      await timerService.initializeTimer('session-3', 30);

      const activeTimers = timerService.getActiveTimers();
      expect(activeTimers).toHaveLength(3);
      expect(activeTimers).toContain('session-1');
      expect(activeTimers).toContain('session-2');
      expect(activeTimers).toContain('session-3');
    });
  });

  describe('EventEmitter functionality', () => {
    it('should extend EventEmitter', () => {
      expect(timerService).toBeInstanceOf(EventEmitter);
    });

    it('should allow listeners to subscribe to timer-expired event', async () => {
      const listener = vi.fn();
      timerService.on('timer-expired', listener);

      mockQuery.mockResolvedValueOnce({ rows: [] });
      await timerService.autoSubmit('test-session');

      expect(listener).toHaveBeenCalledWith({ sessionId: 'test-session' });
    });
  });

  describe('Property-Based Tests', () => {
    describe('Property 6: Timer Submission Validation', () => {
      /**
       * **Validates: Requirements 2.5, 2.6**
       * 
       * Property: For any expiration time T and submission timestamp S:
       * - If S ≤ T, then validateSubmission returns true (accepts)
       * - If S > T, then validateSubmission returns false (rejects)
       * 
       * This property ensures that timer validation is consistent across
       * all possible timestamp combinations.
       */
      it('should accept submissions before or at expiration, reject after', async () => {
        await fc.assert(
          fc.asyncProperty(
            // Generate expiration time (using reasonable range around current time)
            fc.integer({ min: Date.now(), max: Date.now() + 365 * 24 * 60 * 60 * 1000 }),
            // Generate offset from expiration time (in milliseconds)
            fc.integer({ min: -3600000, max: 3600000 }), // -1 hour to +1 hour
            async (expirationTimestamp: number, offsetMs: number) => {
              const sessionId = `prop-test-session-${Math.random()}`;
              const expirationTime = new Date(expirationTimestamp);
              const submissionTimestamp = expirationTimestamp + offsetMs;

              // Mock database response
              mockQuery.mockResolvedValueOnce({
                rows: [{ expiration_time: expirationTime }]
              });

              const isValid = await timerService.validateSubmission(
                sessionId,
                submissionTimestamp
              );

              // Property: S ≤ T accepts, S > T rejects
              if (submissionTimestamp <= expirationTimestamp) {
                // Requirement 2.5: Accept if not exceeding expiration
                expect(isValid).toBe(true);
              } else {
                // Requirement 2.6: Reject if exceeding expiration
                expect(isValid).toBe(false);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should validate boundary conditions consistently', async () => {
        /**
         * **Validates: Requirements 2.5, 2.6**
         * 
         * Property: Boundary validation at exact expiration time
         * For any expiration time T:
         * - validateSubmission(T) === true (exact match accepted)
         * - validateSubmission(T + 1) === false (1ms after rejected)
         */
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: Date.now(), max: Date.now() + 365 * 24 * 60 * 60 * 1000 }),
            async (expirationTimestamp: number) => {
              const sessionId = `boundary-test-${Math.random()}`;
              const expirationTime = new Date(expirationTimestamp);

              // Test exact expiration time (should accept)
              mockQuery.mockResolvedValueOnce({
                rows: [{ expiration_time: expirationTime }]
              });
              const exactValid = await timerService.validateSubmission(
                sessionId,
                expirationTimestamp
              );
              expect(exactValid).toBe(true);

              // Test 1ms after expiration (should reject)
              mockQuery.mockResolvedValueOnce({
                rows: [{ expiration_time: expirationTime }]
              });
              const afterValid = await timerService.validateSubmission(
                sessionId,
                expirationTimestamp + 1
              );
              expect(afterValid).toBe(false);
            }
          ),
          { numRuns: 50 }
        );
      });

      it('should handle edge cases with extreme timestamp values', async () => {
        /**
         * **Validates: Requirements 2.5, 2.6**
         * 
         * Property: Validation works correctly even with extreme timestamp differences
         */
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: Date.now(), max: Date.now() + 365 * 24 * 60 * 60 * 1000 }),
            fc.constantFrom(-86400000, -1, 0, 1, 86400000), // Special offset values
            async (expirationTimestamp: number, offsetMs: number) => {
              const sessionId = `edge-test-${Math.random()}`;
              const expirationTime = new Date(expirationTimestamp);
              const submissionTimestamp = expirationTimestamp + offsetMs;

              mockQuery.mockResolvedValueOnce({
                rows: [{ expiration_time: expirationTime }]
              });

              const isValid = await timerService.validateSubmission(
                sessionId,
                submissionTimestamp
              );

              // Verify property holds for edge cases
              expect(isValid).toBe(submissionTimestamp <= expirationTimestamp);
            }
          ),
          { numRuns: 25 }
        );
      });
    });
  });
});
