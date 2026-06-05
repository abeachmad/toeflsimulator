/**
 * AI Grading REST API Routes
 * 
 * Implements Task 9.5: AI grading endpoints
 * 
 * Provides HTTP endpoints for:
 * - Grading writing responses using GeminiGraderService
 * - Assessing speaking pronunciation using GeminiGraderService
 * - Retrieving grading service health status
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { GeminiGraderService } from '../services/GeminiGraderService.js';
import multer from 'multer';
import { unlink } from 'fs/promises';

const router = Router();

// Initialize GeminiGraderService with API key from environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY not found in environment. Grading endpoints will return default scores.');
}

const geminiGrader = GEMINI_API_KEY 
  ? new GeminiGraderService(GEMINI_API_KEY)
  : null;

// Configure multer for audio file uploads
const upload = multer({
  dest: 'uploads/audio/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept only audio files
    const allowedMimeTypes = ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/webm'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`));
    }
  },
});

/**
 * Zod validation schemas
 */

// Schema for writing grading request
const writingGradeSchema = z.object({
  text: z.string()
    .min(1, 'text is required and cannot be empty')
    .max(10000, 'text must not exceed 10000 characters')
    .refine(
      (val) => !val.includes('\0'), 
      { message: 'text must not contain null bytes' }
    ),
  taskType: z.enum(['build-sentence', 'email', 'academic-discussion'], {
    errorMap: () => ({ message: 'taskType must be build-sentence, email, or academic-discussion' }),
  }),
  professorPrompt: z.string().max(5000, 'professorPrompt must not exceed 5000 characters').optional(),
  peerOpinions: z.array(z.string().max(2000, 'each peerOpinion must not exceed 2000 characters')).optional(),
});

// Schema for speaking assessment request (form data)
const speakingAssessmentSchema = z.object({
  referenceText: z.string().min(1, 'referenceText is required'),
  taskType: z.enum(['listen-repeat', 'simulated-interview']).optional(),
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
 * POST /api/grade/writing
 * Grade a writing response using Gemini Flash AI
 * 
 * Request body: {
 *   text: string,
 *   taskType: 'build-sentence' | 'email' | 'academic-discussion',
 *   professorPrompt?: string,
 *   peerOpinions?: string[]
 * }
 * 
 * Response: {
 *   cefrBand: number (1-6),
 *   scaleScore: number (0-30),
 *   grammarCorrections: Array<{originalText, correctedText, errorType, explanation}>,
 *   lexicalAnalysis: {vocabularyLevel, lexicalDiversity, academicWordCount, suggestions}
 * }
 * 
 * Validates: Requirements 5.5, 5.6, 5.7, 5.8, 5.9, 17.1, 17.3
 */
router.post('/writing', validateRequest(writingGradeSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!geminiGrader) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Grading service is not configured. Please set GEMINI_API_KEY environment variable.',
      });
      return;
    }

    const { text, taskType, professorPrompt, peerOpinions } = req.body;

    console.log(`[Grade Writing] Processing ${taskType} task with ${text.length} characters`);

    const startTime = Date.now();
    const score = await geminiGrader.gradeWriting({
      text,
      taskType,
      professorPrompt,
      peerOpinions,
    });
    const duration = Date.now() - startTime;

    console.log(`[Grade Writing] Completed in ${duration}ms - CEFR: ${score.cefrBand}, Scale: ${score.scaleScore}`);

    res.status(200).json({
      message: 'Writing response graded successfully',
      data: score,
      metadata: {
        taskType,
        textLength: text.length,
        processingTime: duration,
      },
    });
  } catch (error) {
    console.error('Error grading writing response:', error);

    // If grading fails, return default scores (Requirement 19.2)
    if (geminiGrader) {
      const defaultScore = geminiGrader.getDefaultWritingScore();
      res.status(200).json({
        message: 'Writing grading completed with fallback scores due to service error',
        data: defaultScore,
        error: 'Grading service temporarily unavailable',
      });
      return;
    }

    next(error);
  }
});

/**
 * POST /api/grade/speaking
 * Assess pronunciation from an audio recording using Gemini Flash Pronunciation API
 * 
 * Request: multipart/form-data
 *   - audio: File (WAV, MP3, MP4, or WebM format, max 10MB)
 *   - referenceText: string (expected text that should be spoken)
 *   - taskType: 'listen-repeat' | 'simulated-interview' (optional)
 * 
 * Response: {
 *   accuracyScore: number (0-100),
 *   fluencyScore: number (0-100),
 *   prosodyScore: number (0-100),
 *   completenessScore: number (0-100),
 *   cefrBand: number (1-6),
 *   scaleScore: number (0-30)
 * }
 * 
 * Validates: Requirements 6.3, 6.4, 6.5, 6.6, 6.7, 17.1, 17.4, 20.3, 20.4, 20.6
 */
router.post('/speaking', upload.single('audio'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let uploadedFilePath: string | undefined;

  try {
    if (!geminiGrader) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Grading service is not configured. Please set GEMINI_API_KEY environment variable.',
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Audio file is required. Please upload a file with key "audio".',
      });
      return;
    }

    // Validate referenceText
    const validationResult = speakingAssessmentSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: validationResult.error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }

    const { referenceText, taskType } = validationResult.data;
    uploadedFilePath = req.file.path;

    console.log(`[Grade Speaking] Processing ${req.file.mimetype} audio (${req.file.size} bytes) with reference: "${referenceText}"`);

    const startTime = Date.now();
    const score = await geminiGrader.assessPronunciation(uploadedFilePath, referenceText);
    const duration = Date.now() - startTime;

    console.log(`[Grade Speaking] Completed in ${duration}ms - Accuracy: ${score.accuracyScore}, CEFR: ${score.cefrBand}`);

    res.status(200).json({
      message: 'Speaking response assessed successfully',
      data: score,
      metadata: {
        taskType: taskType || 'listen-repeat',
        audioFormat: req.file.mimetype,
        audioSize: req.file.size,
        referenceTextLength: referenceText.length,
        processingTime: duration,
      },
    });
  } catch (error) {
    console.error('Error assessing speaking pronunciation:', error);

    // If assessment fails, return default scores (Requirement 19.2)
    if (geminiGrader) {
      const defaultScore = geminiGrader.getDefaultSpeakingScore();
      res.status(200).json({
        message: 'Speaking assessment completed with fallback scores due to service error',
        data: defaultScore,
        error: 'Pronunciation assessment service temporarily unavailable',
      });
      return;
    }

    next(error);
  } finally {
    // Clean up uploaded file (Requirement 20.6)
    if (uploadedFilePath) {
      try {
        await unlink(uploadedFilePath);
        console.log(`[Grade Speaking] Cleaned up uploaded file: ${uploadedFilePath}`);
      } catch (unlinkError) {
        console.error(`[Grade Speaking] Failed to delete uploaded file ${uploadedFilePath}:`, unlinkError);
      }
    }
  }
});

/**
 * GET /api/grade/health
 * Check grading service health and circuit breaker status
 * 
 * Response: {
 *   status: 'healthy' | 'degraded' | 'unavailable',
 *   circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN',
 *   configured: boolean
 * }
 */
router.get('/health', (_req: Request, res: Response): void => {
  if (!geminiGrader) {
    res.status(503).json({
      status: 'unavailable',
      configured: false,
      message: 'Grading service is not configured',
    });
    return;
  }

  const circuitState = geminiGrader.getCircuitState();

  let status: 'healthy' | 'degraded' | 'unavailable';
  if (circuitState === 'CLOSED') {
    status = 'healthy';
  } else if (circuitState === 'HALF_OPEN') {
    status = 'degraded';
  } else {
    status = 'unavailable';
  }

  res.status(200).json({
    status,
    circuitState,
    configured: true,
    message: `Grading service is ${status}`,
  });
});

/**
 * POST /api/grade/reset
 * Reset circuit breaker (admin endpoint for recovery)
 * 
 * Response: { message: string }
 */
router.post('/reset', (_req: Request, res: Response): void => {
  if (!geminiGrader) {
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Grading service is not configured',
    });
    return;
  }

  geminiGrader.resetCircuit();
  console.log('[Grade] Circuit breaker manually reset');

  res.status(200).json({
    message: 'Circuit breaker reset successfully',
  });
});

export default router;
