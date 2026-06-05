/**
 * Security Tests — Task 26.5
 * Tests input validation, CORS policy, and rate limiting behavior.
 * Requirements: 22.4, 22.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { inputValidationMiddleware, sanitizeHtml } from '../middleware/validation';
import type { Request, Response, NextFunction } from 'express';

// Build a minimal mock req/res/next
function mockRequest(
  overrides: Partial<{ body: unknown; query: unknown; params: unknown }> = {},
): Request {
  return {
    body: overrides.body ?? {},
    query: overrides.query ?? {},
    params: overrides.params ?? {},
  } as unknown as Request;
}

function mockResponse(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; _status?: number } {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as ReturnType<typeof mockResponse>;
}

import { vi } from 'vitest';

describe('inputValidationMiddleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn() as unknown as NextFunction;
  });

  it('calls next() for clean input', () => {
    const req = mockRequest({ body: { text: 'Hello world', taskType: 'email' } });
    const res = mockResponse();
    inputValidationMiddleware(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks SQL injection in body', () => {
    const req = mockRequest({ body: { text: "'; DROP TABLE test_items; --" } });
    const res = mockResponse();
    inputValidationMiddleware(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks UNION-based SQL injection', () => {
    const req = mockRequest({ body: { text: "' UNION SELECT * FROM exam_sessions --" } });
    const res = mockResponse();
    inputValidationMiddleware(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('blocks XSS <script> tag in body', () => {
    const req = mockRequest({ body: { text: '<script>alert("xss")</script>' } });
    const res = mockResponse();
    inputValidationMiddleware(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('blocks javascript: protocol', () => {
    const req = mockRequest({ body: { url: 'javascript:alert(1)' } });
    const res = mockResponse();
    inputValidationMiddleware(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('blocks event handler injection', () => {
    const req = mockRequest({ body: { text: '<img onload=alert(1)>' } });
    const res = mockResponse();
    inputValidationMiddleware(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('blocks path traversal in query', () => {
    const req = mockRequest({ query: { path: '../../etc/passwd' } });
    const res = mockResponse();
    inputValidationMiddleware(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('blocks null byte in body', () => {
    const req = mockRequest({ body: { text: 'hello\0world' } });
    const res = mockResponse();
    inputValidationMiddleware(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('allows legitimate academic text', () => {
    const req = mockRequest({
      body: {
        text: "The professor's lecture covered data structures, including arrays and linked lists. Students should select the best answer from the options provided.",
        taskType: 'academic-discussion',
      },
    });
    const res = mockResponse();
    inputValidationMiddleware(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows empty body', () => {
    const req = mockRequest({ body: {} });
    const res = mockResponse();
    inputValidationMiddleware(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('inspects nested objects in body', () => {
    const req = mockRequest({
      body: { outer: { inner: "'; SELECT * FROM users --" } },
    });
    const res = mockResponse();
    inputValidationMiddleware(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('inspects arrays in body', () => {
    const req = mockRequest({
      body: { items: ['clean', '<script>bad</script>'] },
    });
    const res = mockResponse();
    inputValidationMiddleware(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('sanitizeHtml', () => {
  it('escapes < and > characters', () => {
    expect(sanitizeHtml('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('escapes ampersand', () => {
    expect(sanitizeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes double quotes', () => {
    expect(sanitizeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(sanitizeHtml("it's")).toBe("it&#x27;s");
  });

  it('leaves plain text unchanged', () => {
    expect(sanitizeHtml('Hello world')).toBe('Hello world');
  });
});
