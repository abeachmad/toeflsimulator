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
// Check if running from compiled code (dist/) or source (src/)
const isCompiled = __dirname.includes('dist');
const AUDIO_DIR = isCompiled
  ? path.join(__dirname, '../uploads/audio')  // Production: dist/app.js -> ../uploads
  : path.join(__dirname, '../../uploads/audio'); // Dev: src/app.ts -> ../../uploads

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy - required for Railway/Heroku/AWS behind load balancer
app.set('trust proxy', 1);

// CORS allowed origins — whitelist controlled via env var
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

console.log('🔒 CORS enabled for:', ALLOWED_ORIGINS.join(', '));

// Security middleware - helmet for security headers
// Disable crossOriginResourcePolicy for audio streaming
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

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
  // Enable audio streaming with range requests
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
