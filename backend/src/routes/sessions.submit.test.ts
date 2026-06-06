/**
 * Tests for section submission endpoint
 * Requirements: 3.2, 8.1, 8.2
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../config/database.js';

describe('POST /api/sessions/:sessionId/sections/:section/submit', () => {
  let testSessionId: string;
  let testItemId: string;

  beforeAll(async () => {
    // Create a test session
    const sessionResponse = await request(app)
      .post('/api/sessions')
      .send({ userId: 'test-section-submit-user' });
    
    testSessionId = sessionResponse.body.data.sessionId;

    // Create a test item with required IRT parameters
    const itemResult = await pool.query(
      `INSERT INTO test_items (item_id, section, type, difficulty_level, stage, content, irt_parameters, correct_answer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING item_id`,
      [
        'test-submit-item-1',
        'reading',
        'multiple_choice',
        'easy',
        1,
        '{"question": "Test?"}',
        '{"a": 1.0, "b": 0.0, "c": 0.2}',
        'A'
      ]
    );
    testItemId = itemResult.rows[0].item_id;
  });

  afterAll(async () => {
    // Clean up
    await pool.query('DELETE FROM exam_sessions WHERE session_id = $1', [testSessionId]);
    await pool.query('DELETE FROM test_items WHERE item_id = $1', [testItemId]);
  });

  it('should accept answers submission and save to database', async () => {
    const response = await request(app)
      .post(`/api/sessions/${testSessionId}/sections/reading/submit`)
      .send({
        answers: [
          { itemId: testItemId, answer: 'A' }
        ]
      })
      .expect(200);

    expect(response.body.message).toBe('Section answers submitted successfully');
    expect(response.body.data.section).toBe('reading');
    expect(response.body.data.answersSubmitted).toBe(1);

    // Verify answer was saved to database (in exam_sessions.answers JSONB field)
    const dbResult = await pool.query(
      'SELECT answers FROM exam_sessions WHERE session_id = $1',
      [testSessionId]
    );

    expect(dbResult.rows.length).toBe(1);
    const answers = dbResult.rows[0].answers;
    expect(Array.isArray(answers)).toBe(true);
    expect(answers.length).toBeGreaterThan(0);
    const savedAnswer = answers.find((a: any) => a.itemId === testItemId);
    expect(savedAnswer).toBeDefined();
    expect(savedAnswer.answer).toBe('A');
  });

  it('should update existing answer if resubmitted', async () => {
    // First submission
    await request(app)
      .post(`/api/sessions/${testSessionId}/sections/reading/submit`)
      .send({
        answers: [{ itemId: testItemId, answer: 'A' }]
      })
      .expect(200);

    // Second submission with different answer
    await request(app)
      .post(`/api/sessions/${testSessionId}/sections/reading/submit`)
      .send({
        answers: [{ itemId: testItemId, answer: 'B' }]
      })
      .expect(200);

    // Verify answer was updated
    const dbResult = await pool.query(
      'SELECT answers FROM exam_sessions WHERE session_id = $1',
      [testSessionId]
    );

    expect(dbResult.rows.length).toBe(1);
    const answers = dbResult.rows[0].answers;
    const savedAnswer = answers.find((a: any) => a.itemId === testItemId);
    expect(savedAnswer).toBeDefined();
    expect(savedAnswer.answer).toBe('B');
  });

  it('should return 400 for invalid sessionId format', async () => {
    const response = await request(app)
      .post('/api/sessions/invalid-uuid/sections/reading/submit')
      .send({
        answers: [{ itemId: testItemId, answer: 'A' }]
      })
      .expect(400);

    expect(response.body.error).toBe('Bad Request');
  });

  it('should return 400 for invalid section name', async () => {
    const response = await request(app)
      .post(`/api/sessions/${testSessionId}/sections/invalid-section/submit`)
      .send({
        answers: [{ itemId: testItemId, answer: 'A' }]
      })
      .expect(400);

    expect(response.body.error).toBe('Bad Request');
  });

  it('should return 400 for missing answers array', async () => {
    const response = await request(app)
      .post(`/api/sessions/${testSessionId}/sections/reading/submit`)
      .send({})
      .expect(400);

    expect(response.body.error).toBe('Validation Error');
  });

  it('should handle multiple answers in one submission', async () => {
    // Create additional test items with unique ID
    const uniqueId = `test-submit-item-${Date.now()}`;
    const item2Result = await pool.query(
      `INSERT INTO test_items (item_id, section, type, difficulty_level, stage, content, irt_parameters, correct_answer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING item_id`,
      [
        uniqueId,
        'reading',
        'multiple_choice',
        'easy',
        1,
        '{"question": "Test 2?"}',
        '{"a": 1.0, "b": 0.0, "c": 0.2}',
        'B'
      ]
    );
    const item2Id = item2Result.rows[0].item_id;

    try {
      const response = await request(app)
        .post(`/api/sessions/${testSessionId}/sections/reading/submit`)
        .send({
          answers: [
            { itemId: testItemId, answer: 'A' },
            { itemId: item2Id, answer: 'B' }
          ]
        })
        .expect(200);

      expect(response.body.data.answersSubmitted).toBe(2);

      // Verify both answers were saved
      const dbResult = await pool.query(
        'SELECT answers FROM exam_sessions WHERE session_id = $1',
        [testSessionId]
      );
      const answers = dbResult.rows[0].answers;
      expect(answers.length).toBeGreaterThanOrEqual(2);
    } finally {
      // Clean up
      await pool.query('DELETE FROM test_items WHERE item_id = $1', [item2Id]);
    }
  });
});
