/**
 * TimerService - Server-side timer management and validation
 * 
 * Implements Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 * 
 * This service provides:
 * - Server-side timer initialization with database persistence
 * - Remaining time calculation based on server timestamps
 * - Submission validation against expiration time
 * - Auto-submit functionality when timer expires
 * - Heartbeat endpoint for drift detection
 * - Timer cleanup
 */

import { Pool } from 'pg';
import { EventEmitter } from 'events';

export interface TimerState {
  sessionId: string;
  startTime: Date;
  expirationTime: Date;
  remainingTime: number; // seconds
}

export interface HeartbeatResponse {
  serverTime: number; // Unix timestamp (ms)
  expirationTime: number; // Unix timestamp (ms)
  remainingTime: number; // seconds
  driftDetected: boolean;
  driftAmount?: number; // seconds
}

/**
 * TimerService - Manages exam timing with server-side validation
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
 */
export class TimerService extends EventEmitter {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private readonly DRIFT_THRESHOLD_SECONDS = 5;
  
  constructor(private db: Pool) {
    super();
  }

  /**
   * Initialize timer for an exam session
   * 
   * **Validates: Requirement 2.1**
   * WHEN an exam session starts, THE Timer_Service SHALL record the server 
   * timestamp and calculate the expiration time
   * 
   * @param sessionId - Unique session identifier
   * @param durationMinutes - Duration of the exam section in minutes
   * @returns TimerState with start time, expiration time, and remaining time
   */
  async initializeTimer(sessionId: string, durationMinutes: number): Promise<TimerState> {
    const startTime = new Date();
    const expirationTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    
    // Persist to database (Requirement 2.1)
    await this.db.query(
      `UPDATE exam_sessions 
       SET start_time = $1, expiration_time = $2 
       WHERE session_id = $3`,
      [startTime, expirationTime, sessionId]
    );
    
    // Setup auto-submit timer with setTimeout (Requirement 2.4)
    const timeoutMs = durationMinutes * 60 * 1000;
    const timeout = setTimeout(() => {
      this.autoSubmit(sessionId);
    }, timeoutMs);
    
    this.timers.set(sessionId, timeout);
    
    return {
      sessionId,
      startTime,
      expirationTime,
      remainingTime: durationMinutes * 60
    };
  }

  /**
   * Get remaining time for a session using server-side calculation
   * 
   * **Validates: Requirement 2.3**
   * WHEN the UI_Controller requests time validation, THE Timer_Service SHALL 
   * return the remaining time based on server-side calculation
   * 
   * @param sessionId - Unique session identifier
   * @returns Remaining time in seconds (server-calculated)
   * @throws Error if session not found
   */
  async getRemainingTime(sessionId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT expiration_time FROM exam_sessions WHERE session_id = $1`,
      [sessionId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const expirationTime = new Date(result.rows[0].expiration_time);
    const now = new Date();
    const remainingMs = expirationTime.getTime() - now.getTime();
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    
    return remainingSeconds;
  }

  /**
   * Validate submission timestamp against server expiration time
   * 
   * **Validates: Requirements 2.5, 2.6**
   * - 2.5: IF a submission timestamp does not exceed the expiration time, 
   *        THEN THE Timer_Service SHALL accept the submission
   * - 2.6: IF a submission timestamp exceeds the expiration time, 
   *        THEN THE Timer_Service SHALL reject the submission
   * 
   * @param sessionId - Unique session identifier
   * @param submissionTimestamp - Client submission timestamp (Unix ms)
   * @returns true if submission is valid (before or at expiration), false otherwise
   */
  async validateSubmission(sessionId: string, submissionTimestamp: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT expiration_time FROM exam_sessions WHERE session_id = $1`,
      [sessionId]
    );
    
    if (result.rows.length === 0) {
      return false;
    }
    
    const expirationTime = new Date(result.rows[0].expiration_time);
    const submissionTime = new Date(submissionTimestamp);
    
    // Accept submission if before or exactly at expiration (Req 2.5, 2.6)
    return submissionTime <= expirationTime;
  }

  /**
   * Auto-submit current section when timer expires
   * 
   * **Validates: Requirement 2.4**
   * WHEN the server-calculated time expires, THE Timer_Service SHALL 
   * automatically submit the current section
   * 
   * @param sessionId - Unique session identifier
   */
  async autoSubmit(sessionId: string): Promise<void> {
    console.log(`Auto-submitting session ${sessionId} due to timer expiration`);
    
    try {
      await this.db.query(
        `UPDATE exam_sessions 
         SET status = 'expired' 
         WHERE session_id = $1`,
        [sessionId]
      );
      
      // Emit event for downstream processing (Requirement 2.4)
      this.emit('timer-expired', { sessionId });
      
      // Clean up timer
      this.timers.delete(sessionId);
    } catch (error) {
      console.error(`Failed to auto-submit session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Heartbeat endpoint to reconcile client timer with server time
   * Detects client-side time manipulation attempts
   * 
   * **Validates: Requirement 2.3** (implicit server-side validation)
   * Prevents test takers from manipulating timing through client-side code
   * by providing authoritative server timestamps
   * 
   * @param sessionId - Unique session identifier
   * @param clientTimestamp - Client's current timestamp (Unix ms)
   * @returns HeartbeatResponse with server time, expiration, and drift detection
   * @throws Error if session not found
   */
  async heartbeat(sessionId: string, clientTimestamp: number): Promise<HeartbeatResponse> {
    const serverTime = Date.now();
    const remainingTime = await this.getRemainingTime(sessionId);
    
    const result = await this.db.query(
      `SELECT expiration_time FROM exam_sessions WHERE session_id = $1`,
      [sessionId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const expirationTime = new Date(result.rows[0].expiration_time).getTime();
    
    // Calculate client-reported remaining time
    const clientRemainingTime = Math.floor((expirationTime - clientTimestamp) / 1000);
    
    // Detect drift (difference between server and client calculations)
    const drift = Math.abs(remainingTime - clientRemainingTime);
    const driftDetected = drift > this.DRIFT_THRESHOLD_SECONDS;
    
    return {
      serverTime,
      expirationTime,
      remainingTime,
      driftDetected,
      driftAmount: driftDetected ? drift : undefined
    };
  }

  /**
   * Clean up timer for a session
   * Removes setTimeout handler and clears internal state
   * 
   * @param sessionId - Unique session identifier
   */
  clearTimer(sessionId: string): void {
    const timeout = this.timers.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.timers.delete(sessionId);
    }
  }

  /**
   * Get all active timer session IDs (for testing/debugging)
   */
  getActiveTimers(): string[] {
    return Array.from(this.timers.keys());
  }
}
