import express, { Request, Response, ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { inputValidationMiddleware } from './middleware/validation.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to uploaded audio files
const AUDIO_DIR = path.join(__dirname, '../../uploads/audio');

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';

// CORS allowed origins — whitelist controlled via env var
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Security middleware - helmet for security headers
app.use(helmet());

// CORS configuration — whitelist for authorized domains (Requirement 22.3)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, Postman, server-to-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

// Response compression (Task 25.4)
app.use(compression());

// HTTP request logging (use 'dev' format in development)
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware with 10mb limit for audio uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input validation / sanitization on all API routes (Task 26.1 — Requirement 22.4)
app.use('/api/', inputValidationMiddleware);

// Rate limiting (disabled in test environment) — Requirement 22.5
if (NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 100, // 100 requests per minute per IP
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Stricter limit for grading endpoints (expensive AI calls)
  const gradingLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many grading requests. Please wait before submitting again.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/', limiter);
  app.use('/api/grade/', gradingLimiter);
}

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

// Database status check endpoint
app.get('/db-status', async (_req: Request, res: Response) => {
  try {
    const { pool } = await import('./config/database.js');
    
    // Check connection
    await pool.query('SELECT NOW()');
    
    // Check if tables exist and count items
    const itemsCount = await pool.query('SELECT COUNT(*) FROM test_items');
    const sessionsCount = await pool.query('SELECT COUNT(*) FROM exam_sessions');
    const cefrCount = await pool.query('SELECT COUNT(*) FROM cefr_conversion');
    
    // Get items by section
    const sectionCounts = await pool.query(`
      SELECT section, COUNT(*) as count 
      FROM test_items 
      GROUP BY section 
      ORDER BY section
    `);
    
    res.status(200).json({
      status: 'connected',
      timestamp: new Date().toISOString(),
      tables: {
        test_items: parseInt(itemsCount.rows[0].count),
        exam_sessions: parseInt(sessionsCount.rows[0].count),
        cefr_conversion: parseInt(cefrCount.rows[0].count),
      },
      items_by_section: sectionCounts.rows.map((r: any) => ({
        section: r.section,
        count: parseInt(r.count),
      })),
      initialized: parseInt(cefrCount.rows[0].count) > 0,
      seeded: parseInt(itemsCount.rows[0].count) >= 150,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Database connection failed',
      initialized: false,
      seeded: false,
    });
  }
});

// One-time database seeding endpoint (REMOVE AFTER FIRST USE)
app.post('/seed-database', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { pool } = await import('./config/database.js');
    const { DataLoader } = await import('./services/DataLoader.js');
    
    // Check if already seeded
    const itemsCount = await pool.query('SELECT COUNT(*) FROM test_items');
    const existingItems = parseInt(itemsCount.rows[0].count);
    
    if (existingItems >= 150) {
      res.status(200).json({
        status: 'already_seeded',
        message: 'Database already contains test items',
        existing_items: existingItems,
      });
      return;
    }
    
    console.log('🌱 Starting database seeding...');
    
    const dataLoader = new DataLoader(pool);
    
    // Generate IRT parameters helper
    function generateIRTParameters(difficulty: 'easy' | 'medium' | 'hard') {
      const params = {
        easy: { a: 1.0 + Math.random() * 0.5, b: -1.5 + Math.random() * 0.8, c: 0.2 + Math.random() * 0.05 },
        medium: { a: 1.2 + Math.random() * 0.6, b: -0.5 + Math.random() * 1.0, c: 0.15 + Math.random() * 0.1 },
        hard: { a: 1.5 + Math.random() * 0.8, b: 0.7 + Math.random() * 1.0, c: 0.1 + Math.random() * 0.1 }
      };
      return params[difficulty];
    }
    
    // Generate reading items
    const readingItems = [];
    for (let i = 0; i < 60; i++) {
      const difficulty: 'easy' | 'medium' | 'hard' = i < 20 ? 'easy' : i < 40 ? 'medium' : 'hard';
      const stage = i < 30 ? 1 : 2;
      readingItems.push({
        id: `reading-${i + 1}`,
        section: 'reading' as const,
        type: 'academic-passage',
        difficulty_level: difficulty,
        stage,
        content: JSON.stringify({
          passage: `Sample academic passage ${i + 1} about various topics.`,
          question: `What is the main idea of paragraph ${i % 5 + 1}?`
        }),
        options: ['Main idea A', 'Main idea B', 'Main idea C', 'Main idea D'],
        correct_answer: 'Main idea A',
        ...generateIRTParameters(difficulty),
        metadata: { dataset: 'Synthetic', stage }
      });
    }
    
    // Generate listening items
    const listeningItems = [];
    const listeningTypes = ['conversation', 'academic-lecture', 'choose-response'];
    for (let i = 0; i < 60; i++) {
      const type = listeningTypes[i % listeningTypes.length];
      const difficulty: 'easy' | 'medium' | 'hard' = i < 20 ? 'easy' : i < 40 ? 'medium' : 'hard';
      const stage = i < 30 ? 1 : 2;
      listeningItems.push({
        id: `listening-${i + 1}`,
        section: 'listening' as const,
        type,
        difficulty_level: difficulty,
        stage,
        content: JSON.stringify({ question: `Listening question ${i + 1}`, audioUrl: `/audio/sample.mp3` }),
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correct_answer: 'Option A',
        ...generateIRTParameters(difficulty),
        metadata: { dataset: 'Synthetic', stage }
      });
    }
    
    // Generate writing items
    const writingItems = [];
    const writingTypes = ['build-sentence', 'email', 'academic-discussion'];
    for (let i = 0; i < 30; i++) {
      const type = writingTypes[i % writingTypes.length];
      const difficulty: 'easy' | 'medium' | 'hard' = 'medium';
      const stage = i < 15 ? 1 : 2;
      writingItems.push({
        id: `writing-${i + 1}`,
        section: 'writing' as const,
        type,
        difficulty_level: difficulty,
        stage,
        content: JSON.stringify({ prompt: `Writing prompt ${i + 1}` }),
        correct_answer: '',
        ...generateIRTParameters(difficulty),
        metadata: { dataset: 'Synthetic', rubric: 'TOEFL-Writing-2026', stage }
      });
    }
    
    // Generate speaking items
    const speakingItems = [];
    for (let i = 0; i < 15; i++) {
      const difficulty: 'easy' | 'medium' | 'hard' = i < 5 ? 'easy' : i < 10 ? 'medium' : 'hard';
      speakingItems.push({
        id: `speaking-${i + 1}`,
        section: 'speaking' as const,
        type: 'simulated-interview',
        difficulty_level: difficulty,
        content: JSON.stringify({ question: `Speaking question ${i + 1}`, preparationTime: 15, responseTime: 45 }),
        correct_answer: '',
        ...generateIRTParameters(difficulty),
        metadata: { dataset: 'Synthetic' }
      });
    }
    
    const allItems = [
      ...readingItems,
      ...listeningItems,
      ...writingItems,
      ...speakingItems
    ];
    
    console.log(`📦 Generated ${allItems.length} test items`);
    
    const result = await dataLoader.loadTestItems(allItems, { 
      skipDuplicates: true,
      updateOnConflict: false
    });
    
    console.log(`✅ Inserted ${result.inserted} items`);
    
    res.status(200).json({
      status: 'success',
      message: 'Database seeded successfully',
      items_inserted: result.inserted,
      items_failed: result.failed.length,
      breakdown: {
        reading: readingItems.length,
        listening: listeningItems.length,
        writing: writingItems.length,
        speaking: speakingItems.length
      }
    });
    
  } catch (error) {
    console.error('Seeding error:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Seeding failed'
    });
  }
});
      message: 'Database seeded successfully',
      items_inserted: result.inserted,
      items_failed: result.failed.length,
      breakdown: {
        reading: readingItems.length,
        listening: 60,
        writing: 30,
        speaking: 15
      }
    });
    
  } catch (error) {
    console.error('Seeding error:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Seeding failed'
    });
  }
});

// API root endpoint
app.get('/api', (_req: Request, res: Response) => {
  res.json({ 
    message: 'TOEFL iBT 2026 Test Simulator API',
    version: '1.0.0',
    environment: NODE_ENV,
    endpoints: {
      health: '/health',
      sessions: '/api/sessions',
      timers: '/api/timers',
      items: '/api/items',
      grading: '/api/grade',
      mst: '/api/mst',
    },
  });
});

// API routes
import sessionRoutes from './routes/sessions.js';
import timerRoutes from './routes/timers.js';
import mstRoutes, { modulesRouter } from './routes/mst.js';
import gradeRoutes from './routes/grade.js';
import itemRoutes from './routes/items.js';
import logRoutes from './routes/logs.js';
app.use('/api/sessions', sessionRoutes);
app.use('/api/timers', timerRoutes);
app.use('/api/mst', mstRoutes);
app.use('/api/modules', modulesRouter);
app.use('/api/grade', gradeRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/logs', logRoutes);

// Audio file serving — serve real files when present, 404 JSON when not
// The frontend AudioPlayer handles 404 gracefully (shows "Audio Unavailable" fallback)
app.use('/audio', express.static(AUDIO_DIR));
app.use('/audio', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Audio file not found' });
});

// 404 handler - must come after all routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: 'The requested resource does not exist',
  });
});

// Global error handling middleware - must be last
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('Error:', err);
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: NODE_ENV === 'development' ? err : undefined,
    });
  }
  
  // Handle JSON parsing errors
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON',
    });
  }
  
  // Default internal server error
  return res.status(500).json({ 
    error: 'Internal Server Error',
    message: NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    stack: NODE_ENV === 'development' ? err.stack : undefined,
  });
};

app.use(errorHandler);

export default app;
