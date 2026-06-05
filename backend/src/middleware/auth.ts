/**
 * Authentication Middleware (MVP placeholder) — Task 26.2
 *
 * Validates a Bearer JWT token on protected routes.
 * In the MVP, a simple shared secret is used instead of a full user database.
 * Replace with proper bcrypt + user table in production.
 *
 * Requirements: 22.2
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sessionUserId?: string;
    }
  }
}

const _NODE_ENV = process.env.NODE_ENV || 'development';

// JWT_SECRET must come from the environment — never from source code.
// In production the process exits immediately if it is absent or too short.
const JWT_SECRET_RAW = process.env.JWT_SECRET;

if (!JWT_SECRET_RAW) {
  if (_NODE_ENV === 'production') {
    console.error('[FATAL] JWT_SECRET environment variable is not set. Refusing to start.');
    process.exit(1);
  } else {
    console.warn(
      '[SECURITY WARNING] JWT_SECRET is not set. ' +
      'Running with an insecure development default. NEVER deploy without setting JWT_SECRET.',
    );
  }
} else if (_NODE_ENV === 'production' && JWT_SECRET_RAW.length < 32) {
  console.error('[FATAL] JWT_SECRET is too short (minimum 32 characters). Refusing to start.');
  process.exit(1);
}

// Development fallback: only used when NODE_ENV !== 'production'
const JWT_SECRET = JWT_SECRET_RAW ?? 'dev-only-insecure-jwt-secret';

/**
 * Minimal JWT verification — supports HS256 only.
 * Does NOT implement full JWT spec; production should use `jsonwebtoken` package.
 */
function verifySimpleJWT(token: string): { sub: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const headerB64 = parts[0]!;
  const payloadB64 = parts[1]!;
  const signatureB64 = parts[2]!;

  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  if (expectedSig !== signatureB64) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as {
      sub?: string;
      exp?: number;
    };

    if (!payload.sub) return null;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;

    return { sub: payload.sub };
  } catch {
    return null;
  }
}

/**
 * Middleware that requires a valid Bearer token.
 * Attaches `req.sessionUserId` on success.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing Bearer token.' });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifySimpleJWT(token);

  if (!payload) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token.' });
    return;
  }

  req.sessionUserId = payload.sub;
  next();
}

/**
 * Optional auth — attaches userId if token present, but never blocks.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifySimpleJWT(authHeader.slice(7));
    if (payload) req.sessionUserId = payload.sub;
  }
  next();
}
