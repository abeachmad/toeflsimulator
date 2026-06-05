/**
 * Integration tests for Adaptive Testing (MST) API routes
 * 
 * Tests all endpoints defined in mst.ts:
 * - POST /api/mst/route - Calculate ability and route to next module
 * - GET /api/modules/:difficulty - Fetch module items by difficulty
 * 
 * Task 9.4: Implement adaptive testing endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../config/database.js';

describe('MST (Adaptive Testing) API Integration Tests', () => {
  let testSessionId: string;
  const testUserId = 'test-user-mst-123';
  
  // Sample Stage 1 items with IRT parameters for testing
  const sampleStage1Items = [
    {
      item_id: 'read-s1-m1',
      section: 'reading',
      type: 'multiple-choice',
      difficulty_level: 'medium',
      stage: 1,
      content: 'What is the main idea?',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'B',
      irt_parameters: { a: 1.2, b: 0.0, c: 0.25 },
      metadata: {}
    },
    {
      item_id: 'read-s1-m2',
      section: 'reading',
      type: 'multiple-choice',
      difficulty_level: 'medium',
      stage: 1,
      content: 'Which inference is correct?',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'C',
      irt_parameters: { a: 1.0, b: 0.2, c: 0.25 },
      metadata: {}
    },
    {
      item_id: 'read-s1-m3',
      section: 'reading',
      type: 'multiple-choice',
      difficulty_level: 'medium',
      stage: 1,
      content: 'What does the author suggest?',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'A',
      irt_parameters: { a: 1.1, b: -0.1, c: 0.25 },
      metadata: {}
    }
  ];

  // Sample Stage 2 items for different difficulty levels
  const sampleStage2EasyItems = [
    {
      item_id: 'read-s2-e1',
      section: 'reading',
      type: 'multiple-choice',
      difficulty_level: 'easy',
      stage: 2,
      content: 'Easy question 1',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'A',
      irt_parameters: { a: 0.9, b: -1.0, c: 0.25 },
      metadata: {}
    },
    {
      item_id: 'read-s2-e2',
      section: 'reading',
      type: 'multiple-choice',
      difficulty_level: 'easy',
      stage: 2,
      content: 'Easy question 2',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'B',
      irt_parameters: { a: 1.0, b: -0.9, c: 0.25 },
      metadata: {}
    }
  ];

  const sampleStage2MediumItems = [
    {
      item_id: 'read-s2-m1',
      section: 'reading',
      type: 'multiple-choice',
      difficulty_level: 'medium',
      stage: 2,
      content: 'Medium question 1',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'C',
      irt_parameters: { a: 1.2, b: 0.0, c: 0.25 },
      metadata: {}
    },
    {
      item_id: 'read-s2-m2',
      section: 'reading',
      type: 'multiple-choice',
      difficulty_level: 'medium',
      stage: 2,
      content: 'Medium question 2',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'D',
      irt_parameters: { a: 1.1, b: 0.1, c: 0.25 },
      metadata: {}
    }
  ];

  const sampleStage2HardItems = [
    {
      item_id: 'read-s2-h1',
      section: 'reading',
      type: 'multiple-choice',
      difficulty_level: 'hard',
      stage: 2,
      content: 'Hard question 1',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'A',
      irt_parameters: { a: 1.5, b: 1.0, c: 0.25 },
      metadata: {}
    },
    {
      item_id: 'read-s2-h2',
      section: 'reading',
      type: 'multiple-choice',
      difficulty_level: 'hard',
      stage: 2,
      content: 'Hard question 2',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'B',
      irt_parameters: { a: 1.6, b: 1.2, c: 0.25 },
      metadata: {}
    }
  ];

  beforeAll(async () => {
    // Ensure database connection is ready
    await pool.query('SELECT 1');
    
    // Insert sample test items
    const allItems = [
      ...sampleStage1Items,
      ...sampleStage2EasyItems,
      ...sampleStage2MediumItems,
      ...sampleStage2HardItems
    ];
    
    for (const item of allItems) {
      await pool.query(
        `INSERT INTO test_items (
          item_id, section, type, difficulty_level, stage, content, 
          options, correct_answer, irt_parameters, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (item_id) DO UPDATE SET
          section = EXCLUDED.section,
          type = EXCLUDED.type,
          difficulty_level = EXCLUDED.difficulty_level,
          stage = EXCLUDED.stage,
          content = EXCLUDED.content,
          options = EXCLUDED.options,
          correct_answer = EXCLUDED.correct_answer,
          irt_parameters = EXCLUDED.irt_parameters,
          metadata = EXCLUDED.metadata`,
        [
          item.item_id,
          item.section,
          item.type,
          item.difficulty_level,
          item.stage,
          item.content,
          JSON.stringify(item.options),
          item.correct_answer,
          JSON.stringify(item.irt_parameters),
          JSON.stringify(item.metadata)
        ]
      );
    }
  });

  beforeEach(async () => {
    // Clean up and create a fresh test session before each test
    await pool.query('DELETE FROM exam_sessions WHERE user_id = $1', [testUserId]);
    
    const result = await pool.query(
      `INSERT INTO exam_sessions (
        session_id, user_id, start_time, expiration_time, status, current_section, 
        current_module, current_question, answers, ability_estimates, completed_modules
      ) VALUES (
        gen_random_uuid()::text, $1, NOW(), NOW() + INTERVAL '3 hours', 'in_progress', 'reading',
        1, 0, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
      ) RETURNING session_id`,
      [testUserId]
    );
    
    testSessionId = result.rows[0].session_id;
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM exam_sessions WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM test_items WHERE item_id LIKE $1', ['read-s%']);
    await pool.end();
  });

  describe('POST /api/mst/route - Calculate ability and route to Stage 2 module', () => {
    it('should route to easy module when ability is low (θ < -0.8)', async () => {
      // Prepare responses with mostly incorrect answers (low ability)
      const stage1Responses = [
        { itemId: 'read-s1-m1', isCorrect: false },
        { itemId: 'read-s1-m2', isCorrect: false },
        { itemId: 'read-s1-m3', isCorrect: false }
      ];

      const response = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId: testSessionId,
          section: 'reading',
          stage1Responses
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Routing completed successfully');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('ability');
      expect(response.body.data).toHaveProperty('routingDecision');
      expect(response.body.data).toHaveProperty('module');

      // Verify routing decision
      expect(response.body.data.routingDecision).toHaveProperty('difficulty', 'easy');
      expect(response.body.data.routingDecision).toHaveProperty('stage', 2);
      expect(response.body.data.routingDecision).toHaveProperty('section', 'reading');

      // Verify module structure
      expect(response.body.data.module).toHaveProperty('moduleId');
      expect(response.body.data.module).toHaveProperty('difficulty', 'easy');
      expect(response.body.data.module).toHaveProperty('stage', 2);
      expect(response.body.data.module).toHaveProperty('items');
      expect(Array.isArray(response.body.data.module.items)).toBe(true);
      expect(response.body.data.module.items.length).toBeGreaterThan(0);
    });

    it('should route to medium module when ability is moderate (-0.8 ≤ θ ≤ 0.8)', async () => {
      // Prepare responses with mixed correct/incorrect answers (medium ability)
      const stage1Responses = [
        { itemId: 'read-s1-m1', isCorrect: true },
        { itemId: 'read-s1-m2', isCorrect: false },
        { itemId: 'read-s1-m3', isCorrect: true }
      ];

      const response = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId: testSessionId,
          section: 'reading',
          stage1Responses
        })
        .expect(200);

      expect(response.body.data.routingDecision).toHaveProperty('difficulty', 'medium');
      expect(response.body.data.module).toHaveProperty('difficulty', 'medium');
    });

    it('should route to hard module when ability is high (θ > 0.8)', async () => {
      // Prepare responses with mostly correct answers (high ability)
      const stage1Responses = [
        { itemId: 'read-s1-m1', isCorrect: true },
        { itemId: 'read-s1-m2', isCorrect: true },
        { itemId: 'read-s1-m3', isCorrect: true }
      ];

      const response = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId: testSessionId,
          section: 'reading',
          stage1Responses
        })
        .expect(200);

      expect(response.body.data.routingDecision).toHaveProperty('difficulty', 'hard');
      expect(response.body.data.module).toHaveProperty('difficulty', 'hard');
    });

    it('should update session with ability estimate', async () => {
      const stage1Responses = [
        { itemId: 'read-s1-m1', isCorrect: true },
        { itemId: 'read-s1-m2', isCorrect: false },
        { itemId: 'read-s1-m3', isCorrect: true }
      ];

      await request(app)
        .post('/api/mst/route')
        .send({
          sessionId: testSessionId,
          section: 'reading',
          stage1Responses
        })
        .expect(200);

      // Verify ability estimate was stored in database
      const result = await pool.query(
        'SELECT ability_estimates FROM exam_sessions WHERE session_id = $1',
        [testSessionId]
      );

      expect(result.rows[0].ability_estimates).toHaveProperty('reading');
      expect(typeof result.rows[0].ability_estimates.reading).toBe('number');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId: '00000000-0000-0000-0000-000000000000', // Valid UUID that doesn't exist
          section: 'reading',
          stage1Responses: [
            { itemId: 'read-s1-m1', isCorrect: true }
          ]
        })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 for non-adaptive section (writing)', async () => {
      const response = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId: testSessionId,
          section: 'writing',
          stage1Responses: [
            { itemId: 'read-s1-m1', isCorrect: true }
          ]
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for non-adaptive section (speaking)', async () => {
      const response = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId: testSessionId,
          section: 'speaking',
          stage1Responses: [
            { itemId: 'read-s1-m1', isCorrect: true }
          ]
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for missing sessionId', async () => {
      const response = await request(app)
        .post('/api/mst/route')
        .send({
          section: 'reading',
          stage1Responses: [
            { itemId: 'read-s1-m1', isCorrect: true }
          ]
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for missing section', async () => {
      const response = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId: testSessionId,
          stage1Responses: [
            { itemId: 'read-s1-m1', isCorrect: true }
          ]
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for empty stage1Responses', async () => {
      const response = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId: testSessionId,
          section: 'reading',
          stage1Responses: []
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for invalid itemId in responses', async () => {
      const response = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId: testSessionId,
          section: 'reading',
          stage1Responses: [
            { itemId: '', isCorrect: true }
          ]
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should handle listening section routing', async () => {
      // Insert listening items
      const listeningItems = [
        {
          item_id: 'listen-s1-m1',
          section: 'listening',
          type: 'multiple-choice',
          difficulty_level: 'medium',
          stage: 1,
          content: 'What did you hear?',
          options: ['A', 'B', 'C', 'D'],
          correct_answer: 'A',
          irt_parameters: { a: 1.0, b: 0.0, c: 0.25 },
          metadata: {}
        }
      ];

      for (const item of listeningItems) {
        await pool.query(
          `INSERT INTO test_items (
            item_id, section, type, difficulty_level, stage, content,
            options, correct_answer, irt_parameters, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (item_id) DO NOTHING`,
          [
            item.item_id,
            item.section,
            item.type,
            item.difficulty_level,
            item.stage,
            item.content,
            JSON.stringify(item.options),
            item.correct_answer,
            JSON.stringify(item.irt_parameters),
            JSON.stringify(item.metadata)
          ]
        );
      }

      // Insert Stage 2 listening items
      await pool.query(
        `INSERT INTO test_items (
          item_id, section, type, difficulty_level, stage, content,
          options, correct_answer, irt_parameters, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (item_id) DO NOTHING`,
        [
          'listen-s2-m1',
          'listening',
          'multiple-choice',
          'medium',
          2,
          'Follow-up question',
          JSON.stringify(['A', 'B', 'C', 'D']),
          'B',
          JSON.stringify({ a: 1.1, b: 0.0, c: 0.25 }),
          JSON.stringify({})
        ]
      );

      const response = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId: testSessionId,
          section: 'listening',
          stage1Responses: [
            { itemId: 'listen-s1-m1', isCorrect: true }
          ]
        })
        .expect(200);

      expect(response.body.data.routingDecision).toHaveProperty('section', 'listening');
    });
  });

  describe('GET /api/modules/:difficulty - Fetch module items', () => {
    it('should fetch easy module items for reading section', async () => {
      const response = await request(app)
        .get('/api/modules/easy')
        .query({ section: 'reading', stage: 2 })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Module retrieved successfully');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.module).toHaveProperty('moduleId');
      expect(response.body.data.module).toHaveProperty('difficulty', 'easy');
      expect(response.body.data.module).toHaveProperty('stage', 2);
      expect(response.body.data.module).toHaveProperty('section', 'reading');
      expect(response.body.data.module).toHaveProperty('items');
      expect(Array.isArray(response.body.data.module.items)).toBe(true);
      expect(response.body.data.module.items.length).toBeGreaterThan(0);
    });

    it('should fetch medium module items', async () => {
      const response = await request(app)
        .get('/api/modules/medium')
        .query({ section: 'reading', stage: 2 })
        .expect(200);

      expect(response.body.data.module).toHaveProperty('difficulty', 'medium');
      expect(response.body.data.module.items.length).toBeGreaterThan(0);
    });

    it('should fetch hard module items', async () => {
      const response = await request(app)
        .get('/api/modules/hard')
        .query({ section: 'reading', stage: 2 })
        .expect(200);

      expect(response.body.data.module).toHaveProperty('difficulty', 'hard');
      expect(response.body.data.module.items.length).toBeGreaterThan(0);
    });

    it('should fetch Stage 1 module items', async () => {
      const response = await request(app)
        .get('/api/modules/medium')
        .query({ section: 'reading', stage: 1 })
        .expect(200);

      expect(response.body.data.module).toHaveProperty('stage', 1);
      expect(response.body.data.module.items.length).toBeGreaterThan(0);
    });

    it('should return 400 for invalid difficulty', async () => {
      const response = await request(app)
        .get('/api/modules/invalid')
        .query({ section: 'reading', stage: 2 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('Invalid difficulty level');
    });

    it('should return 400 for missing section query param', async () => {
      const response = await request(app)
        .get('/api/modules/easy')
        .query({ stage: 2 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for missing stage query param', async () => {
      const response = await request(app)
        .get('/api/modules/easy')
        .query({ section: 'reading' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for invalid section', async () => {
      const response = await request(app)
        .get('/api/modules/easy')
        .query({ section: 'invalid-section', stage: 2 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for invalid stage (out of range)', async () => {
      const response = await request(app)
        .get('/api/modules/easy')
        .query({ section: 'reading', stage: 5 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 404 when no module exists for criteria', async () => {
      // Try to fetch a module that doesn't exist
      const response = await request(app)
        .get('/api/modules/easy')
        .query({ section: 'speaking', stage: 2 })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
    });

    it('should return items with complete structure', async () => {
      const response = await request(app)
        .get('/api/modules/easy')
        .query({ section: 'reading', stage: 2 })
        .expect(200);

      const items = response.body.data.module.items;
      expect(items.length).toBeGreaterThan(0);

      // Verify first item has required fields
      const firstItem = items[0];
      expect(firstItem).toHaveProperty('id');
      expect(firstItem).toHaveProperty('section');
      expect(firstItem).toHaveProperty('type');
      expect(firstItem).toHaveProperty('difficulty_level');
      expect(firstItem).toHaveProperty('content');
      expect(firstItem).toHaveProperty('options');
      expect(firstItem).toHaveProperty('correct_answer');
      expect(firstItem).toHaveProperty('irt_parameters');
      expect(firstItem.irt_parameters).toHaveProperty('a');
      expect(firstItem.irt_parameters).toHaveProperty('b');
      expect(firstItem.irt_parameters).toHaveProperty('c');
    });
  });

  describe('MST Routing Integration - Complete flow', () => {
    it('should complete full adaptive routing flow from Stage 1 to Stage 2', async () => {
      // Step 1: Fetch Stage 1 medium module
      const stage1Module = await request(app)
        .get('/api/modules/medium')
        .query({ section: 'reading', stage: 1 })
        .expect(200);

      expect(stage1Module.body.data.module.items.length).toBeGreaterThan(0);

      // Step 2: Simulate test taker responses
      const stage1Responses = stage1Module.body.data.module.items.map((item: any, index: number) => ({
        itemId: item.id,
        isCorrect: index % 2 === 0 // Alternate correct/incorrect for medium ability
      }));

      // Step 3: Route to Stage 2
      const routingResult = await request(app)
        .post('/api/mst/route')
        .send({
          sessionId: testSessionId,
          section: 'reading',
          stage1Responses
        })
        .expect(200);

      expect(routingResult.body.data).toHaveProperty('ability');
      expect(routingResult.body.data).toHaveProperty('module');
      expect(routingResult.body.data.module.stage).toBe(2);

      // Verify ability was persisted
      const sessionCheck = await pool.query(
        'SELECT ability_estimates FROM exam_sessions WHERE session_id = $1',
        [testSessionId]
      );
      expect(sessionCheck.rows[0].ability_estimates).toHaveProperty('reading');
    });
  });
});
