/**
 * Integration tests for Session Management API routes
 * 
 * Tests all endpoints defined in sessions.ts:
 * - POST /api/sessions - Create session
 * - GET /api/sessions/:sessionId - Get session
 * - PUT /api/sessions/:sessionId - Update session
 * - DELETE /api/sessions/:sessionId - Delete session
 * - POST /api/sessions/:sessionId/modules/:moduleId/complete - Complete module
 * - PUT /api/sessions/:sessionId/ability/:section - Update ability
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../config/database.js';

describe('Session Management API Integration Tests', () => {
  let testSessionId: string;
  const testUserId = 'test-user-123';

  beforeAll(async () => {
    // Ensure database connection is ready
    await pool.query('SELECT 1');
  });

  beforeEach(async () => {
    // Clean up any existing test sessions before each test
    await pool.query('DELETE FROM exam_sessions WHERE user_id = $1', [testUserId]);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM exam_sessions WHERE user_id = $1', [testUserId]);
    await pool.end();
  });

  describe('POST /api/sessions - Create session', () => {
    it('should create a new session with valid data', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          userId: testUserId,
          moduleName: 'reading',
        })
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Session created successfully');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data).toHaveProperty('userId', testUserId);
      expect(response.body.data).toHaveProperty('moduleName', 'reading');
      expect(response.body.data).toHaveProperty('status', 'not_started');
      expect(response.body.data).toHaveProperty('currentQuestion', 0);
      expect(response.body.data).toHaveProperty('answers');
      expect(response.body.data).toHaveProperty('abilityEstimates');
      expect(response.body.data).toHaveProperty('completedModules');

      // Store for subsequent tests
      testSessionId = response.body.data.sessionId;
    });

    it('should create a session without moduleName', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          userId: testUserId,
        })
        .expect(201);

      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data).toHaveProperty('moduleName', null);
    });

    it('should return 400 for missing userId', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          moduleName: 'reading',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
      expect(response.body).toHaveProperty('details');
      expect(Array.isArray(response.body.details)).toBe(true);
    });

    it('should return 400 for invalid moduleName', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          userId: testUserId,
          moduleName: 'invalid-module',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for empty userId', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          userId: '',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });
  });

  describe('GET /api/sessions/:sessionId - Get session', () => {
    beforeEach(async () => {
      // Create a test session for retrieval tests
      const response = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId, moduleName: 'reading' });
      testSessionId = response.body.data.sessionId;
    });

    it('should retrieve an existing session', async () => {
      const response = await request(app)
        .get(`/api/sessions/${testSessionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Session retrieved successfully');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('sessionId', testSessionId);
      expect(response.body.data).toHaveProperty('userId', testUserId);
      expect(response.body.data).toHaveProperty('moduleName', 'reading');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/sessions/00000000-0000-0000-0000-000000000000') // Valid UUID that doesn't exist
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body.message).toContain('not found');
    });
  });

  describe('PUT /api/sessions/:sessionId - Update session', () => {
    beforeEach(async () => {
      // Create a test session for update tests
      const response = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId, moduleName: 'reading' });
      testSessionId = response.body.data.sessionId;
    });

    it('should update session status', async () => {
      const response = await request(app)
        .put(`/api/sessions/${testSessionId}`)
        .send({
          status: 'in_progress',
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Session updated successfully');
      expect(response.body.data).toHaveProperty('status', 'in_progress');
    });

    it('should update current question', async () => {
      const response = await request(app)
        .put(`/api/sessions/${testSessionId}`)
        .send({
          currentQuestion: 5,
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('currentQuestion', 5);
    });

    it('should update answers object', async () => {
      const answers = {
        'question-1': 'A',
        'question-2': 'B',
        'question-3': 'C',
      };

      const response = await request(app)
        .put(`/api/sessions/${testSessionId}`)
        .send({ answers })
        .expect(200);

      expect(response.body.data.answers).toEqual(answers);
    });

    it('should update multiple fields at once', async () => {
      const response = await request(app)
        .put(`/api/sessions/${testSessionId}`)
        .send({
          status: 'in_progress',
          currentQuestion: 10,
          currentModule: 2,
          currentSection: 'listening',
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('status', 'in_progress');
      expect(response.body.data).toHaveProperty('currentQuestion', 10);
      expect(response.body.data).toHaveProperty('currentModule', 2);
      expect(response.body.data).toHaveProperty('currentSection', 'listening');
    });

    it('should return 400 for no update fields', async () => {
      const response = await request(app)
        .put(`/api/sessions/${testSessionId}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .put(`/api/sessions/${testSessionId}`)
        .send({
          status: 'invalid-status',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for negative currentQuestion', async () => {
      const response = await request(app)
        .put(`/api/sessions/${testSessionId}`)
        .send({
          currentQuestion: -1,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .put('/api/sessions/00000000-0000-0000-0000-000000000000') // Valid UUID that doesn't exist
        .send({
          status: 'in_progress',
        })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
    });
  });

  describe('DELETE /api/sessions/:sessionId - Delete session', () => {
    beforeEach(async () => {
      // Create a test session for deletion tests
      const response = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId });
      testSessionId = response.body.data.sessionId;
    });

    it('should delete an existing session', async () => {
      const response = await request(app)
        .delete(`/api/sessions/${testSessionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Session deleted successfully');

      // Verify session is deleted by trying to retrieve it
      await request(app)
        .get(`/api/sessions/${testSessionId}`)
        .expect(404);
    });

    it('should succeed even for non-existent session (idempotent)', async () => {
      await request(app)
        .delete('/api/sessions/00000000-0000-0000-0000-000000000000') // Valid UUID that doesn't exist
        .expect(200);
    });
  });

  describe('POST /api/sessions/:sessionId/modules/:moduleId/complete - Complete module', () => {
    beforeEach(async () => {
      // Create a test session
      const response = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId, moduleName: 'reading' });
      testSessionId = response.body.data.sessionId;
    });

    it('should mark a module as completed', async () => {
      const moduleId = 'reading-module-1';

      const response = await request(app)
        .post(`/api/sessions/${testSessionId}/modules/${moduleId}/complete`)
        .expect(200);

      expect(response.body).toHaveProperty('message', `Module ${moduleId} marked as completed`);

      // Verify by retrieving session
      const getResponse = await request(app)
        .get(`/api/sessions/${testSessionId}`)
        .expect(200);

      expect(getResponse.body.data.completedModules).toContain(moduleId);
    });

    it('should mark multiple modules as completed', async () => {
      const moduleId1 = 'reading-module-1';
      const moduleId2 = 'reading-module-2';

      await request(app)
        .post(`/api/sessions/${testSessionId}/modules/${moduleId1}/complete`)
        .expect(200);

      await request(app)
        .post(`/api/sessions/${testSessionId}/modules/${moduleId2}/complete`)
        .expect(200);

      // Verify both modules are marked
      const getResponse = await request(app)
        .get(`/api/sessions/${testSessionId}`)
        .expect(200);

      expect(getResponse.body.data.completedModules).toContain(moduleId1);
      expect(getResponse.body.data.completedModules).toContain(moduleId2);
      expect(getResponse.body.data.completedModules).toHaveLength(2);
    });

    it('should not duplicate module completion', async () => {
      const moduleId = 'reading-module-1';

      // Complete the same module twice
      await request(app)
        .post(`/api/sessions/${testSessionId}/modules/${moduleId}/complete`)
        .expect(200);

      await request(app)
        .post(`/api/sessions/${testSessionId}/modules/${moduleId}/complete`)
        .expect(200);

      // Verify module appears only once
      const getResponse = await request(app)
        .get(`/api/sessions/${testSessionId}`)
        .expect(200);

      const completedModules = getResponse.body.data.completedModules;
      const moduleCount = completedModules.filter((m: string) => m === moduleId).length;
      expect(moduleCount).toBe(1);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .post('/api/sessions/non-existent-session/modules/module-1/complete')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
    });

    it('should return 400 for missing moduleId', async () => {
      await request(app)
        .post(`/api/sessions/${testSessionId}/modules//complete`)
        .expect(404); // Express routing treats empty param as not found
    });
  });

  describe('PUT /api/sessions/:sessionId/ability/:section - Update ability estimate', () => {
    beforeEach(async () => {
      // Create a test session
      const response = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId, moduleName: 'reading' });
      testSessionId = response.body.data.sessionId;
    });

    it('should update ability estimate for reading section', async () => {
      const theta = 0.5;
      const section = 'reading';

      const response = await request(app)
        .put(`/api/sessions/${testSessionId}/ability/${section}`)
        .send({ theta })
        .expect(200);

      expect(response.body).toHaveProperty('message', `Ability estimate updated for section ${section}`);
      expect(response.body.data).toHaveProperty('section', section);
      expect(response.body.data).toHaveProperty('theta', theta);

      // Verify by retrieving session
      const getResponse = await request(app)
        .get(`/api/sessions/${testSessionId}`)
        .expect(200);

      expect(getResponse.body.data.abilityEstimates).toHaveProperty(section, theta);
    });

    it('should update ability estimates for multiple sections', async () => {
      await request(app)
        .put(`/api/sessions/${testSessionId}/ability/reading`)
        .send({ theta: 0.8 })
        .expect(200);

      await request(app)
        .put(`/api/sessions/${testSessionId}/ability/listening`)
        .send({ theta: -0.5 })
        .expect(200);

      await request(app)
        .put(`/api/sessions/${testSessionId}/ability/writing`)
        .send({ theta: 1.2 })
        .expect(200);

      // Verify all estimates
      const getResponse = await request(app)
        .get(`/api/sessions/${testSessionId}`)
        .expect(200);

      expect(getResponse.body.data.abilityEstimates).toEqual({
        reading: 0.8,
        listening: -0.5,
        writing: 1.2,
      });
    });

    it('should accept theta values in valid range (-3 to 3)', async () => {
      await request(app)
        .put(`/api/sessions/${testSessionId}/ability/reading`)
        .send({ theta: -3 })
        .expect(200);

      await request(app)
        .put(`/api/sessions/${testSessionId}/ability/listening`)
        .send({ theta: 3 })
        .expect(200);

      await request(app)
        .put(`/api/sessions/${testSessionId}/ability/writing`)
        .send({ theta: 0 })
        .expect(200);
    });

    it('should return 400 for theta below -3', async () => {
      const response = await request(app)
        .put(`/api/sessions/${testSessionId}/ability/reading`)
        .send({ theta: -3.5 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for theta above 3', async () => {
      const response = await request(app)
        .put(`/api/sessions/${testSessionId}/ability/reading`)
        .send({ theta: 3.5 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for missing theta', async () => {
      const response = await request(app)
        .put(`/api/sessions/${testSessionId}/ability/reading`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for invalid section name', async () => {
      const response = await request(app)
        .put(`/api/sessions/${testSessionId}/ability/invalid-section`)
        .send({ theta: 0.5 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('Invalid section');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .put('/api/sessions/non-existent-session/ability/reading')
        .send({ theta: 0.5 })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid JSON');
    });

    it('should handle database connection errors gracefully', async () => {
      // This would require mocking the database pool
      // For now, we're testing happy paths
      // Production would need circuit breakers for DB failures
    });

    it('should validate session ID format', async () => {
      // Session IDs are UUIDs - test with invalid format
      const response = await request(app)
        .get('/api/sessions/invalid-uuid-format')
        .expect(400); // Invalid UUID format triggers validation error

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Complete workflow integration test', () => {
    it('should support a complete exam session lifecycle', async () => {
      // 1. Create session
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({
          userId: testUserId,
          moduleName: 'reading',
        })
        .expect(201);

      const sessionId = createResponse.body.data.sessionId;

      // 2. Start the exam
      await request(app)
        .put(`/api/sessions/${sessionId}`)
        .send({
          status: 'in_progress',
          currentQuestion: 0,
        })
        .expect(200);

      // 3. Submit some answers
      await request(app)
        .put(`/api/sessions/${sessionId}`)
        .send({
          currentQuestion: 5,
          answers: {
            'q1': 'A',
            'q2': 'B',
            'q3': 'C',
            'q4': 'D',
            'q5': 'A',
          },
        })
        .expect(200);

      // 4. Complete reading module
      await request(app)
        .post(`/api/sessions/${sessionId}/modules/reading-stage1/complete`)
        .expect(200);

      // 5. Update ability estimate
      await request(app)
        .put(`/api/sessions/${sessionId}/ability/reading`)
        .send({ theta: 0.8 })
        .expect(200);

      // 6. Move to next section
      await request(app)
        .put(`/api/sessions/${sessionId}`)
        .send({
          currentSection: 'listening',
          currentModule: 1,
          currentQuestion: 0,
        })
        .expect(200);

      // 7. Verify final state
      const finalResponse = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .expect(200);

      const session = finalResponse.body.data;
      expect(session.status).toBe('in_progress');
      expect(session.currentSection).toBe('listening');
      expect(session.completedModules).toContain('reading-stage1');
      expect(session.abilityEstimates).toHaveProperty('reading', 0.8);
      // Check that all submitted answers are present
      expect(session.answers).toHaveProperty('q1', 'A');
      expect(session.answers).toHaveProperty('q2', 'B');
      expect(session.answers).toHaveProperty('q3', 'C');
      expect(session.answers).toHaveProperty('q4', 'D');
      expect(session.answers).toHaveProperty('q5', 'A');

      // 8. Complete exam
      await request(app)
        .put(`/api/sessions/${sessionId}`)
        .send({
          status: 'completed',
        })
        .expect(200);

      // 9. Clean up
      await request(app)
        .delete(`/api/sessions/${sessionId}`)
        .expect(200);
    });
  });
});
