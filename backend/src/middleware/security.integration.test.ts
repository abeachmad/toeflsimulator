/**
 * CORS and Rate Limiting Integration Tests — Task 26.5
 * Requirements: 22.3, 22.5
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('CORS policy', () => {
  it('allows requests from FRONTEND_URL origin', async () => {
    const origin = process.env.FRONTEND_URL || 'http://localhost:5173';
    const res = await request(app)
      .options('/api/sessions')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });

  it('rejects requests from unknown origin', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://evil.example.com');

    // Health check does not have CORS header for unknown origins
    expect(res.headers['access-control-allow-origin']).not.toBe(
      'http://evil.example.com',
    );
  });
});

describe('Input validation on API routes', () => {
  it('returns 400 for SQL injection in session creation body', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Content-Type', 'application/json')
      .send({ userId: "'; DROP TABLE exam_sessions; --" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid Input');
  });

  it('returns 400 for XSS in writing grade request', async () => {
    const res = await request(app)
      .post('/api/grade/writing')
      .set('Content-Type', 'application/json')
      .send({ text: '<script>alert(1)</script>', taskType: 'email' });

    expect(res.status).toBe(400);
  });

  it('allows legitimate writing submission body', async () => {
    // Even if grading fails (no API key), the request should pass validation
    const res = await request(app)
      .post('/api/grade/writing')
      .set('Content-Type', 'application/json')
      .send({ text: 'This is a legitimate academic writing response.', taskType: 'email' });

    // 200 (default scores) or 400/500 for other reasons — but NOT 400 due to validation
    expect(res.status).not.toBe(400);
  });
});
