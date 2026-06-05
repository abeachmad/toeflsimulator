/**
 * Adaptive Testing (MST) REST API Routes
 * 
 * Implements Task 9.4: Adaptive testing endpoints
 * 
 * Provides HTTP endpoints for:
 * - Calculating ability and routing to next module
 * - Fetching module items by difficulty
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { MSTEngine } from '../services/MSTEngine.js';
import { IRT3PLScorer } from '../services/IRT3PLScorer.js';
import { pool } from '../config/database.js';
import { Section, DifficultyLevel, ItemResponse } from '../models/irt.types.js';

const router = Router();
const modulesRouter = Router(); // Separate router for /api/modules endpoints

// Initialize services with database pool
const mstEngine = new MSTEngine(pool);
const irtScorer = new IRT3PLScorer(pool);

/**
 * Zod validation schemas
 */

// Schema for routing request
const routeRequestSchema = z.object({
  sessionId: z.string().uuid('sessionId must be a valid UUID'),
  section: z.enum(['reading', 'listening'], {
    errorMap: () => ({ message: 'section must be either reading or listening' }),
  }),
  stage1Responses: z.array(z.object({
    itemId: z.string().min(1, 'itemId is required').regex(/^[a-zA-Z0-9_-]+$/, 'itemId must contain only alphanumeric characters, hyphens, and underscores'),
    isCorrect: z.boolean(),
    timestamp: z.string().datetime().optional(),
  })).min(1, 'At least one response is required'),
});

// Schema for module fetch request (via query params)
const moduleFetchSchema = z.object({
  section: z.enum(['reading', 'listening', 'writing', 'speaking']),
  stage: z.coerce.number().int().min(1).max(2),
});

/**
 * Middleware for Zod validation
 */
function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * POST /api/mst/route
 * Calculate ability estimate from Stage 1 responses and route to Stage 2 module
 * 
 * Request body: {
 *   sessionId: string,
 *   section: 'reading' | 'listening',
 *   stage1Responses: Array<{ itemId: string, isCorrect: boolean, timestamp?: string }>
 * }
 * 
 * Response: {
 *   ability: number,
 *   routingDecision: { difficulty: string, stage: number, section: string },
 *   module: { moduleId: string, difficulty: string, stage: number, section: string, items: Item[] }
 * }
 * 
 * Validates: Requirements 3.4, 8.1, 8.2
 */
router.post('/route', validateRequest(routeRequestSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sessionId, section, stage1Responses } = req.body;
    
    // Verify session exists
    const sessionCheck = await pool.query(
      'SELECT session_id FROM exam_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    if (sessionCheck.rows.length === 0) {
      res.status(404).json({
        error: 'Not Found',
        message: `Session ${sessionId} not found`,
      });
      return;
    }
    
    // Check if section supports adaptive testing
    if (!mstEngine.isAdaptiveSection(section as Section)) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Section ${section} does not support adaptive routing. Only reading and listening sections use MST.`,
      });
      return;
    }
    
    // Fetch Stage 1 items from database to get IRT parameters
    const itemIds = stage1Responses.map((r: any) => r.itemId);
    const itemsQuery = `
      SELECT 
        item_id as id,
        section,
        type,
        difficulty_level,
        content,
        options,
        correct_answer,
        irt_parameters,
        metadata
      FROM test_items
      WHERE item_id = ANY($1::text[])
    `;
    
    const itemsResult = await pool.query(itemsQuery, [itemIds]);
    
    if (itemsResult.rows.length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'No valid items found for the provided itemIds',
      });
      return;
    }
    
    const items = itemsResult.rows;
    
    // Convert stage1Responses to ItemResponse format
    const responses: ItemResponse[] = stage1Responses.map((r: any) => ({
      itemId: r.itemId,
      isCorrect: r.isCorrect,
      timestamp: r.timestamp ? new Date(r.timestamp) : undefined,
    }));
    
    // Calculate ability estimate using IRT 3PL MLE
    const ability = irtScorer.estimateAbilityMLE(responses, items);
    
    console.log(`[MST Route] Ability estimated: θ=${ability.toFixed(3)} for session ${sessionId}`);
    
    // Route to Stage 2 module based on ability
    const routingDecision = mstEngine.routeToModule(ability, section as Section);
    
    console.log(`[MST Route] Routing decision: ${JSON.stringify(routingDecision)}`);
    
    // Select Stage 2 module with fallback
    const module = await mstEngine.selectNextModuleWithFallback(
      routingDecision.stage,
      routingDecision.difficulty,
      section as Section
    );
    
    // Update session with ability estimate
    await pool.query(
      `UPDATE exam_sessions 
       SET ability_estimates = COALESCE(ability_estimates, '{}'::jsonb) || jsonb_build_object($1::text, $2::numeric)
       WHERE session_id = $3`,
      [section, ability, sessionId]
    );
    
    console.log(`[MST Route] Module selected: ${module.moduleId} with ${module.items.length} items`);
    
    res.status(200).json({
      message: 'Routing completed successfully',
      data: {
        ability,
        routingDecision,
        module: {
          moduleId: module.moduleId,
          difficulty: module.difficulty,
          stage: module.stage,
          section: module.section,
          itemCount: module.items.length,
          items: module.items,
        },
      },
    });
  } catch (error) {
    console.error('Error calculating route:', error);
    
    if (error instanceof Error && error.message.includes('No module available')) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: error.message,
      });
      return;
    }
    
    next(error);
  }
});

/**
 * GET /api/modules/:difficulty
 * Fetch module items by difficulty level
 * 
 * Path params: difficulty ('easy' | 'medium' | 'hard')
 * Query params: section ('reading' | 'listening' | 'writing' | 'speaking'), stage (1 | 2)
 * 
 * Response: {
 *   module: { moduleId: string, difficulty: string, stage: number, section: string, items: Item[] }
 * }
 * 
 * Validates: Requirements 8.2
 */
modulesRouter.get('/:difficulty', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    
    // Validate query parameters
    const validationResult = moduleFetchSchema.safeParse(req.query);
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
    
    const { section, stage } = validationResult.data;
    
    // Select module using MST Engine
    const module = await mstEngine.selectNextModule(
      stage,
      difficulty as DifficultyLevel,
      section as Section
    );
    
    if (!module) {
      res.status(404).json({
        error: 'Not Found',
        message: `No module found for section=${section}, stage=${stage}, difficulty=${difficulty}`,
      });
      return;
    }
    
    console.log(`[MST Modules] Module fetched: ${module.moduleId} with ${module.items.length} items`);
    
    res.status(200).json({
      message: 'Module retrieved successfully',
      data: {
        module: {
          moduleId: module.moduleId,
          difficulty: module.difficulty,
          stage: module.stage,
          section: module.section,
          itemCount: module.items.length,
          items: module.items,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching module:', error);
    next(error);
  }
});

export default router;
export { modulesRouter };
