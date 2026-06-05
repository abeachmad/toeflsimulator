/**
 * Input Validation and Sanitization Middleware — Task 26.1
 *
 * Rejects common SQL injection and XSS patterns.
 * Applied globally to all API routes.
 *
 * Requirements: 22.4
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Patterns that signal malicious input (SQL injection, XSS, path traversal).
 * SQL keywords are only flagged when used in injection context (preceded by
 * quotes, semicolons, or dashes) to avoid false positives on legitimate text.
 */
const DANGEROUS_PATTERNS = [
  // SQL injection — keyword must follow a quote, semicolon, or comment marker
  /(['";])\s*(\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bUNION\b|\bEXEC\b)/i,
  // SQL comment sequences
  /(-{2}|\/\*|\*\/)/,
  // XSS
  /<script\b/i,
  /javascript:/i,
  /on\w+\s*=/i,
  // Path traversal
  /\.\.\//,
  /\0/,
];

function containsDangerousPattern(value: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(value));
}

function inspectValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return containsDangerousPattern(value);
  }
  if (Array.isArray(value)) {
    return value.some((v) => inspectValue(v));
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some((v) => inspectValue(v));
  }
  return false;
}

/**
 * Validates all request body, query, and param values against
 * the dangerous pattern list and returns 400 if any match is found.
 */
export function inputValidationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const toCheck = [req.body, req.query, req.params];

  for (const source of toCheck) {
    if (source && inspectValue(source)) {
      res.status(400).json({
        error: 'Invalid Input',
        message: 'Request contains invalid or potentially dangerous content.',
      });
      return;
    }
  }

  next();
}

/**
 * Sanitizes a string by escaping HTML special characters.
 * Use on freeform text fields before persisting to DB.
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
