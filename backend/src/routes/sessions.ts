/**
 * Session Management REST API Routes
 * 
 * Implements Task 9.2: Session management endpoints
 * 
 * Provides HTTP endpoints for:
 * - Creating new exam sessions
 * - Retrieving session state
 * - Updating session state
 * - Deleting sessions
 * - Marking modules as completed
 * - Updating ability estimates
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SessionManager, ModuleName } from '../services/SessionManager.js';
import { pool } from '../config/database.js';
import { IRT3PLScorer } from '../services/IRT3PLScorer.js';
import { Item, ItemResponse, Section } from '../models/irt.types.js';

const router = Router();

// Initialize SessionManager with database pool
const sessionManager = new SessionManager(pool);

// Initialize IRT Scorer for reading/listening sections
const irtScorer = new IRT3PLScorer(pool);

/**
 * Zod validation schemas
 */

// Schema for creating a new session
const createSessionSchema = z.object({
  userId: z.string()
    .min(1, 'userId is required')
    .max(255, 'userId must not exceed 255 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'userId must contain only alphanumeric characters, hyphens, and underscores'),
  moduleName: z.enum(['reading', 'writing', 'listening', 'speaking']).optional(),
});

// Schema for updating session state
const updateSessionSchema = z.object({
  moduleName: z.enum(['reading', 'writing', 'listening', 'speaking']).optional(),
  status: z.enum(['not_started', 'in_progress', 'paused', 'completed', 'expired']).optional(),
  currentQuestion: z.number().int().min(0).optional(),
  answers: z.record(z.any()).optional(),
  score: z.number().nullable().optional(),
  currentSection: z.string().nullable().optional(),
  currentModule: z.number().int().nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

// Schema for sessionId validation (UUID format)
const sessionIdSchema = z.string().uuid('sessionId must be a valid UUID');

// Schema for marking module completed
// const moduleCompleteSchema = z.object({
//   moduleId: z.string().min(1, 'moduleId is required'),
// });

// Schema for updating ability estimate
const abilityUpdateSchema = z.object({
  theta: z.number().min(-3).max(3, 'theta must be between -3 and 3'),
});

// Schema for section submission (Requirements 3.2, 8.1, 8.2)
const sectionSubmitSchema = z.object({
  answers: z.array(z.object({
    itemId: z.string().min(1, 'itemId is required'),
    answer: z.string(), // String representation of answer
  })),
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
 * POST /api/sessions
 * Create a new exam session
 * 
 * Request body: { userId: string, moduleName?: ModuleName }
 * Response: SessionState object
 */
router.post('/', validateRequest(createSessionSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, moduleName } = req.body;
    
    const session = await sessionManager.createSession({
      userId,
      moduleName: moduleName as ModuleName | undefined,
    });
    
    res.status(201).json({
      message: 'Session created successfully',
      data: session,
    });
  } catch (error) {
    console.error('Error creating session:', error);
    next(error);
  }
});

/**
 * GET /api/sessions/:sessionId
 * Get session by ID
 * 
 * Path params: sessionId (string)
 * Response: SessionState object
 */
router.get('/:sessionId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sessionId } = req.params;
    
    // Validate sessionId format
    const validationResult = sessionIdSchema.safeParse(sessionId);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid sessionId format',
        details: validationResult.error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }
    
    const session = await sessionManager.getSession(validationResult.data);
    
    res.status(200).json({
      message: 'Session retrieved successfully',
      data: session,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    console.error('Error retrieving session:', error);
    next(error);
  }
});

/**
 * PUT /api/sessions/:sessionId
 * Update session state
 * 
 * Path params: sessionId (string)
 * Request body: Partial session state (see updateSessionSchema)
 * Response: Updated SessionState object
 */
router.put('/:sessionId', validateRequest(updateSessionSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sessionId } = req.params;
    
    // Validate sessionId format
    const validationResult = sessionIdSchema.safeParse(sessionId);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid sessionId format',
        details: validationResult.error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }
    
    // Transform data if needed
    const updateData = { ...req.body };
    
    const session = await sessionManager.persistSession(validationResult.data, updateData);
    
    res.status(200).json({
      message: 'Session updated successfully',
      data: session,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    console.error('Error updating session:', error);
    next(error);
  }
});

/**
 * DELETE /api/sessions/:sessionId
 * Delete a session
 * 
 * Path params: sessionId (string)
 * Response: Success message
 */
router.delete('/:sessionId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sessionId } = req.params;
    
    // Validate sessionId format
    const validationResult = sessionIdSchema.safeParse(sessionId);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid sessionId format',
        details: validationResult.error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }
    
    await sessionManager.deleteSession(validationResult.data);
    
    res.status(200).json({
      message: 'Session deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    next(error);
  }
});

/**
 * POST /api/sessions/:sessionId/modules/:moduleId/complete
 * Mark a module as completed
 * 
 * Path params: sessionId (string), moduleId (string)
 * Response: Success message
 */
router.post('/:sessionId/modules/:moduleId/complete', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sessionId, moduleId } = req.params;
    
    if (!sessionId || !moduleId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'sessionId and moduleId are required',
      });
      return;
    }
    
    await sessionManager.markModuleCompleted(sessionId, moduleId);
    
    res.status(200).json({
      message: `Module ${moduleId} marked as completed`,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    console.error('Error marking module completed:', error);
    next(error);
  }
});

/**
 * PUT /api/sessions/:sessionId/ability/:section
 * Update ability estimate for a section
 * 
 * Path params: sessionId (string), section (string)
 * Request body: { theta: number }
 * Response: Success message
 */
router.put('/:sessionId/ability/:section', validateRequest(abilityUpdateSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sessionId, section } = req.params;
    const { theta } = req.body;
    
    if (!sessionId || !section) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'sessionId and section are required',
      });
      return;
    }
    
    // Validate section name
    const validSections = ['reading', 'writing', 'listening', 'speaking'];
    if (!validSections.includes(section)) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Invalid section. Must be one of: ${validSections.join(', ')}`,
      });
      return;
    }
    
    await sessionManager.updateAbilityEstimate(sessionId, section, theta);
    
    res.status(200).json({
      message: `Ability estimate updated for section ${section}`,
      data: {
        section,
        theta,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    console.error('Error updating ability estimate:', error);
    next(error);
  }
});

/**
 * POST /api/sessions/:sessionId/sections/:section/submit
 * Submit answers for a section and save to database
 * Requirements: 3.2, 8.1, 8.2
 * 
 * Path params: sessionId (string), section (string)
 * Request body: { answers: Array<{ itemId: string, answer: string }> }
 * Response: Success message
 */
router.post('/:sessionId/sections/:section/submit', validateRequest(sectionSubmitSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sessionId, section } = req.params;
    const { answers } = req.body;
    
    // Validate required parameters
    if (!sessionId || !section) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'sessionId and section are required',
      });
      return;
    }
    
    console.log('[Section Submit] Received submission:', {
      sessionId,
      section,
      answerCount: answers.length
    });
    
    // Validate sessionId format
    const validationResult = sessionIdSchema.safeParse(sessionId);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid sessionId format',
        details: validationResult.error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }
    
    // Validate section name
    const validSections = ['reading', 'listening', 'writing', 'speaking'];
    if (!validSections.includes(section)) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Invalid section. Must be one of: ${validSections.join(', ')}`,
      });
      return;
    }
    
    // Get current session to retrieve existing answers
    const sessionResult = await pool.query(
      'SELECT answers FROM exam_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Session not found',
      });
      return;
    }

    // Merge new answers with existing answers (Requirement 8.1, 8.2)
    let existingAnswers = sessionResult.rows[0].answers || [];
    
    // Ensure existingAnswers is an array
    if (!Array.isArray(existingAnswers)) {
      existingAnswers = [];
    }
    
    const answersMap = new Map<string, string>();
    
    // Load existing answers into map
    for (const ans of existingAnswers) {
      if (ans.itemId) {
        answersMap.set(ans.itemId, ans.answer);
      }
    }
    
    // Update with new answers
    for (const { itemId, answer } of answers) {
      answersMap.set(itemId, answer);
    }
    
    // Convert map back to array
    const updatedAnswers = Array.from(answersMap.entries()).map(([itemId, answer]) => ({
      itemId,
      answer
    }));

    // Save updated answers to session
    await pool.query(
      'UPDATE exam_sessions SET answers = $1, updated_at = NOW() WHERE session_id = $2',
      [JSON.stringify(updatedAnswers), sessionId]
    );
    
    console.log('[Section Submit] Saved answers to database:', {
      sessionId,
      section,
      count: answers.length,
      totalAnswers: updatedAnswers.length
    });
    
    // Calculate score for reading/listening sections (IRT-based)
    // Requirements: 9.1, 9.2, 9.3, 9.4
    if (section === 'reading' || section === 'listening') {
      try {
        console.log('[Section Submit] Calculating IRT score for section:', section);
        
        // Fetch items for this section with IRT parameters
        const itemsResult = await pool.query<Item>(
          `SELECT item_id as id, section, type, difficulty_level, content, options, correct_answer, irt_parameters, metadata
           FROM test_items
           WHERE section = $1`,
          [section]
        );
        
        const items = itemsResult.rows;
        
        if (items.length === 0) {
          console.warn('[Section Submit] No items found for section:', section);
          res.status(200).json({
            message: 'Section answers submitted successfully (no items to score)',
            data: {
              section,
              answersSubmitted: answers.length
            }
          });
          return;
        }
        
        // Convert submitted answers to ItemResponse format
        const responses: ItemResponse[] = answers.map((ans: { itemId: string, answer: string }) => {
          const item = items.find(it => it.id === ans.itemId);
          const isCorrect = item ? item.correct_answer === ans.answer : false;
          
          return {
            itemId: ans.itemId,
            isCorrect
          };
        });
        
        // Calculate theta (ability estimate) using IRT 3PL MLE
        const theta = irtScorer.estimateAbilityMLE(responses, items);
        console.log('[Section Submit] Estimated theta:', theta);
        
        // Convert theta to CEFR band and scale score
        const cefrBand = await irtScorer.convertToCEFR(theta, section as Section);
        const scaleScore = await irtScorer.convertToScaleScore(theta, section as Section);
        
        // Clamp scores to valid ranges
        const clampedScores = irtScorer.clampScores({ cefrBand, scaleScore });
        
        console.log('[Section Submit] Calculated scores:', {
          theta,
          cefrBand: clampedScores.cefrBand,
          scaleScore: clampedScores.scaleScore
        });
        
        // Count correct answers
        const correctCount = responses.filter(r => r.isCorrect).length;
        
        res.status(200).json({
          message: 'Section answers submitted successfully',
          data: {
            section,
            answersSubmitted: answers.length,
            score: {
              cefrBand: clampedScores.cefrBand,
              scaleScore: clampedScores.scaleScore,
              theta
            },
            correct: correctCount,
            total: responses.length
          }
        });
        return;
      } catch (error) {
        console.error('[Section Submit] Error calculating IRT score:', error);
        // Fall through to return basic success response
      }
    }
    
    // For writing/speaking sections (graded separately via Gemini API)
    res.status(200).json({
      message: 'Section answers submitted successfully',
      data: {
        section,
        answersSubmitted: answers.length
      }
    });
  } catch (error) {
    console.error('[Section Submit] Error submitting section:', error);
    next(error);
  }
});

export default router;
