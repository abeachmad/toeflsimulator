/**
 * Integration tests for Test Content API routes
 * 
 * Tests all endpoints defined in items.ts:
 * - GET /api/items - Retrieve test items with filtering
 * - GET /api/items/:id - Get specific item by ID
 * - GET /api/items/section/:section - Get items by section
 * - GET /api/items/difficulty/:difficulty - Get items by difficulty
 * - GET /api/items/stage/:stage - Get items by stage
 * 
 * Task 9.6: Implement test content endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { pool } from '../config/database.js';

describe('Test Content API Integration Tests', () => {
  // Sample test items for different combinations
  const sampleItems = [
    // Reading items
    {
      item_id: 'test-read-s1-easy-1',
      section: 'reading',
      type: 'multiple-choice',
      difficulty_level: 'easy',
      stage: 1,
      content: 'Easy reading question for stage 1',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'A',
      irt_parameters: { a: 0.8, b: -1.2, c: 0.25 },
      metadata: { passage_id: 'p1' }
    },
    {
      item_id: 'test-read-s1-medium-1',
      section: 'reading',
      type: 'multiple-choice',
      difficulty_level: 'medium',
      stage: 1,
      content: 'Medium reading question for stage 1',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'B',
      irt_parameters: { a: 1.2, b: 0.0, c: 0.25 },
      metadata: { passage_id: 'p2' }
    },
    {
      item_id: 'test-read-s2-hard-1',
      section: 'reading',
      type: 'inference',
      difficulty_level: 'hard',
      stage: 2,
      content: 'Hard reading question for stage 2',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'C',
      irt_parameters: { a: 1.6, b: 1.5, c: 0.25 },
      metadata: { passage_id: 'p3' }
    },
    // Listening items
    {
      item_id: 'test-listen-s1-easy-1',
      section: 'listening',
      type: 'multiple-choice',
      difficulty_level: 'easy',
      stage: 1,
      content: 'Easy listening question',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'D',
      irt_parameters: { a: 0.9, b: -1.0, c: 0.25 },
      metadata: { audio_id: 'a1' }
    },
    {
      item_id: 'test-listen-s2-medium-1',
      section: 'listening',
      type: 'conversation',
      difficulty_level: 'medium',
      stage: 2,
      content: 'Medium listening question',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'A',
      irt_parameters: { a: 1.1, b: 0.2, c: 0.25 },
      metadata: { audio_id: 'a2' }
    },
    // Writing items
    {
      item_id: 'test-write-1',
      section: 'writing',
      type: 'academic-discussion',
      difficulty_level: 'medium',
      stage: 1,
      content: 'Academic discussion prompt',
      options: null,
      correct_answer: null,
      irt_parameters: { a: 1.0, b: 0.0, c: 0.0 },
      metadata: { word_limit: 100 }
    },
    // Speaking items
    {
      item_id: 'test-speak-1',
      section: 'speaking',
      type: 'listen-repeat',
      difficulty_level: 'easy',
      stage: 1,
      content: 'Repeat this sentence',
      options: null,
      correct_answer: 'Expected transcription',
      irt_parameters: { a: 1.0, b: -0.5, c: 0.0 },
      metadata: { audio_duration: 5 }
    }
  ];

  beforeAll(async () => {
    // Ensure database connection is ready
    await pool.query('SELECT 1');
    
    // Insert sample test items
    for (const item of sampleItems) {
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
          item.options ? JSON.stringify(item.options) : null,
          item.correct_answer,
          JSON.stringify(item.irt_parameters),
          JSON.stringify(item.metadata)
        ]
      );
    }
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM test_items WHERE item_id LIKE $1', ['test-%']);
    await pool.end();
  });

  describe('GET /api/items - Retrieve test items with filtering', () => {
    it('should retrieve all items without filters', async () => {
      const response = await request(app)
        .get('/api/items')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Items retrieved successfully');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('limit');
      expect(response.body.data).toHaveProperty('offset');
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(0);
    });

    it('should filter items by section', async () => {
      const response = await request(app)
        .get('/api/items')
        .query({ section: 'reading' })
        .expect(200);

      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.section).toBe('reading');
      });
    });

    it('should filter items by difficulty', async () => {
      const response = await request(app)
        .get('/api/items')
        .query({ difficulty: 'easy' })
        .expect(200);

      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.difficulty_level).toBe('easy');
      });
    });

    it('should filter items by stage', async () => {
      const response = await request(app)
        .get('/api/items')
        .query({ stage: 1 })
        .expect(200);

      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.stage).toBe(1);
      });
    });

    it('should filter items by type', async () => {
      const response = await request(app)
        .get('/api/items')
        .query({ type: 'multiple-choice' })
        .expect(200);

      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.type).toBe('multiple-choice');
      });
    });

    it('should filter items by multiple criteria', async () => {
      const response = await request(app)
        .get('/api/items')
        .query({
          section: 'reading',
          difficulty: 'medium',
          stage: 1
        })
        .expect(200);

      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.section).toBe('reading');
        expect(item.difficulty_level).toBe('medium');
        expect(item.stage).toBe(1);
      });
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/items')
        .query({ limit: 2 })
        .expect(200);

      expect(response.body.data.items.length).toBeLessThanOrEqual(2);
      expect(response.body.data.limit).toBe(2);
    });

    it('should respect offset parameter', async () => {
      const response1 = await request(app)
        .get('/api/items')
        .query({ section: 'reading', limit: 1, offset: 0 })
        .expect(200);

      const response2 = await request(app)
        .get('/api/items')
        .query({ section: 'reading', limit: 1, offset: 1 })
        .expect(200);

      if (response1.body.data.items.length > 0 && response2.body.data.items.length > 0) {
        expect(response1.body.data.items[0].id).not.toBe(response2.body.data.items[0].id);
      }
    });

    it('should enforce maximum limit of 100', async () => {
      const response = await request(app)
        .get('/api/items')
        .query({ limit: 100 })
        .expect(200);

      expect(response.body.data.limit).toBe(100);
      
      // Verify that requesting a limit over 100 returns an error due to validation
      const overLimitResponse = await request(app)
        .get('/api/items')
        .query({ limit: 200 })
        .expect(400);
      
      expect(overLimitResponse.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for invalid section', async () => {
      const response = await request(app)
        .get('/api/items')
        .query({ section: 'invalid-section' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for invalid difficulty', async () => {
      const response = await request(app)
        .get('/api/items')
        .query({ difficulty: 'super-hard' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for invalid stage', async () => {
      const response = await request(app)
        .get('/api/items')
        .query({ stage: 5 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return items with complete structure', async () => {
      const response = await request(app)
        .get('/api/items')
        .query({ section: 'reading', limit: 1 })
        .expect(200);

      expect(response.body.data.items.length).toBeGreaterThan(0);
      const item = response.body.data.items[0];
      
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('section');
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('difficulty_level');
      expect(item).toHaveProperty('stage');
      expect(item).toHaveProperty('content');
      expect(item).toHaveProperty('irt_parameters');
      expect(item.irt_parameters).toHaveProperty('a');
      expect(item.irt_parameters).toHaveProperty('b');
      expect(item.irt_parameters).toHaveProperty('c');
      expect(item).toHaveProperty('metadata');
      expect(item).toHaveProperty('created_at');
      expect(item).toHaveProperty('updated_at');
    });
  });

  describe('GET /api/items/:id - Get specific item by ID', () => {
    it('should retrieve a specific item by ID', async () => {
      const response = await request(app)
        .get('/api/items/test-read-s1-easy-1')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Item retrieved successfully');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('item');
      expect(response.body.data.item.id).toBe('test-read-s1-easy-1');
      expect(response.body.data.item.section).toBe('reading');
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(app)
        .get('/api/items/non-existent-item')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body.message).toContain('not found');
    });

    it('should return item with complete structure', async () => {
      const response = await request(app)
        .get('/api/items/test-read-s2-hard-1')
        .expect(200);

      const item = response.body.data.item;
      expect(item).toHaveProperty('id', 'test-read-s2-hard-1');
      expect(item).toHaveProperty('section', 'reading');
      expect(item).toHaveProperty('type', 'inference');
      expect(item).toHaveProperty('difficulty_level', 'hard');
      expect(item).toHaveProperty('stage', 2);
      expect(item).toHaveProperty('content');
      expect(item).toHaveProperty('options');
      expect(item).toHaveProperty('correct_answer');
      expect(item).toHaveProperty('irt_parameters');
      expect(item).toHaveProperty('metadata');
    });
  });

  describe('GET /api/items/section/:section - Get items by section', () => {
    it('should retrieve all reading items', async () => {
      const response = await request(app)
        .get('/api/items/section/reading')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('reading');
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('section', 'reading');
      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.section).toBe('reading');
      });
    });

    it('should retrieve all listening items', async () => {
      const response = await request(app)
        .get('/api/items/section/listening')
        .expect(200);

      expect(response.body.data.section).toBe('listening');
      response.body.data.items.forEach((item: any) => {
        expect(item.section).toBe('listening');
      });
    });

    it('should retrieve all writing items', async () => {
      const response = await request(app)
        .get('/api/items/section/writing')
        .expect(200);

      expect(response.body.data.section).toBe('writing');
      response.body.data.items.forEach((item: any) => {
        expect(item.section).toBe('writing');
      });
    });

    it('should retrieve all speaking items', async () => {
      const response = await request(app)
        .get('/api/items/section/speaking')
        .expect(200);

      expect(response.body.data.section).toBe('speaking');
      response.body.data.items.forEach((item: any) => {
        expect(item.section).toBe('speaking');
      });
    });

    it('should return 400 for invalid section', async () => {
      const response = await request(app)
        .get('/api/items/section/invalid-section')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('Invalid section');
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/items/section/reading')
        .query({ limit: 1 })
        .expect(200);

      expect(response.body.data.items.length).toBeLessThanOrEqual(1);
    });

    it('should respect offset parameter', async () => {
      const response = await request(app)
        .get('/api/items/section/reading')
        .query({ offset: 10 })
        .expect(200);

      expect(response.body.data.offset).toBe(10);
    });
  });

  describe('GET /api/items/difficulty/:difficulty - Get items by difficulty', () => {
    it('should retrieve all easy items', async () => {
      const response = await request(app)
        .get('/api/items/difficulty/easy')
        .expect(200);

      expect(response.body.data).toHaveProperty('difficulty', 'easy');
      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.difficulty_level).toBe('easy');
      });
    });

    it('should retrieve all medium items', async () => {
      const response = await request(app)
        .get('/api/items/difficulty/medium')
        .expect(200);

      expect(response.body.data).toHaveProperty('difficulty', 'medium');
      response.body.data.items.forEach((item: any) => {
        expect(item.difficulty_level).toBe('medium');
      });
    });

    it('should retrieve all hard items', async () => {
      const response = await request(app)
        .get('/api/items/difficulty/hard')
        .expect(200);

      expect(response.body.data).toHaveProperty('difficulty', 'hard');
      response.body.data.items.forEach((item: any) => {
        expect(item.difficulty_level).toBe('hard');
      });
    });

    it('should filter by section', async () => {
      const response = await request(app)
        .get('/api/items/difficulty/easy')
        .query({ section: 'reading' })
        .expect(200);

      response.body.data.items.forEach((item: any) => {
        expect(item.difficulty_level).toBe('easy');
        expect(item.section).toBe('reading');
      });
    });

    it('should filter by stage', async () => {
      const response = await request(app)
        .get('/api/items/difficulty/easy')
        .query({ stage: 1 })
        .expect(200);

      response.body.data.items.forEach((item: any) => {
        expect(item.difficulty_level).toBe('easy');
        expect(item.stage).toBe(1);
      });
    });

    it('should filter by both section and stage', async () => {
      const response = await request(app)
        .get('/api/items/difficulty/easy')
        .query({ section: 'listening', stage: 1 })
        .expect(200);

      response.body.data.items.forEach((item: any) => {
        expect(item.difficulty_level).toBe('easy');
        expect(item.section).toBe('listening');
        expect(item.stage).toBe(1);
      });
    });

    it('should return 400 for invalid difficulty', async () => {
      const response = await request(app)
        .get('/api/items/difficulty/impossible')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('Invalid difficulty');
    });
  });

  describe('GET /api/items/stage/:stage - Get items by stage', () => {
    it('should retrieve all stage 1 items', async () => {
      const response = await request(app)
        .get('/api/items/stage/1')
        .expect(200);

      expect(response.body.data).toHaveProperty('stage', 1);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.stage).toBe(1);
      });
    });

    it('should retrieve all stage 2 items', async () => {
      const response = await request(app)
        .get('/api/items/stage/2')
        .expect(200);

      expect(response.body.data).toHaveProperty('stage', 2);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.stage).toBe(2);
      });
    });

    it('should filter by section', async () => {
      const response = await request(app)
        .get('/api/items/stage/1')
        .query({ section: 'reading' })
        .expect(200);

      response.body.data.items.forEach((item: any) => {
        expect(item.stage).toBe(1);
        expect(item.section).toBe('reading');
      });
    });

    it('should filter by difficulty', async () => {
      const response = await request(app)
        .get('/api/items/stage/2')
        .query({ difficulty: 'hard' })
        .expect(200);

      response.body.data.items.forEach((item: any) => {
        expect(item.stage).toBe(2);
        expect(item.difficulty_level).toBe('hard');
      });
    });

    it('should filter by both section and difficulty', async () => {
      const response = await request(app)
        .get('/api/items/stage/1')
        .query({ section: 'reading', difficulty: 'easy' })
        .expect(200);

      response.body.data.items.forEach((item: any) => {
        expect(item.stage).toBe(1);
        expect(item.section).toBe('reading');
        expect(item.difficulty_level).toBe('easy');
      });
    });

    it('should return 400 for invalid stage', async () => {
      const response = await request(app)
        .get('/api/items/stage/5')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('Invalid stage');
    });

    it('should return 400 for non-numeric stage', async () => {
      const response = await request(app)
        .get('/api/items/stage/abc')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
    });
  });

  describe('Integration - Complete workflow', () => {
    it('should fetch items for a complete reading section flow', async () => {
      // Step 1: Get all reading items
      const allReadingItems = await request(app)
        .get('/api/items/section/reading')
        .expect(200);

      expect(allReadingItems.body.data.total).toBeGreaterThan(0);

      // Step 2: Get stage 1 medium items for reading
      const stage1Items = await request(app)
        .get('/api/items')
        .query({ section: 'reading', stage: 1, difficulty: 'medium' })
        .expect(200);

      expect(stage1Items.body.data.items.length).toBeGreaterThan(0);

      // Step 3: Get a specific item
      const itemId = stage1Items.body.data.items[0].id;
      const specificItem = await request(app)
        .get(`/api/items/${itemId}`)
        .expect(200);

      expect(specificItem.body.data.item.id).toBe(itemId);
    });

    it('should handle pagination correctly for large result sets', async () => {
      // Fetch first page
      const page1 = await request(app)
        .get('/api/items')
        .query({ limit: 2, offset: 0 })
        .expect(200);

      // Fetch second page
      const page2 = await request(app)
        .get('/api/items')
        .query({ limit: 2, offset: 2 })
        .expect(200);

      // Items should be different
      if (page1.body.data.items.length > 0 && page2.body.data.items.length > 0) {
        const page1Ids = page1.body.data.items.map((item: any) => item.id);
        const page2Ids = page2.body.data.items.map((item: any) => item.id);
        
        page2Ids.forEach((id: string) => {
          expect(page1Ids).not.toContain(id);
        });
      }
    });
  });
});
