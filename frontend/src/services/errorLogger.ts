/**
 * Error Logger Service — Task 21.4
 *
 * Provides structured error logging with:
 * - sessionId, category, severity, context
 * - Sends logs to backend for centralized tracking
 * - Falls back to console when backend is unreachable
 *
 * Requirements: 19.6
 */

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'
export type ErrorCategory =
  | 'network'
  | 'timer'
  | 'grading'
  | 'session'
  | 'ui'
  | 'unknown'

export interface ErrorLogEntry {
  timestamp: string
  sessionId: string | null
  category: ErrorCategory
  severity: ErrorSeverity
  message: string
  context?: Record<string, unknown>
  stack?: string
}

/** In-memory buffer for logs before they are flushed */
const logBuffer: ErrorLogEntry[] = []
const MAX_BUFFER = 50

let sessionId: string | null = null

/**
 * Set the current exam session ID so it is attached to all subsequent logs.
 */
export function setLoggerSessionId(id: string | null): void {
  sessionId = id
}

/**
 * Log an error with structured metadata.
 */
export function logError(
  message: string,
  options: {
    category?: ErrorCategory
    severity?: ErrorSeverity
    context?: Record<string, unknown>
    error?: Error | unknown
  } = {},
): void {
  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    sessionId,
    category: options.category ?? 'unknown',
    severity: options.severity ?? 'medium',
    message,
    context: options.context,
    stack: options.error instanceof Error ? options.error.stack : undefined,
  }

  // Always write to console
  const consoleFn =
    entry.severity === 'critical' || entry.severity === 'high'
      ? console.error
      : console.warn
  consoleFn(`[${entry.severity.toUpperCase()}][${entry.category}] ${message}`, entry)

  // Buffer for batch send
  logBuffer.push(entry)
  if (logBuffer.length >= MAX_BUFFER) {
    void flushLogs()
  }
}

/**
 * Send buffered logs to the backend.
 * Silently ignores failures to avoid cascading errors.
 */
export async function flushLogs(): Promise<void> {
  if (logBuffer.length === 0) return

  const toSend = logBuffer.splice(0, logBuffer.length)

  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: toSend }),
    })
  } catch {
    // Backend unreachable — silently discard (logs already in console)
  }
}

// Flush on page unload so logs are not lost
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    void flushLogs()
  })
}
