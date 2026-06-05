/**
 * Test Content REST API Routes
 * 
 * Implements Task 9.6: Test content endpoints
 * 
 * Provides HTTP endpoints for:
 * - Retrieving test items by section, difficulty, and stage
 * - Fetching specific items by ID
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { Section, DifficultyLevel } from '../models/irt.types.js';

const router = Router();

/**
 * Zod validation schemas
 */

// Schema for items query parameters
const itemsQuerySchema = z.object({
  section: z.enum(['reading', 'listening', 'writing', 'speaking']).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  stage: z.coerce.number().int().min(1).max(2).optional(),
  type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * GET /api/items
 * Retrieve test items with optional filtering
 * 
 * Query params:
 *   - section: 'reading' | 'listening' | 'writing' | 'speaking' (optional)
 *   - difficulty: 'easy' | 'medium' | 'hard' (optional)
 *   - stage: 1 | 2 (optional)
 *   - type: string (optional) - item type like 'multiple-choice', 'fill-blank', etc.
 *   - limit: number (optional, default: 50, max: 100)
 *   - offset: number (optional, default: 0)
 * 
 * Response: {
 *   items: Item[],
 *   total: number,
 *   limit: number,
 *   offset: number
 * }
 * 
 * Validates: Requirement 16.2 (Database schema implementation)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate query parameters
    const validationResult = itemsQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid query parameters',
        details: validationResult.error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }
    
    const { section, difficulty, stage, type, limit, offset } = validationResult.data;
    
    // Build dynamic query
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    if (section) {
      conditions.push(`section = $${paramIndex}`);
      params.push(section);
      paramIndex++;
    }
    
    if (difficulty) {
      conditions.push(`difficulty_level = $${paramIndex}`);
      params.push(difficulty);
      paramIndex++;
    }
    
    if (stage) {
      conditions.push(`stage = $${paramIndex}`);
      params.push(stage);
      paramIndex++;
    }
    
    if (type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM test_items
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);
    
    // Get items with pagination
    const itemsQuery = `
      SELECT 
        item_id as id,
        section,
        type,
        difficulty_level,
        stage,
        content,
        options,
        correct_answer,
        irt_parameters,
        metadata,
        created_at,
        updated_at
      FROM test_items
      ${whereClause}
      ORDER BY section, stage, difficulty_level, created_at
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const itemsResult = await pool.query(itemsQuery, [...params, limit, offset]);
    
    console.log(`[Items API] Retrieved ${itemsResult.rows.length} items (total: ${total})`);
    
    res.status(200).json({
      message: 'Items retrieved successfully',
      data: {
        items: itemsResult.rows,
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    next(error);
  }
});

/**
 * GET /api/items/:id
 * Retrieve a specific test item by ID
 * 
 * Path params: id (string) - the item_id
 * 
 * Response: {
 *   item: Item
 * }
 * 
 * Validates: Requirement 16.2 (Database schema implementation)
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Item ID is required',
      });
      return;
    }
    
    const query = `
      SELECT 
        item_id as id,
        section,
        type,
        difficulty_level,
        stage,
        content,
        options,
        correct_answer,
        irt_parameters,
        metadata,
        created_at,
        updated_at
      FROM test_items
      WHERE item_id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      res.status(404).json({
        error: 'Not Found',
        message: `Item with ID ${id} not found`,
      });
      return;
    }
    
    console.log(`[Items API] Retrieved item: ${id}`);
    
    res.status(200).json({
      message: 'Item retrieved successfully',
      data: {
        item: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    next(error);
  }
});

/**
 * GET /api/items/section/:section
 * Retrieve all items for a specific section
 * 
 * Path params: section ('reading' | 'listening' | 'writing' | 'speaking')
 * Query params:
 *   - limit: number (optional, default: 50, max: 100)
 *   - offset: number (optional, default: 0)
 * 
 * Response: {
 *   items: Item[],
 *   total: number,
 *   section: string
 * }
 */
router.get('/section/:section', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { section } = req.params;
    
    // Validate section
    const validSections: Section[] = ['reading', 'listening', 'writing', 'speaking'];
    if (!validSections.includes(section as Section)) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Invalid section. Must be one of: ${validSections.join(', ')}`,
      });
      return;
    }
    
    // Parse limit and offset from query params
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const offset = parseInt(req.query.offset as string, 10) || 0;
    
    // Get total count for section
    const countQuery = 'SELECT COUNT(*) as total FROM test_items WHERE section = $1';
    const countResult = await pool.query(countQuery, [section]);
    const total = parseInt(countResult.rows[0].total, 10);
    
    // Get items
    const itemsQuery = `
      SELECT 
        item_id as id,
        section,
        type,
        difficulty_level,
        stage,
        content,
        options,
        correct_answer,
        irt_parameters,
        metadata,
        created_at,
        updated_at
      FROM test_items
      WHERE section = $1
      ORDER BY stage, difficulty_level, created_at
      LIMIT $2 OFFSET $3
    `;
    
    const itemsResult = await pool.query(itemsQuery, [section, limit, offset]);
    
    console.log(`[Items API] Retrieved ${itemsResult.rows.length} items for section ${section}`);
    
    res.status(200).json({
      message: `Items for section ${section} retrieved successfully`,
      data: {
        items: itemsResult.rows,
        total,
        section,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching items by section:', error);
    next(error);
  }
});

/**
 * GET /api/items/difficulty/:difficulty
 * Retrieve all items for a specific difficulty level
 * 
 * Path params: difficulty ('easy' | 'medium' | 'hard')
 * Query params:
 *   - section: string (optional) - filter by section
 *   - stage: number (optional) - filter by stage
 *   - limit: number (optional, default: 50, max: 100)
 *   - offset: number (optional, default: 0)
 * 
 * Response: {
 *   items: Item[],
 *   total: number,
 *   difficulty: string
 * }
 */
router.get('/difficulty/:difficulty', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { difficulty } = req.params;
    
    // Validate difficulty
    const validDifficulties: DifficultyLevel[] = ['easy', 'medium', 'hard'];
    if (!validDifficulties.includes(difficulty as DifficultyLevel)) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Invalid difficulty level. Must be one of: ${validDifficulties.join(', ')}`,
      });
      return;
    }
    
    // Parse query parameters
    const section = req.query.section as string | undefined;
    const stage = req.query.stage ? parseInt(req.query.stage as string, 10) : undefined;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const offset = parseInt(req.query.offset as string, 10) || 0;
    
    // Build query with optional filters
    const conditions = ['difficulty_level = $1'];
    const params: any[] = [difficulty];
    let paramIndex = 2;
    
    if (section) {
      conditions.push(`section = $${paramIndex}`);
      params.push(section);
      paramIndex++;
    }
    
    if (stage) {
      conditions.push(`stage = $${paramIndex}`);
      params.push(stage);
      paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM test_items WHERE ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);
    
    // Get items
    const itemsQuery = `
      SELECT 
        item_id as id,
        section,
        type,
        difficulty_level,
        stage,
        content,
        options,
        correct_answer,
        irt_parameters,
        metadata,
        created_at,
        updated_at
      FROM test_items
      WHERE ${whereClause}
      ORDER BY section, stage, created_at
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const itemsResult = await pool.query(itemsQuery, [...params, limit, offset]);
    
    console.log(`[Items API] Retrieved ${itemsResult.rows.length} items for difficulty ${difficulty}`);
    
    res.status(200).json({
      message: `Items for difficulty ${difficulty} retrieved successfully`,
      data: {
        items: itemsResult.rows,
        total,
        difficulty,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching items by difficulty:', error);
    next(error);
  }
});

/**
 * GET /api/items/stage/:stage
 * Retrieve all items for a specific stage
 * 
 * Path params: stage (1 | 2)
 * Query params:
 *   - section: string (optional) - filter by section
 *   - difficulty: string (optional) - filter by difficulty
 *   - limit: number (optional, default: 50, max: 100)
 *   - offset: number (optional, default: 0)
 * 
 * Response: {
 *   items: Item[],
 *   total: number,
 *   stage: number
 * }
 */
router.get('/stage/:stage', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stage = parseInt(req.params.stage, 10);
    
    // Validate stage
    if (stage !== 1 && stage !== 2) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid stage. Must be 1 or 2',
      });
      return;
    }
    
    // Parse query parameters
    const section = req.query.section as string | undefined;
    const difficulty = req.query.difficulty as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const offset = parseInt(req.query.offset as string, 10) || 0;
    
    // Build query with optional filters
    const conditions = ['stage = $1'];
    const params: any[] = [stage];
    let paramIndex = 2;
    
    if (section) {
      conditions.push(`section = $${paramIndex}`);
      params.push(section);
      paramIndex++;
    }
    
    if (difficulty) {
      conditions.push(`difficulty_level = $${paramIndex}`);
      params.push(difficulty);
      paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM test_items WHERE ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);
    
    // Get items
    const itemsQuery = `
      SELECT 
        item_id as id,
        section,
        type,
        difficulty_level,
        stage,
        content,
        options,
        correct_answer,
        irt_parameters,
        metadata,
        created_at,
        updated_at
      FROM test_items
      WHERE ${whereClause}
      ORDER BY section, difficulty_level, created_at
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const itemsResult = await pool.query(itemsQuery, [...params, limit, offset]);
    
    console.log(`[Items API] Retrieved ${itemsResult.rows.length} items for stage ${stage}`);
    
    res.status(200).json({
      message: `Items for stage ${stage} retrieved successfully`,
      data: {
        items: itemsResult.rows,
        total,
        stage,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching items by stage:', error);
    next(error);
  }
});

export default router;
