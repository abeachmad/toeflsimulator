/**
 * Timer Validation REST API Routes
 * 
 * Implements Task 9.3: Timer validation endpoints
 * 
 * Provides HTTP endpoints for:
 * - Starting a new timer for a session
 * - Sending heartbeat to validate client is active
 * - Getting timer state (remaining time, status)
 * - Stopping/deleting a timer
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TimerService } from '../services/TimerService.js';
import { pool } from '../config/database.js';

const router = Router();

// Initialize TimerService with database pool
const timerService = new TimerService(pool);

/**
 * Zod validation schemas
 */

// Schema for starting a timer
const startTimerSchema = z.object({
  sessionId: z.string().uuid('sessionId must be a valid UUID'),
  sectionName: z.string().min(1, 'sectionName is required').regex(/^[a-z]+$/, 'sectionName must contain only lowercase letters'),
  duration: z.number().int().min(1, 'duration must be at least 1 minute').max(180, 'duration cannot exceed 180 minutes'),
});

// Schema for heartbeat
const heartbeatSchema = z.object({
  clientTimestamp: z.number().int().positive('clientTimestamp must be a positive integer'),
});

/**
 * Middleware for Zod validation
 */
function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * POST /api/timers
 * Start a new timer for a session
 * 
 * Request body: { sessionId: string, sectionName: string, duration: number }
 * Response: TimerState object with timerId
 */
router.post('/', validateRequest(startTimerSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sessionId, sectionName, duration } = req.body;
    
    // Check if session exists
    const sessionCheck = await pool.query(
      'SELECT session_id FROM exam_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    if (sessionCheck.rows.length === 0) {
      res.status(404).json({
        error: 'Not Found',
        message: `Session ${sessionId} not found`,
      });
      return;
    }
    
    // Initialize timer
    const timerState = await timerService.initializeTimer(sessionId, duration);
    
    // Update session status to in_progress when timer starts
    await pool.query(
      'UPDATE exam_sessions SET status = $1 WHERE session_id = $2',
      ['in_progress', sessionId]
    );
    
    res.status(201).json({
      message: 'Timer started successfully',
      data: {
        timerId: sessionId, // Use sessionId as timerId
        sessionId: timerState.sessionId,
        sectionName,
        startTime: timerState.startTime.toISOString(),
        expirationTime: timerState.expirationTime.toISOString(),
        remainingTime: timerState.remainingTime,
        duration,
      },
    });
  } catch (error) {
    console.error('Error starting timer:', error);
    next(error);
  }
});

/**
 * POST /api/timers/:timerId/heartbeat
 * Send heartbeat to validate client is active
 * 
 * Path params: timerId (sessionId)
 * Request body: { clientTimestamp: number }
 * Response: HeartbeatResponse with drift detection
 */
router.post('/:timerId/heartbeat', validateRequest(heartbeatSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { timerId } = req.params;
    const { clientTimestamp } = req.body;
    
    if (!timerId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'timerId is required',
      });
      return;
    }
    
    // Check if timer exists (session exists)
    const sessionCheck = await pool.query(
      'SELECT session_id, expiration_time FROM exam_sessions WHERE session_id = $1',
      [timerId]
    );
    
    if (sessionCheck.rows.length === 0) {
      res.status(404).json({
        error: 'Not Found',
        message: `Timer ${timerId} not found`,
      });
      return;
    }
    
    // Check if timer has expired
    const expirationTime = new Date(sessionCheck.rows[0].expiration_time);
    const now = new Date();
    
    if (now > expirationTime) {
      res.status(410).json({
        error: 'Gone',
        message: 'Timer has expired',
        expirationTime: expirationTime.toISOString(),
      });
      return;
    }
    
    // Process heartbeat
    const heartbeatResponse = await timerService.heartbeat(timerId, clientTimestamp);
    
    res.status(200).json({
      message: 'Heartbeat received',
      data: heartbeatResponse,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    console.error('Error processing heartbeat:', error);
    next(error);
  }
});

/**
 * GET /api/timers/:timerId
 * Get timer state (remaining time, status)
 * 
 * Path params: timerId (sessionId)
 * Response: Timer state with remaining time and status
 */
router.get('/:timerId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { timerId } = req.params;
    
    if (!timerId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'timerId is required',
      });
      return;
    }
    
    // Check if timer exists
    const sessionCheck = await pool.query(
      'SELECT session_id, start_time, expiration_time, status FROM exam_sessions WHERE session_id = $1',
      [timerId]
    );
    
    if (sessionCheck.rows.length === 0) {
      res.status(404).json({
        error: 'Not Found',
        message: `Timer ${timerId} not found`,
      });
      return;
    }
    
    const session = sessionCheck.rows[0];
    const expirationTime = new Date(session.expiration_time);
    const startTime = new Date(session.start_time);
    const now = new Date();
    
    // Check if timer has expired
    if (now > expirationTime) {
      res.status(410).json({
        error: 'Gone',
        message: 'Timer has expired',
        data: {
          timerId,
          status: 'expired',
          startTime: startTime.toISOString(),
          expirationTime: expirationTime.toISOString(),
          remainingTime: 0,
        },
      });
      return;
    }
    
    // Get remaining time from TimerService
    const remainingTime = await timerService.getRemainingTime(timerId);
    
    res.status(200).json({
      message: 'Timer state retrieved successfully',
      data: {
        timerId,
        status: session.status || 'active',
        startTime: startTime.toISOString(),
        expirationTime: expirationTime.toISOString(),
        remainingTime,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    console.error('Error getting timer state:', error);
    next(error);
  }
});

/**
 * DELETE /api/timers/:timerId
 * Stop/delete a timer
 * 
 * Path params: timerId (sessionId)
 * Response: Success message
 */
router.delete('/:timerId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { timerId } = req.params;
    
    if (!timerId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'timerId is required',
      });
      return;
    }
    
    // Check if timer exists
    const sessionCheck = await pool.query(
      'SELECT session_id FROM exam_sessions WHERE session_id = $1',
      [timerId]
    );
    
    if (sessionCheck.rows.length === 0) {
      res.status(404).json({
        error: 'Not Found',
        message: `Timer ${timerId} not found`,
      });
      return;
    }
    
    // Clear timer (remove setTimeout handler)
    timerService.clearTimer(timerId);
    
    // Update session status to paused (stopped timer)
    await pool.query(
      'UPDATE exam_sessions SET status = $1 WHERE session_id = $2',
      ['paused', timerId]
    );
    
    res.status(200).json({
      message: 'Timer stopped successfully',
      data: {
        timerId,
        status: 'stopped',
      },
    });
  } catch (error) {
    console.error('Error stopping timer:', error);
    next(error);
  }
});

export default router;
