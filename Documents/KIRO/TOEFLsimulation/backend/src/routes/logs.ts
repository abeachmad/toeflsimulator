/**
 * Error Logging Endpoint — Task 21.4
 *
 * Receives structured error logs from the frontend client.
 * Requirements: 19.6
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';

const router = Router();

const logEntrySchema = z.object({
  timestamp: z.string(),
  sessionId: z.string().nullable(),
  category: z.enum(['network', 'timer', 'grading', 'session', 'ui', 'unknown']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  message: z.string().max(1000),
  context: z.record(z.unknown()).optional(),
  stack: z.string().max(5000).optional(),
});

const logsPayloadSchema = z.object({
  entries: z.array(logEntrySchema).max(100),
});

/**
 * POST /api/logs
 * Accepts an array of error log entries from the frontend.
 */
router.post('/', (req: Request, res: Response): void => {
  const parsed = logsPayloadSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid log payload', details: parsed.error.errors });
    return;
  }

  const { entries } = parsed.data;

  // In production, persist to a logging system (e.g. ELK, CloudWatch, Sentry).
  // For MVP, write to stdout in structured format.
  for (const entry of entries) {
    const line = JSON.stringify({
      source: 'frontend',
      ...entry,
    });

    if (entry.severity === 'critical' || entry.severity === 'high') {
      console.error(line);
    } else {
      console.warn(line);
    }
  }

  res.status(204).send();
});

export default router;
