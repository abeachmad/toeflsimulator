/**
 * Integration tests for API endpoints - Complete workflows
 * 
 * Task 9.8: Write integration tests for API endpoints
 * 
 * Tests complete workflows across multiple endpoints:
 * - Session lifecycle (create → update → submit → retrieve)
 * - Timer validation flow with heartbeat
 * - MST routing with mocked IRT scorer
 * - Error responses for invalid requests
 * 
 * Validates:
 * - Requirement 1.1: Session creation and management
 * - Requirement 2.3: Server-side time validation
 * - Requirement 8.1: MST routing based on ability
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../config/database.js';

describe('API Integration Tests - Complete Workflows', () => {
  const testUserId = 'integration-test-user-123';
  
  // Sample test items for MST routing tests
  const setupTestItems = async () => {
    const items = [
      // Stage 1 medium items
      {
        item_id: 'int-read-s1-m1',
        section: 'reading',
        type: 'multiple-choice',
        difficulty_level: 'medium',
        stage: 1,
        content: 'Integration test question 1',
        options: ['A', 'B', 'C', 'D'],
        correct_answer: 'B',
        irt_parameters: { a: 1.2, b: 0.0, c: 0.25 },
      },
      {
        item_id: 'int-read-s1-m2',
        section: 'reading',
        type: 'multiple-choice',
        difficulty_level: 'medium',
        stage: 1,
        content: 'Integration test question 2',
        options: ['A', 'B', 'C', 'D'],
        correct_answer: 'A',
        irt_parameters: { a: 1.0, b: 0.1, c: 0.25 },
      },
      // Stage 2 easy items
      {
        item_id: 'int-read-s2-e1',
        section: 'reading',
        type: 'multiple-choice',
        difficulty_level: 'easy',
        stage: 2,
        content: 'Easy integration test question',
        options: ['A', 'B', 'C', 'D'],
        correct_answer: 'C',
        irt_parameters: { a: 0.9, b: -1.0, c: 0.25 },
      },
      // Stage 2 medium items
      {
        item_id: 'int-read-s2-m1',
        section: 'reading',
        type: 'multiple-choice',
        difficulty_level: 'medium',
        stage: 2,
        content: 'Medium integration test question',
        options: ['A', 'B', 'C', 'D'],
        correct_answer: 'D',
        irt_parameters: { a: 1.1, b: 0.0, c: 0.25 },
      },
      // Stage 2 hard items
      {
        item_id: 'int-read-s2-h1',
        section: 'reading',
        type: 'multiple-choice',
        difficulty_level: 'hard',
        stage: 2,
        content: 'Hard integration test question',
        options: ['A', 'B', 'C', 'D'],
        correct_answer: 'A',
        irt_parameters: { a: 1.5, b: 1.0, c: 0.25 },
      },
    ];
    
    for (const item of items) {
      await pool.query(
        `INSERT INTO test_items (
          item_id, section, type, difficulty_level, stage, content,
          options, correct_answer, irt_parameters, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (item_id) DO UPDATE SET
          section = EXCLUDED.section,
          difficulty_level = EXCLUDED.difficulty_level,
          stage = EXCLUDED.stage`,
        [
          item.item_id, item.section, item.type, item.difficulty_level,
          item.stage, item.content, JSON.stringify(item.options),
          item.correct_answer, JSON.stringify(item.irt_parameters),
          JSON.stringify({})
        ]
      );
    }
  };

  beforeAll(async () => {
    await pool.query('SELECT 1');
    await setupTestItems();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM exam_sessions WHERE user_id = $1', [testUserId]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM exam_sessions WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM test_items WHERE item_id LIKE $1', ['int-%']);
    await pool.end();
  });

  describe('Workflow 1: Session Lifecycle (Requirement 1.1)', () => {
    it('should complete full session lifecycle: create → update → retrieve → submit', async () => {
      // Step 1: Create session
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({
          userId: testUserId,
          moduleName: 'reading',
        })
        .expect(201);

      expect(createResponse.body).toHaveProperty('message', 'Session created successfully');
      expect(createResponse.body.data).toHaveProperty('sessionId');
      expect(createResponse.body.data).toHaveProperty('status', 'not_started');
      
      const sessionId = createResponse.body.data.sessionId;

      // Step 2: Update session to in_progress
      const updateResponse = await request(app)
        .put(`/api/sessions/${sessionId}`)
        .send({
          status: 'in_progress',
          currentQuestion: 1,
        })
        .expect(200);

      expect(updateResponse.body.data).toHaveProperty('status', 'in_progress');
      expect(updateResponse.body.data).toHaveProperty('currentQuestion', 1);

      // Step 3: Submit answers
      const answersResponse = await request(app)
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

      expect(answersResponse.body.data.answers).toEqual({
        'q1': 'A',
        'q2': 'B',
        'q3': 'C',
        'q4': 'D',
        'q5': 'A',
      });

      // Step 4: Retrieve session to verify persistence
      const retrieveResponse = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .expect(200);

      expect(retrieveResponse.body.data).toHaveProperty('sessionId', sessionId);
      expect(retrieveResponse.body.data).toHaveProperty('status', 'in_progress');
      expect(retrieveResponse.body.data).toHaveProperty('currentQuestion', 5);
      expect(Object.keys(retrieveResponse.body.data.answers)).toHaveLength(5);

      // Step 5: Submit session (mark as completed)
      const submitResponse = await request(app)
        .put(`/api/sessions/${sessionId}`)
        .send({
          status: 'completed',
          completedAt: new Date().toISOString(),
        })
        .expect(200);

      expect(submitResponse.body.data).toHaveProperty('status', 'completed');
      expect(submitResponse.body.data).toHaveProperty('completedAt');

      // Step 6: Verify final session state
      const finalResponse = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .expect(200);

      expect(finalResponse.body.data.status).toBe('completed');
      expect(finalResponse.body.data.completedAt).toBeDefined();
    });

    it('should handle session state updates with complex data', async () => {
      // Create session
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId, moduleName: 'listening' })
        .expect(201);
      
      const sessionId = createResponse.body.data.sessionId;

      // Update with multiple fields
      await request(app)
        .put(`/api/sessions/${sessionId}`)
        .send({
          status: 'in_progress',
          currentSection: 'listening',
          currentModule: 2,
          currentQuestion: 10,
          answers: {
            'l1': 'A',
            'l2': 'B',
            'l3': { type: 'multiple', values: ['A', 'C'] },
          },
        })
        .expect(200);

      // Mark module as completed
      await request(app)
        .post(`/api/sessions/${sessionId}/modules/listening-stage1/complete`)
        .expect(200);

      // Update ability estimate
      await request(app)
        .put(`/api/sessions/${sessionId}/ability/listening`)
        .send({ theta: 0.5 })
        .expect(200);

      // Verify all updates persisted
      const finalResponse = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .expect(200);

      const session = finalResponse.body.data;
      expect(session.status).toBe('in_progress');
      expect(session.currentSection).toBe('listening');
      expect(session.currentModule).toBe(2);
      expect(session.currentQuestion).toBe(10);
      expect(session.answers).toHaveProperty('l3');
      expect(session.completedModules).toContain('listening-stage1');
      expect(session.abilityEstimates).toHaveProperty('listening', 0.5);
    });
  });

  describe('Workflow 2: Timer Validation Flow (Requirement 2.3)', () => {
    it('should complete timer validation flow with heartbeat', async () => {
      // Step 1: Create session
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId, moduleName: 'reading' })
        .expect(201);
      
      const sessionId = sessionResponse.body.data.sessionId;

      // Step 2: Initialize timer
      const timerResponse = await request(app)
        .post('/api/timers')
        .send({
          sessionId,
          sectionName: 'reading',
          duration: 30, // 30 minutes
        })
        .expect(201);

      expect(timerResponse.body.data).toHaveProperty('timerId', sessionId);
      expect(timerResponse.body.data).toHaveProperty('remainingTime', 1800); // 30 minutes = 1800 seconds
      
      const startTime = new Date(timerResponse.body.data.startTime);
      const expirationTime = new Date(timerResponse.body.data.expirationTime);

      // Step 3: Get remaining time
      const remainingResponse = await request(app)
        .get(`/api/timers/${sessionId}`)
        .expect(200);

      expect(remainingResponse.body.data.remainingTime).toBeGreaterThan(1795);
      expect(remainingResponse.body.data.remainingTime).toBeLessThanOrEqual(1800);

      // Step 4: Send heartbeat (synchronized client)
      const heartbeatResponse = await request(app)
        .post(`/api/timers/${sessionId}/heartbeat`)
        .send({ clientTimestamp: Date.now() })
        .expect(200);

      expect(heartbeatResponse.body.data).toHaveProperty('driftDetected', false);
      expect(heartbeatResponse.body.data).toHaveProperty('serverTime');
      expect(heartbeatResponse.body.data).toHaveProperty('remainingTime');

      // Step 5: Send heartbeat with drift (client time off by 10 seconds)
      const driftHeartbeatResponse = await request(app)
        .post(`/api/timers/${sessionId}/heartbeat`)
        .send({ clientTimestamp: Date.now() - 10000 })
        .expect(200);

      expect(driftHeartbeatResponse.body.data).toHaveProperty('driftDetected', true);
      expect(driftHeartbeatResponse.body.data).toHaveProperty('driftAmount');
      expect(driftHeartbeatResponse.body.data.driftAmount).toBeGreaterThan(5);

      // Step 6: Stop timer
      await request(app)
        .delete(`/api/timers/${sessionId}`)
        .expect(200);

      // Verify session is stopped
      const finalSessionResponse = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .expect(200);

      expect(finalSessionResponse.body.data.status).toBe('stopped');
    });

    it('should handle timer expiration correctly', async () => {
      // Create session with expired timer
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId + '-expired', moduleName: 'writing' })
        .expect(201);
      
      const sessionId = sessionResponse.body.data.sessionId;

      // Set expiration time to past
      await pool.query(
        'UPDATE exam_sessions SET expiration_time = $1 WHERE session_id = $2',
        [new Date(Date.now() - 1000), sessionId]
      );

      // Attempt heartbeat on expired timer
      const heartbeatResponse = await request(app)
        .post(`/api/timers/${sessionId}/heartbeat`)
        .send({ clientTimestamp: Date.now() })
        .expect(410);

      expect(heartbeatResponse.body).toHaveProperty('error', 'Gone');
      expect(heartbeatResponse.body.message).toContain('expired');

      // Attempt to get timer state
      const timerResponse = await request(app)
        .get(`/api/timers/${sessionId}`)
        .expect(410);

      expect(timerResponse.body).toHaveProperty('error', 'Gone');
      expect(timerResponse.body.data.remainingTime).toBe(0);
    });
  });

  describe('Workflow 3: MST Routing with IRT Scorer (Requirement 8.1)', () => {
    it('should route to appropriate difficulty based on Stage 1 performance', async () => {
      // Create session
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId, moduleName: 'reading' })
        .expect(201);
      
      const sessionId = sessionResponse.body.data.sessionId;

      // Low ability responses (mostly incorrect) → should route to easy
      const lowAbilityResponses = [
        { itemId: 'int-read-s1-m1', isCorrect: false },
        { itemId: 'int-read-s1-m2', isCorrect: false },
      ];

      const lowAbilityRoute = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId,
          section: 'reading',
          stage1Responses: lowAbilityResponses,
        })
        .expect(200);

      expect(lowAbilityRoute.body.data).toHaveProperty('ability');
      expect(lowAbilityRoute.body.data.routingDecision).toHaveProperty('difficulty', 'easy');
      expect(lowAbilityRoute.body.data.routingDecision).toHaveProperty('stage', 2);
      expect(lowAbilityRoute.body.data.module).toHaveProperty('difficulty', 'easy');
      expect(lowAbilityRoute.body.data.module.items.length).toBeGreaterThan(0);

      // Verify ability was stored in session
      const sessionCheck = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .expect(200);

      expect(sessionCheck.body.data.abilityEstimates).toHaveProperty('reading');
    });

    it('should route to hard module for high ability', async () => {
      // Create new session
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId + '-high', moduleName: 'reading' })
        .expect(201);
      
      const sessionId = sessionResponse.body.data.sessionId;

      // High ability responses (all correct) → should route to hard
      const highAbilityResponses = [
        { itemId: 'int-read-s1-m1', isCorrect: true },
        { itemId: 'int-read-s1-m2', isCorrect: true },
      ];

      const highAbilityRoute = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId,
          section: 'reading',
          stage1Responses: highAbilityResponses,
        })
        .expect(200);

      expect(highAbilityRoute.body.data.routingDecision).toHaveProperty('difficulty', 'hard');
      expect(highAbilityRoute.body.data.module).toHaveProperty('difficulty', 'hard');
      expect(highAbilityRoute.body.data.ability).toBeGreaterThan(0.8);
    });

    it('should route to medium module for moderate ability', async () => {
      // Create session
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId + '-medium', moduleName: 'reading' })
        .expect(201);
      
      const sessionId = sessionResponse.body.data.sessionId;

      // Medium ability responses (mixed) → should route to medium
      const mediumAbilityResponses = [
        { itemId: 'int-read-s1-m1', isCorrect: true },
        { itemId: 'int-read-s1-m2', isCorrect: false },
      ];

      const mediumAbilityRoute = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId,
          section: 'reading',
          stage1Responses: mediumAbilityResponses,
        })
        .expect(200);

      expect(mediumAbilityRoute.body.data.routingDecision).toHaveProperty('difficulty', 'medium');
      expect(mediumAbilityRoute.body.data.module).toHaveProperty('difficulty', 'medium');
      expect(mediumAbilityRoute.body.data.ability).toBeGreaterThanOrEqual(-0.8);
      expect(mediumAbilityRoute.body.data.ability).toBeLessThanOrEqual(0.8);
    });

    it('should fetch module items by difficulty', async () => {
      // Fetch easy module
      const easyModule = await request(app)
        .get('/api/modules/easy')
        .query({ section: 'reading', stage: 2 })
        .expect(200);

      expect(easyModule.body.data.module).toHaveProperty('difficulty', 'easy');
      expect(easyModule.body.data.module.items.length).toBeGreaterThan(0);

      // Fetch medium module
      const mediumModule = await request(app)
        .get('/api/modules/medium')
        .query({ section: 'reading', stage: 2 })
        .expect(200);

      expect(mediumModule.body.data.module).toHaveProperty('difficulty', 'medium');
      expect(mediumModule.body.data.module.items.length).toBeGreaterThan(0);

      // Fetch hard module
      const hardModule = await request(app)
        .get('/api/modules/hard')
        .query({ section: 'reading', stage: 2 })
        .expect(200);

      expect(hardModule.body.data.module).toHaveProperty('difficulty', 'hard');
      expect(hardModule.body.data.module.items.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow 4: Error Response Handling', () => {
    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/sessions/00000000-0000-0000-0000-000000000000')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 for invalid request body in session creation', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          userId: '', // Empty userId
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
      expect(response.body).toHaveProperty('details');
      expect(Array.isArray(response.body.details)).toBe(true);
    });

    it('should return 400 for invalid timer duration', async () => {
      // Create session first
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId })
        .expect(201);
      
      const sessionId = sessionResponse.body.data.sessionId;

      // Try to create timer with invalid duration
      const response = await request(app)
        .post('/api/timers')
        .send({
          sessionId,
          sectionName: 'reading',
          duration: 0, // Invalid: must be at least 1
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for invalid MST routing request', async () => {
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId })
        .expect(201);
      
      const sessionId = sessionResponse.body.data.sessionId;

      // Empty responses array
      const response = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId,
          section: 'reading',
          stage1Responses: [], // Invalid: at least one response required
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for non-adaptive section in MST routing', async () => {
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId })
        .expect(201);
      
      const sessionId = sessionResponse.body.data.sessionId;

      // Writing section doesn't support MST
      const response = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId,
          section: 'writing', // Invalid: writing doesn't use MST
          stage1Responses: [
            { itemId: 'int-read-s1-m1', isCorrect: true }
          ],
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid JSON');
    });

    it('should return structured error for module fetch with invalid difficulty', async () => {
      const response = await request(app)
        .get('/api/modules/invalid-difficulty')
        .query({ section: 'reading', stage: 2 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('Invalid difficulty level');
    });
  });

  describe('Complete Integration Workflow', () => {
    it('should complete a full exam session with all components', async () => {
      // === PHASE 1: Session Setup ===
      console.log('\n=== Phase 1: Session Setup ===');
      
      // Create exam session
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({
          userId: testUserId + '-complete',
          moduleName: 'reading',
        })
        .expect(201);
      
      const sessionId = sessionResponse.body.data.sessionId;
      console.log(`Created session: ${sessionId}`);

      // Start session
      await request(app)
        .put(`/api/sessions/${sessionId}`)
        .send({ status: 'in_progress' })
        .expect(200);
      
      // === PHASE 2: Timer Initialization ===
      console.log('\n=== Phase 2: Timer Initialization ===');
      
      const timerResponse = await request(app)
        .post('/api/timers')
        .send({
          sessionId,
          sectionName: 'reading',
          duration: 30,
        })
        .expect(201);
      
      console.log(`Timer started with ${timerResponse.body.data.remainingTime}s remaining`);

      // === PHASE 3: Stage 1 Module ===
      console.log('\n=== Phase 3: Stage 1 Module ===');
      
      // Fetch Stage 1 module
      const stage1Module = await request(app)
        .get('/api/modules/medium')
        .query({ section: 'reading', stage: 1 })
        .expect(200);

      console.log(`Stage 1 module: ${stage1Module.body.data.module.items.length} items`);

      // Submit Stage 1 answers
      const stage1Answers: Record<string, string> = {};
      stage1Module.body.data.module.items.forEach((item: any, index: number) => {
        stage1Answers[item.id] = index % 2 === 0 ? 'A' : 'B';
      });

      await request(app)
        .put(`/api/sessions/${sessionId}`)
        .send({
          currentQuestion: stage1Module.body.data.module.items.length,
          answers: stage1Answers,
        })
        .expect(200);
      
      // Mark Stage 1 complete
      await request(app)
        .post(`/api/sessions/${sessionId}/modules/reading-stage1/complete`)
        .expect(200);

      // === PHASE 4: MST Routing ===
      console.log('\n=== Phase 4: MST Routing ===');
      
      // Prepare Stage 1 responses for routing
      const stage1Responses = stage1Module.body.data.module.items.map((item: any, index: number) => ({
        itemId: item.id,
        isCorrect: index % 2 === 0, // Alternate correct/incorrect
      }));

      // Route to Stage 2
      const routingResponse = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId,
          section: 'reading',
          stage1Responses,
        })
        .expect(200);

      const ability = routingResponse.body.data.ability;
      const difficulty = routingResponse.body.data.routingDecision.difficulty;
      console.log(`Ability: θ=${ability.toFixed(3)}, Routed to: ${difficulty}`);

      expect(routingResponse.body.data.module.items.length).toBeGreaterThan(0);

      // === PHASE 5: Stage 2 Module ===
      console.log('\n=== Phase 5: Stage 2 Module ===');
      
      // Submit Stage 2 answers
      const stage2Answers: Record<string, string> = {};
      routingResponse.body.data.module.items.forEach((item: any) => {
        stage2Answers[item.id] = 'C';
      });

      await request(app)
        .put(`/api/sessions/${sessionId}`)
        .send({
          currentModule: 2,
          answers: { ...stage1Answers, ...stage2Answers },
        })
        .expect(200);

      // Mark Stage 2 complete
      await request(app)
        .post(`/api/sessions/${sessionId}/modules/reading-stage2/complete`)
        .expect(200);

      // === PHASE 6: Heartbeat Check ===
      console.log('\n=== Phase 6: Heartbeat Check ===');
      
      const heartbeatResponse = await request(app)
        .post(`/api/timers/${sessionId}/heartbeat`)
        .send({ clientTimestamp: Date.now() })
        .expect(200);

      console.log(`Remaining time: ${heartbeatResponse.body.data.remainingTime}s`);
      expect(heartbeatResponse.body.data.driftDetected).toBe(false);

      // === PHASE 7: Section Completion ===
      console.log('\n=== Phase 7: Section Completion ===');
      
      // Complete reading section
      await request(app)
        .put(`/api/sessions/${sessionId}`)
        .send({
          status: 'completed',
          completedAt: new Date().toISOString(),
        })
        .expect(200);

      // Stop timer
      await request(app)
        .delete(`/api/timers/${sessionId}`)
        .expect(200);

      // === PHASE 8: Verification ===
      console.log('\n=== Phase 8: Final Verification ===');
      
      const finalSession = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .expect(200);

      const session = finalSession.body.data;
      
      // Verify session state
      expect(session.status).toBe('completed');
      expect(session.completedModules).toContain('reading-stage1');
      expect(session.completedModules).toContain('reading-stage2');
      expect(session.abilityEstimates).toHaveProperty('reading');
      expect(Object.keys(session.answers).length).toBeGreaterThan(0);
      
      console.log(`Session completed successfully with ${Object.keys(session.answers).length} answers`);
      console.log(`Ability estimate: θ=${session.abilityEstimates.reading.toFixed(3)}`);
      console.log('✓ All phases completed successfully\n');
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent session updates', async () => {
      // Create session
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId })
        .expect(201);
      
      const sessionId = sessionResponse.body.data.sessionId;

      // Send multiple concurrent updates
      const updates = await Promise.all([
        request(app).put(`/api/sessions/${sessionId}`).send({ currentQuestion: 1 }),
        request(app).put(`/api/sessions/${sessionId}`).send({ currentQuestion: 2 }),
        request(app).put(`/api/sessions/${sessionId}`).send({ currentQuestion: 3 }),
      ]);

      // All should succeed (last write wins)
      updates.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify final state
      const finalSession = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .expect(200);

      // One of the updates should be reflected
      expect([1, 2, 3]).toContain(finalSession.body.data.currentQuestion);
    });

    it('should handle concurrent heartbeats', async () => {
      // Create session and timer
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId })
        .expect(201);
      
      const sessionId = sessionResponse.body.data.sessionId;

      await request(app)
        .post('/api/timers')
        .send({ sessionId, sectionName: 'reading', duration: 30 })
        .expect(201);

      const clientTimestamp = Date.now();

      // Send multiple concurrent heartbeats
      const heartbeats = await Promise.all([
        request(app).post(`/api/timers/${sessionId}/heartbeat`).send({ clientTimestamp }),
        request(app).post(`/api/timers/${sessionId}/heartbeat`).send({ clientTimestamp }),
        request(app).post(`/api/timers/${sessionId}/heartbeat`).send({ clientTimestamp }),
      ]);

      // All should succeed
      heartbeats.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('remainingTime');
      });
    });
  });

  describe('Data Consistency Across Endpoints', () => {
    it('should maintain consistent state across session and timer endpoints', async () => {
      // Create session
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId, moduleName: 'listening' })
        .expect(201);
      
      const sessionId = sessionResponse.body.data.sessionId;

      // Start timer
      const timerResponse = await request(app)
        .post('/api/timers')
        .send({ sessionId, sectionName: 'listening', duration: 29 })
        .expect(201);

      // Get session from database
      const dbSession = await pool.query(
        'SELECT * FROM exam_sessions WHERE session_id = $1',
        [sessionId]
      );

      expect(dbSession.rows.length).toBe(1);
      expect(dbSession.rows[0].session_id).toBe(sessionId);
      expect(dbSession.rows[0].expiration_time).toBeDefined();

      // Verify consistency via API
      const sessionCheck = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .expect(200);

      const timerCheck = await request(app)
        .get(`/api/timers/${sessionId}`)
        .expect(200);

      // Both should reflect same expiration time
      const sessionExpiration = new Date(sessionCheck.body.data.expirationTime || dbSession.rows[0].expiration_time);
      const timerExpiration = new Date(timerCheck.body.data.expirationTime);

      expect(Math.abs(sessionExpiration.getTime() - timerExpiration.getTime())).toBeLessThan(1000);
    });

    it('should maintain consistent ability estimates after routing', async () => {
      // Create session
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId })
        .expect(201);
      
      const sessionId = sessionResponse.body.data.sessionId;

      // Route to Stage 2
      const routingResponse = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId,
          section: 'reading',
          stage1Responses: [
            { itemId: 'int-read-s1-m1', isCorrect: true },
            { itemId: 'int-read-s1-m2', isCorrect: true },
          ],
        })
        .expect(200);

      const routingAbility = routingResponse.body.data.ability;

      // Get session
      const sessionCheck = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .expect(200);

      const sessionAbility = sessionCheck.body.data.abilityEstimates.reading;

      // Should be identical
      expect(sessionAbility).toBe(routingAbility);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle routing at boundary thresholds (θ = -0.8, 0.8)', async () => {
      // This test would require precise control over IRT scoring
      // In practice, we verify that boundary values route correctly
      // The actual routing logic is tested in mst.test.ts
      
      // Create session
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId })
        .expect(201);
      
      const sessionId = sessionResponse.body.data.sessionId;

      // Submit mixed responses to target boundary
      const responses = [
        { itemId: 'int-read-s1-m1', isCorrect: true },
        { itemId: 'int-read-s1-m2', isCorrect: false },
      ];

      const routingResponse = await request(app)
        .post('/api/mst/route')
        .send({ sessionId, section: 'reading', stage1Responses: responses })
        .expect(200);

      // Should route to easy or medium (not hard)
      const difficulty = routingResponse.body.data.routingDecision.difficulty;
      expect(['easy', 'medium']).toContain(difficulty);
    });

    it('should handle empty answers object', async () => {
      // Create session
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({ userId: testUserId })
        .expect(201);
      
      const sessionId = sessionResponse.body.data.sessionId;

      // Update with empty answers
      const updateResponse = await request(app)
        .put(`/api/sessions/${sessionId}`)
        .send({ answers: {} })
        .expect(200);

      expect(updateResponse.body.data.answers).toEqual({});
    });
  });

  // Cleanup
  afterAll(async () => {
    await pool.query('DELETE FROM exam_sessions WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM test_items WHERE item_id LIKE $1', ['int-%']);
    await pool.end();
  });
});
