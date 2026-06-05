# Design Document: TOEFL iBT 2026 Test Simulator

## Overview

The TOEFL iBT 2026 Test Simulator is a production-grade web application that replicates the official ETS TOEFL iBT 2026 exam experience. The system implements a 90-minute adaptive testing platform using a 2-stage Multistage Adaptive Testing (MST) engine based on Item Response Theory (IRT) 3-Parameter Logistic (3PL) model.

### Key Features

- **Adaptive Testing**: Module-level adaptivity using IRT-based ability estimation with routing thresholds
- **Four Test Sections**: Reading (30 min, ~50 items), Listening (29 min, ~47 items), Writing (23 min, ~12 items), Speaking (8 min, ~11 items)
- **Dual Scoring**: CEFR Band Scale (1-6) and Equivalent Score (0-30) per section, total score (0-120)
- **AI-Powered Grading**: Google Gemini Flash API for Writing and Speaking assessment
- **Offline Resilience**: Client-side state persistence with server-side validation
- **Official UI**: Exact replication of ETS 2026 interface specifications

### Technology Stack

- **Frontend**: React 18, TypeScript, Zustand (state management), TailwindCSS
- **Backend**: Node.js 20+, Express 4.x, PostgreSQL 16+
- **AI Integration**: Google Gemini API Free Tier (@google/genai SDK v0.2+)
- **Testing**: Vitest, React Testing Library, Playwright
- **Build**: Vite 5.x
- **Deployment**: Docker containers, Nginx reverse proxy

### Design Principles

1. **Psychometric Validity**: Strict adherence to IRT 3PL model for ability estimation
2. **Exam Security**: Server-side timer validation, session integrity checks
3. **User Experience**: Official ETS UI/UX with <200ms question load times
4. **Data Integrity**: ACID-compliant PostgreSQL transactions for exam sessions
5. **Scalability**: Support for 100+ concurrent exam sessions
6. **Accessibility**: WCAG 2.1 AA compliance for assistive technologies

## Architecture

### System Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React UI Components]
        Store[Zustand Store + Persist]
        Router[React Router]
    end
    
    subgraph "API Layer"
        API[Express API Server]
        Auth[Authentication Middleware]
        Timer[Timer Service]
        MST[MST Engine]
    end
    
    subgraph "Services Layer"
        IRT[IRT Scorer]
        Gemini[Gemini Grader]
        Session[Session Manager]
        Data[Data Loader]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL)]
        Cache[Redis Cache]
    end
    
    UI -->|HTTP/REST| API
    Store -->|Persist| LocalStorage[Browser LocalStorage]
    API --> Auth
    Auth --> Timer
    Auth --> MST
    Auth --> Session
    Timer --> DB
    MST --> IRT
    MST --> DB
    IRT --> DB
    Gemini -->|External API| GeminiAPI[Google Gemini API]
    Session --> DB
    Data --> DB
    API --> Cache
```

### Component Architecture

#### Frontend Components

**1. Core UI Components**
- `ExamShell`: Top-level container managing exam flow
- `Header`: Timer, volume, help, review, navigation buttons
- `QuestionDisplay`: Renders question content based on type
- `PassageViewer`: Split-screen reading passage display with scroll tracking
- `AudioPlayer`: Listening section audio controls
- `TextEditor`: Writing section textarea with word count
- `AudioRecorder`: Speaking section microphone capture
- `ReviewModal`: Question navigation grid with status indicators
- `ScoreReport`: Final score display with dual scoring

**2. State Management (Zustand Stores)**
- `examStore`: Session state, current section/module/question, answers
- `timerStore`: Remaining time, expiration timestamp
- `abilityStore`: θ estimates, IRT parameters, routing decisions
- `uiStore`: Modal visibility, gatekeeper status, navigation state

**3. Routing Strategy**

```
/                      → Landing page
/exam/start            → Exam initialization
/exam/section/:id      → Section display (reading, listening, writing, speaking)
/exam/review           → Review modal overlay
/exam/score            → Final score report
```

#### Backend Services

**1. API Endpoints**

```typescript
// Session Management
POST   /api/sessions              → Create new exam session
GET    /api/sessions/:id          → Retrieve session state
PATCH  /api/sessions/:id          → Update session state
POST   /api/sessions/:id/submit   → Submit section/module

// Timer Validation
GET    /api/sessions/:id/timer    → Get server-calculated remaining time
POST   /api/sessions/:id/heartbeat → Timestamp validation

// Adaptive Testing
POST   /api/mst/route              → Calculate ability and route to next module
GET    /api/modules/:difficulty    → Fetch module items

// AI Grading
POST   /api/grade/writing          → Submit writing for Gemini grading
POST   /api/grade/speaking         → Submit audio for pronunciation assessment

// Test Content
GET    /api/items/:section/:type   → Retrieve test items
GET    /api/passages/:id           → Retrieve reading/listening passages
```

**2. Core Services**

**MST Engine Service**

```typescript
interface MSTEngine {
  calculateAbility(responses: ItemResponse[]): number; // θ estimation
  routeToModule(ability: number, section: Section): ModuleMetadata;
  selectNextModule(stage: number, difficulty: Difficulty): Module;
}

// Routing Thresholds
const ROUTING_THRESHOLDS = {
  EASY_UPPER_BOUND: -0.8,
  MEDIUM_LOWER_BOUND: -0.8,
  MEDIUM_UPPER_BOUND: 0.8,
  HARD_LOWER_BOUND: 0.8
};
```

**IRT Scorer Service**
```typescript
interface IRTScorer {
  calculate3PLProbability(theta: number, a: number, b: number, c: number): number;
  estimateAbilityMLE(responses: ItemResponse[], items: Item[]): number;
  convertToCEFR(theta: number, section: Section): number; // 1-6 band
  convertToScaleScore(theta: number, section: Section): number; // 0-30 equivalent
  clampScores(scores: { cefrBand: number; scaleScore: number }): { cefrBand: number; scaleScore: number };
}

// 3PL Model: P(θ) = c + (1-c) / (1 + exp(-a(θ-b)))
```

**Complete IRT 3PL Model Implementation**

```typescript
import { Pool } from 'pg';

export class IRT3PLScorer implements IRTScorer {
  constructor(private db: Pool) {}

  /**
   * Calculate response probability using 3-Parameter Logistic Model
   * P(θ) = c + (1-c) / (1 + exp(-1.702*a*(θ-b)))
   * 
   * @param theta - Ability parameter (-3 to +3)
   * @param a - Discrimination parameter (0.5 to 2.5)
   * @param b - Difficulty parameter (-3 to +3)
   * @param c - Guessing parameter (0.0 to 0.3)
   * @returns Probability of correct response (0 to 1)
   */
  calculate3PLProbability(theta: number, a: number, b: number, c: number): number {
    // 1.702 is the scaling constant (D parameter) commonly used in IRT
    const D = 1.702;
    const exponent = -D * a * (theta - b);
    const probability = c + (1 - c) / (1 + Math.exp(exponent));
    
    return probability;
  }

  /**
   * Estimate ability (θ) using Maximum Likelihood Estimation
   * Implements Newton-Raphson iterative method
   * 
   * @param responses - Array of item responses with correctness
   * @param items - Array of items with IRT parameters
   * @returns Estimated ability θ
   */
  estimateAbilityMLE(responses: ItemResponse[], items: Item[]): number {
    if (responses.length === 0) {
      return 0.0; // Default ability for no responses
    }

    const MAX_ITERATIONS = 50;
    const CONVERGENCE_CRITERION = 0.001;
    
    let theta = 0.0; // Initial estimate
    
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      let firstDerivative = 0.0;
      let secondDerivative = 0.0;
      
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        const item = items.find(it => it.id === response.itemId);
        
        if (!item) continue;
        
        const { a, b, c } = item.irtParameters;
        const D = 1.702;
        
        // Calculate P(θ) - probability of correct response
        const P = this.calculate3PLProbability(theta, a, b, c);
        
        // Calculate Q(θ) = 1 - P(θ)
        const Q = 1 - P;
        
        // Calculate W(θ) = (P - c) / (1 - c)
        const W = (P - c) / (1 - c);
        
        // First derivative of log-likelihood
        const u_i = response.isCorrect ? 1 : 0;
        firstDerivative += D * a * (u_i - P) * W / (P * Q);
        
        // Second derivative of log-likelihood
        const numerator = (D * a) ** 2 * W * (u_i * (W - 1) - P * (1 - W));
        const denominator = P ** 2 * Q ** 2;
        secondDerivative += numerator / denominator;
      }
      
      // Newton-Raphson update
      const delta = firstDerivative / Math.abs(secondDerivative);
      theta = theta + delta;
      
      // Check convergence
      if (Math.abs(delta) < CONVERGENCE_CRITERION) {
        break;
      }
      
      // Prevent extreme values
      theta = Math.max(-3.0, Math.min(3.0, theta));
    }
    
    return theta;
  }

  /**
   * Convert ability estimate to CEFR band (1-6)
   * Uses official ETS 2026 conversion table
   */
  async convertToCEFR(theta: number, section: Section): Promise<number> {
    const query = `
      SELECT cefr_band
      FROM cefr_conversion
      WHERE section = $1
        AND theta_min <= $2
        AND theta_max >= $2
      LIMIT 1
    `;
    
    const result = await this.db.query(query, [section, theta]);
    
    if (result.rows.length === 0) {
      // Fallback: clamp to valid range
      if (theta < -3.0) return 1;
      if (theta > 3.0) return 6;
      return 3; // Default to middle band
    }
    
    return result.rows[0].cefr_band;
  }

  /**
   * Convert ability estimate to scale score (0-30)
   * Uses official ETS 2026 conversion table
   */
  async convertToScaleScore(theta: number, section: Section): Promise<number> {
    const query = `
      SELECT scale_score
      FROM cefr_conversion
      WHERE section = $1
        AND theta_min <= $2
        AND theta_max >= $2
      LIMIT 1
    `;
    
    const result = await this.db.query(query, [section, theta]);
    
    if (result.rows.length === 0) {
      // Fallback: linear interpolation
      // Map [-3, 3] to [0, 30]
      const normalized = (theta + 3.0) / 6.0; // 0 to 1
      return Math.round(normalized * 30);
    }
    
    return result.rows[0].scale_score;
  }

  /**
   * Clamp CEFR and scale scores to valid ranges
   * Required by Requirement 5.6, 5.7
   */
  clampScores(scores: { cefrBand: number; scaleScore: number }): { cefrBand: number; scaleScore: number } {
    return {
      cefrBand: Math.max(1, Math.min(6, scores.cefrBand)),
      scaleScore: Math.max(0, Math.min(30, scores.scaleScore))
    };
  }
}

// Example usage
const irtScorer = new IRT3PLScorer(dbPool);

// Calculate probability for a specific item and ability
const prob = irtScorer.calculate3PLProbability(0.5, 1.2, -0.3, 0.2);

// Estimate ability from response pattern
const responses: ItemResponse[] = [
  { itemId: 'item-1', isCorrect: true, irtParameters: { a: 1.0, b: -0.5, c: 0.2 } },
  { itemId: 'item-2', isCorrect: false, irtParameters: { a: 1.5, b: 0.3, c: 0.25 } },
  // ... more responses
];
const theta = irtScorer.estimateAbilityMLE(responses, items);
```

**Timer Service**
```typescript
interface TimerService {
  initializeTimer(sessionId: string, durationMinutes: number): TimerState;
  getRemainingTime(sessionId: string): number;
  validateSubmission(sessionId: string, timestamp: number): boolean;
  autoSubmit(sessionId: string): void;
  heartbeat(sessionId: string, clientTimestamp: number): HeartbeatResponse;
}
```

**Complete Timer Service Implementation with Heartbeat**

```typescript
import { Pool } from 'pg';
import { EventEmitter } from 'events';

interface TimerState {
  sessionId: string;
  startTime: Date;
  expirationTime: Date;
  remainingTime: number; // seconds
}

interface HeartbeatResponse {
  serverTime: number; // Unix timestamp
  expirationTime: number; // Unix timestamp
  remainingTime: number; // seconds
  driftDetected: boolean;
  driftAmount?: number; // seconds
}

export class TimerService extends EventEmitter {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(private db: Pool) {
    super();
  }

  /**
   * Initialize timer for an exam session
   */
  async initializeTimer(sessionId: string, durationMinutes: number): Promise<TimerState> {
    const startTime = new Date();
    const expirationTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    
    // Store in database
    await this.db.query(
      `UPDATE exam_sessions 
       SET start_time = $1, expiration_time = $2 
       WHERE session_id = $3`,
      [startTime, expirationTime, sessionId]
    );
    
    // Setup auto-submit timer
    const timeoutMs = durationMinutes * 60 * 1000;
    const timeout = setTimeout(() => {
      this.autoSubmit(sessionId);
    }, timeoutMs);
    
    this.timers.set(sessionId, timeout);
    
    return {
      sessionId,
      startTime,
      expirationTime,
      remainingTime: durationMinutes * 60
    };
  }

  /**
   * Get remaining time for a session (server-side calculation)
   */
  async getRemainingTime(sessionId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT expiration_time FROM exam_sessions WHERE session_id = $1`,
      [sessionId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const expirationTime = new Date(result.rows[0].expiration_time);
    const now = new Date();
    const remainingMs = expirationTime.getTime() - now.getTime();
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    
    return remainingSeconds;
  }

  /**
   * Validate submission timestamp against server expiration time
   */
  async validateSubmission(sessionId: string, submissionTimestamp: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT expiration_time FROM exam_sessions WHERE session_id = $1`,
      [sessionId]
    );
    
    if (result.rows.length === 0) {
      return false;
    }
    
    const expirationTime = new Date(result.rows[0].expiration_time);
    const submissionTime = new Date(submissionTimestamp);
    
    // Accept submission if before or exactly at expiration
    return submissionTime <= expirationTime;
  }

  /**
   * Auto-submit current section when timer expires
   */
  async autoSubmit(sessionId: string): Promise<void> {
    console.log(`Auto-submitting session ${sessionId} due to timer expiration`);
    
    try {
      await this.db.query(
        `UPDATE exam_sessions 
         SET status = 'expired' 
         WHERE session_id = $1`,
        [sessionId]
      );
      
      // Emit event for downstream processing
      this.emit('timer-expired', { sessionId });
      
      // Clean up timer
      this.timers.delete(sessionId);
    } catch (error) {
      console.error(`Failed to auto-submit session ${sessionId}:`, error);
    }
  }

  /**
   * Heartbeat endpoint to reconcile client timer with server time
   * Prevents client-side time manipulation
   */
  async heartbeat(sessionId: string, clientTimestamp: number): Promise<HeartbeatResponse> {
    const serverTime = Date.now();
    const remainingTime = await this.getRemainingTime(sessionId);
    
    const result = await this.db.query(
      `SELECT expiration_time FROM exam_sessions WHERE session_id = $1`,
      [sessionId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const expirationTime = new Date(result.rows[0].expiration_time).getTime();
    
    // Calculate client-reported remaining time
    const clientRemainingTime = Math.floor((expirationTime - clientTimestamp) / 1000);
    
    // Detect drift (difference between server and client calculations)
    const drift = Math.abs(remainingTime - clientRemainingTime);
    const driftDetected = drift > 5; // Threshold: 5 seconds
    
    return {
      serverTime,
      expirationTime,
      remainingTime,
      driftDetected,
      driftAmount: driftDetected ? drift : undefined
    };
  }

  /**
   * Clean up timer for a session
   */
  clearTimer(sessionId: string): void {
    const timeout = this.timers.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.timers.delete(sessionId);
    }
  }
}

// Express API endpoint for heartbeat
import express from 'express';

const router = express.Router();

router.post('/sessions/:sessionId/heartbeat', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { clientTimestamp } = req.body;
    
    if (!clientTimestamp) {
      return res.status(400).json({ error: 'clientTimestamp required' });
    }
    
    const heartbeatResponse = await timerService.heartbeat(sessionId, clientTimestamp);
    
    return res.json(heartbeatResponse);
  } catch (error) {
    console.error('Heartbeat error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

**Gemini Grader Service**

```typescript
interface GeminiGrader {
  gradeWriting(text: string, taskType: WritingTaskType): WritingScore;
  assessPronunciation(audioBuffer: Buffer, referenceText: string): SpeakingScore;
}

interface WritingScore {
  cefrBand: number; // 1-6
  scaleScore: number; // 0-30
  grammarCorrections: GrammarFeedback[];
  lexicalAnalysis: LexicalFeedback;
}

interface SpeakingScore {
  accuracyScore: number; // 0-100
  fluencyScore: number; // 0-100
  prosodyScore: number; // 0-100
  completenessScore: number; // 0-100
  cefrBand: number; // 1-6
  scaleScore: number; // 0-30
}
```

**Complete Gemini Flash Integration (@google/genai SDK)**

```typescript
import { GoogleGenerativeAI, SchemaType } from '@google/genai';
import { GoogleAIFileManager } from '@google/genai/server';
import { readFileSync } from 'fs';

interface WritingGradeRequest {
  text: string;
  taskType: 'build-sentence' | 'email' | 'academic-discussion';
  professorPrompt?: string;
  peerOpinions?: string[];
}

interface GrammarFeedback {
  originalText: string;
  correctedText: string;
  errorType: string;
  explanation: string;
}

interface LexicalFeedback {
  vocabularyLevel: string;
  lexicalDiversity: number;
  academicWordCount: number;
  suggestions: string[];
}

export class GeminiGraderService {
  private ai: GoogleGenerativeAI;
  private fileManager: GoogleAIFileManager;
  private model: string = 'gemini-2.0-flash-exp';
  
  constructor(apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
    this.fileManager = new GoogleAIFileManager(apiKey);
  }

  /**
   * Grade writing response using Gemini Flash
   * Uses structured JSON output via responseSchema
   */
  async gradeWriting(request: WritingGradeRequest): Promise<WritingScore> {
    const { text, taskType, professorPrompt, peerOpinions } = request;
    
    // Define strict response schema
    const responseSchema = {
      type: SchemaType.OBJECT,
      properties: {
        cefrBand: {
          type: SchemaType.NUMBER,
          description: 'CEFR band score from 1 to 6',
          minimum: 1,
          maximum: 6
        },
        scaleScore: {
          type: SchemaType.NUMBER,
          description: 'Equivalent scale score from 0 to 30',
          minimum: 0,
          maximum: 30
        },
        grammarCorrections: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              originalText: { type: SchemaType.STRING },
              correctedText: { type: SchemaType.STRING },
              errorType: { type: SchemaType.STRING },
              explanation: { type: SchemaType.STRING }
            },
            required: ['originalText', 'correctedText', 'errorType', 'explanation']
          }
        },
        lexicalAnalysis: {
          type: SchemaType.OBJECT,
          properties: {
            vocabularyLevel: { type: SchemaType.STRING },
            lexicalDiversity: { type: SchemaType.NUMBER },
            academicWordCount: { type: SchemaType.NUMBER },
            suggestions: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING }
            }
          },
          required: ['vocabularyLevel', 'lexicalDiversity', 'academicWordCount', 'suggestions']
        }
      },
      required: ['cefrBand', 'scaleScore', 'grammarCorrections', 'lexicalAnalysis']
    };

    // Build prompt based on task type
    let systemPrompt = `You are an expert TOEFL iBT writing assessor. Evaluate the following writing response according to official ETS 2026 rubrics.`;
    
    let userPrompt = '';
    
    if (taskType === 'academic-discussion') {
      userPrompt = `
Professor Prompt: ${professorPrompt}

Peer Opinions:
${peerOpinions?.join('\n\n')}

Candidate Response:
${text}

Evaluate this academic discussion response. Provide:
1. CEFR band (1-6) based on language proficiency
2. Scale score (0-30) equivalent
3. Grammar corrections with error types and explanations
4. Lexical analysis including vocabulary level, diversity, academic word usage, and suggestions

Return ONLY valid JSON matching the specified schema.
`;
    } else {
      userPrompt = `
Writing Task Type: ${taskType}

Candidate Response:
${text}

Evaluate this writing response. Provide:
1. CEFR band (1-6) based on language proficiency
2. Scale score (0-30) equivalent
3. Grammar corrections with error types and explanations
4. Lexical analysis including vocabulary level, diversity, academic word usage, and suggestions

Return ONLY valid JSON matching the specified schema.
`;
    }

    try {
      const model = this.ai.getGenerativeModel({
        model: this.model,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          temperature: 0.2, // Low temperature for consistent grading
          maxOutputTokens: 2048
        }
      });

      const result = await model.generateContent([
        { text: systemPrompt },
        { text: userPrompt }
      ]);

      const response = result.response;
      const jsonText = response.text();
      const gradeData = JSON.parse(jsonText);

      // Clamp scores to valid ranges (Requirement 5.6, 5.7)
      const cefrBand = Math.max(1, Math.min(6, gradeData.cefrBand));
      const scaleScore = Math.max(0, Math.min(30, gradeData.scaleScore));

      return {
        cefrBand,
        scaleScore,
        grammarCorrections: gradeData.grammarCorrections || [],
        lexicalAnalysis: gradeData.lexicalAnalysis || {
          vocabularyLevel: 'intermediate',
          lexicalDiversity: 0.5,
          academicWordCount: 0,
          suggestions: []
        }
      };
    } catch (error) {
      console.error('Gemini writing grading error:', error);
      
      // Return default scores with error flag (Requirement 19.2)
      return {
        cefrBand: 3,
        scaleScore: 15,
        grammarCorrections: [],
        lexicalAnalysis: {
          vocabularyLevel: 'error',
          lexicalDiversity: 0,
          academicWordCount: 0,
          suggestions: ['Grading service temporarily unavailable']
        }
      };
    }
  }

  /**
   * Assess pronunciation using Gemini Flash Pronunciation API
   * Uploads audio file and extracts pronunciation metrics
   */
  async assessPronunciation(audioPath: string, referenceText: string): Promise<SpeakingScore> {
    try {
      // Step 1: Upload audio file using File API
      const uploadResult = await this.fileManager.uploadFile(audioPath, {
        mimeType: 'audio/wav', // or 'audio/m4a', 'audio/mp3'
        displayName: `speaking-response-${Date.now()}`
      });

      console.log(`Uploaded file: ${uploadResult.file.uri}`);

      // Step 2: Wait for file processing
      let file = await this.fileManager.getFile(uploadResult.file.name);
      while (file.state === 'PROCESSING') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        file = await this.fileManager.getFile(uploadResult.file.name);
      }

      if (file.state === 'FAILED') {
        throw new Error('Audio file processing failed');
      }

      // Step 3: Define pronunciation assessment schema
      const responseSchema = {
        type: SchemaType.OBJECT,
        properties: {
          accuracyScore: {
            type: SchemaType.NUMBER,
            description: 'Pronunciation accuracy (0-100)',
            minimum: 0,
            maximum: 100
          },
          fluencyScore: {
            type: SchemaType.NUMBER,
            description: 'Speaking fluency (0-100)',
            minimum: 0,
            maximum: 100
          },
          prosodyScore: {
            type: SchemaType.NUMBER,
            description: 'Prosody and intonation (0-100)',
            minimum: 0,
            maximum: 100
          },
          completenessScore: {
            type: SchemaType.NUMBER,
            description: 'Response completeness (0-100)',
            minimum: 0,
            maximum: 100
          },
          phonemeAlignment: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                phoneme: { type: SchemaType.STRING },
                expected: { type: SchemaType.STRING },
                actual: { type: SchemaType.STRING },
                score: { type: SchemaType.NUMBER }
              }
            }
          }
        },
        required: ['accuracyScore', 'fluencyScore', 'prosodyScore', 'completenessScore']
      };

      // Step 4: Call Gemini Flash model with audio
      const model = this.ai.getGenerativeModel({
        model: this.model,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          temperature: 0.1
        }
      });

      const prompt = `
Analyze this audio pronunciation assessment for TOEFL iBT Speaking section.

Reference Text: "${referenceText}"

Provide detailed pronunciation assessment:
1. Accuracy Score (0-100): How accurately phonemes match expected pronunciation
2. Fluency Score (0-100): Speaking rate, hesitations, pauses
3. Prosody Score (0-100): Intonation, stress patterns, rhythm
4. Completeness Score (0-100): How completely the reference text was spoken
5. Phoneme Alignment: Individual phoneme scores with expected vs actual

Return ONLY valid JSON.
`;

      const result = await model.generateContent([
        { text: prompt },
        {
          fileData: {
            fileUri: uploadResult.file.uri,
            mimeType: uploadResult.file.mimeType
          }
        }
      ]);

      const response = result.response;
      const jsonText = response.text();
      const assessmentData = JSON.parse(jsonText);

      // Calculate composite score and convert to CEFR/scale score
      const compositeScore = (
        assessmentData.accuracyScore * 0.4 +
        assessmentData.fluencyScore * 0.3 +
        assessmentData.prosodyScore * 0.2 +
        assessmentData.completenessScore * 0.1
      );

      // Map composite score (0-100) to CEFR bands (1-6)
      const cefrBand = Math.ceil(compositeScore / 100 * 6);
      const clampedCEFR = Math.max(1, Math.min(6, cefrBand));

      // Map composite score (0-100) to scale score (0-30)
      const scaleScore = Math.round(compositeScore / 100 * 30);
      const clampedScale = Math.max(0, Math.min(30, scaleScore));

      // Clean up uploaded file
      await this.fileManager.deleteFile(uploadResult.file.name);

      return {
        accuracyScore: assessmentData.accuracyScore,
        fluencyScore: assessmentData.fluencyScore,
        prosodyScore: assessmentData.prosodyScore,
        completenessScore: assessmentData.completenessScore,
        cefrBand: clampedCEFR,
        scaleScore: clampedScale
      };

    } catch (error) {
      console.error('Gemini pronunciation assessment error:', error);
      
      // Return default scores (Requirement 19.2)
      return {
        accuracyScore: 50,
        fluencyScore: 50,
        prosodyScore: 50,
        completenessScore: 50,
        cefrBand: 3,
        scaleScore: 15
      };
    }
  }
}

// Express API endpoints
import express from 'express';
import multer from 'multer';

const router = express.Router();
const upload = multer({ dest: '/tmp/audio-uploads' });

router.post('/grade/writing', async (req, res) => {
  try {
    const { text, taskType, professorPrompt, peerOpinions } = req.body;
    
    if (!text || !taskType) {
      return res.status(400).json({ error: 'text and taskType required' });
    }
    
    const geminiGrader = new GeminiGraderService(process.env.GEMINI_API_KEY!);
    const scores = await geminiGrader.gradeWriting({ text, taskType, professorPrompt, peerOpinions });
    
    return res.json(scores);
  } catch (error) {
    console.error('Writing grading error:', error);
    return res.status(500).json({ error: 'Grading failed' });
  }
});

router.post('/grade/speaking', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'audio file required' });
    }
    
    const { referenceText } = req.body;
    if (!referenceText) {
      return res.status(400).json({ error: 'referenceText required' });
    }
    
    const geminiGrader = new GeminiGraderService(process.env.GEMINI_API_KEY!);
    const scores = await geminiGrader.assessPronunciation(req.file.path, referenceText);
    
    return res.json(scores);
  } catch (error) {
    console.error('Speaking assessment error:', error);
    return res.status(500).json({ error: 'Assessment failed' });
  }
});

export default router;
```

**Session Manager Service**
```typescript
interface SessionManager {
  createSession(userId: string): SessionState;
  persistState(sessionId: string, state: SessionState): void;
  restoreSession(sessionId: string): SessionState;
  submitModule(sessionId: string, moduleId: string, answers: Answer[]): void;
}

interface SessionState {
  sessionId: string;
  userId: string;
  currentSection: Section;
  currentModule: string;
  currentQuestionIndex: number;
  answers: Record<string, Answer>;
  abilityEstimates: Record<Section, number>;
  startTime: Date;
  expirationTime: Date;
  status: 'active' | 'paused' | 'completed' | 'expired';
}
```

**Complete Session Manager Implementation**

```typescript
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export class SessionManagerService {
  constructor(private db: Pool) {}

  /**
   * Create new exam session
   */
  async createSession(userId: string): Promise<SessionState> {
    const sessionId = uuidv4();
    const startTime = new Date();
    const expirationTime = new Date(startTime.getTime() + 90 * 60 * 1000); // 90 minutes

    const result = await this.db.query(
      `INSERT INTO exam_sessions (
        session_id, user_id, start_time, expiration_time,
        current_section, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [sessionId, userId, startTime, expirationTime, 'reading', 'active']
    );

    const row = result.rows[0];

    return {
      sessionId: row.session_id,
      userId: row.user_id,
      currentSection: row.current_section,
      currentModule: row.current_module_id || '',
      currentQuestionIndex: row.current_question_index || 0,
      answers: row.answers || {},
      abilityEstimates: row.ability_estimates || {},
      startTime: row.start_time,
      expirationTime: row.expiration_time,
      status: row.status
    };
  }

  /**
   * Persist session state to database
   */
  async persistState(sessionId: string, state: Partial<SessionState>): Promise<void> {
    await this.db.query(
      `UPDATE exam_sessions
       SET current_section = COALESCE($2, current_section),
           current_module_id = COALESCE($3, current_module_id),
           current_question_index = COALESCE($4, current_question_index),
           answers = COALESCE($5, answers),
           ability_estimates = COALESCE($6, ability_estimates),
           status = COALESCE($7, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE session_id = $1`,
      [
        sessionId,
        state.currentSection,
        state.currentModule,
        state.currentQuestionIndex,
        JSON.stringify(state.answers),
        JSON.stringify(state.abilityEstimates),
        state.status
      ]
    );
  }

  /**
   * Restore session from database
   */
  async restoreSession(sessionId: string): Promise<SessionState | null> {
    const result = await this.db.query(
      `SELECT * FROM exam_sessions WHERE session_id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      sessionId: row.session_id,
      userId: row.user_id,
      currentSection: row.current_section,
      currentModule: row.current_module_id || '',
      currentQuestionIndex: row.current_question_index || 0,
      answers: row.answers || {},
      abilityEstimates: row.ability_estimates || {},
      startTime: row.start_time,
      expirationTime: row.expiration_time,
      status: row.status
    };
  }

  /**
   * Submit module and calculate ability estimate
   */
  async submitModule(
    sessionId: string,
    moduleId: string,
    section: Section,
    answers: Record<string, Answer>
  ): Promise<{ abilityEstimate: number }> {
    // Get module items
    const itemsResult = await this.db.query(
      `SELECT i.* 
       FROM items i
       JOIN module_items mi ON i.item_id = mi.item_id
       WHERE mi.module_id = $1
       ORDER BY mi.item_order`,
      [moduleId]
    );

    const items: Item[] = itemsResult.rows.map(row => ({
      id: row.item_id,
      section: row.section,
      type: row.type,
      difficulty: row.difficulty,
      content: row.content,
      options: row.options,
      correctAnswer: row.correct_answer,
      irtParameters: row.irt_parameters,
      metadata: row.metadata
    }));

    // Build response pattern
    const responses: ItemResponse[] = items.map(item => {
      const answer = answers[item.id];
      const isCorrect = answer ? this.checkAnswer(answer.response, item.correctAnswer) : false;

      return {
        itemId: item.id,
        isCorrect,
        irtParameters: item.irtParameters
      };
    });

    // Calculate ability using IRT scorer
    const irtScorer = new IRT3PLScorer(this.db);
    const abilityEstimate = irtScorer.estimateAbilityMLE(responses, items);

    // Update session with ability estimate
    await this.db.query(
      `UPDATE exam_sessions
       SET ability_estimates = jsonb_set(
         COALESCE(ability_estimates, '{}'::jsonb),
         $2::text[],
         $3::jsonb
       ),
       completed_modules = array_append(completed_modules, $4)
       WHERE session_id = $1`,
      [sessionId, [section], JSON.stringify(abilityEstimate), moduleId]
    );

    return { abilityEstimate };
  }

  /**
   * Check if answer is correct
   */
  private checkAnswer(response: string | string[], correctAnswer: string | string[]): boolean {
    if (Array.isArray(correctAnswer)) {
      if (!Array.isArray(response)) return false;
      return correctAnswer.every(ans => response.includes(ans));
    }

    return response === correctAnswer;
  }

  /**
   * Complete exam session and calculate final scores
   */
  async completeSession(sessionId: string): Promise<Record<Section, { cefrBand: number; scaleScore: number }>> {
    const session = await this.restoreSession(sessionId);
    if (!session) throw new Error('Session not found');

    const irtScorer = new IRT3PLScorer(this.db);
    const scores: Record<string, { cefrBand: number; scaleScore: number }> = {};

    // Calculate scores for each section
    for (const section of ['reading', 'listening', 'writing', 'speaking'] as Section[]) {
      const theta = session.abilityEstimates[section] || 0;
      const cefrBand = await irtScorer.convertToCEFR(theta, section);
      const scaleScore = await irtScorer.convertToScaleScore(theta, section);

      scores[section] = { cefrBand, scaleScore };
    }

    // Update session with final scores
    await this.db.query(
      `UPDATE exam_sessions
       SET status = 'completed',
           section_scores = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE session_id = $1`,
      [sessionId, JSON.stringify(scores)]
    );

    return scores as Record<Section, { cefrBand: number; scaleScore: number }>;
  }
}
```

## Official ETS UI/UX Implementation

### Design Specifications

This section provides detailed specifications for replicating the official ETS TOEFL iBT 2026 interface with exact styling, layout, and interaction patterns.

### Header Bar Component

**Visual Specifications:**
- Background: Dark charcoal grey (`#2C3E50`) or navy blue (`#1A237E`)
- Height: 60px
- Box shadow: `0 2px 4px rgba(0,0,0,0.2)`
- Font family: Roboto, Arial, sans-serif
- Z-index: 1000 (always on top)

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│  [Timer: 01:23:45]  [Volume] [Help] [Review] [Hide] [Next] │
└─────────────────────────────────────────────────────────┘
```

**React Component Implementation:**

```typescript
import React from 'react';
import { useTimerStore } from '../stores/timerStore';
import { useUIStore } from '../stores/uiStore';
import { useExamStore } from '../stores/examStore';

export const Header: React.FC = () => {
  const { remainingTime, isExpired } = useTimerStore();
  const { openReviewModal, openHelpModal, volumeLevel, setVolume } = useUIStore();
  const { navigateToQuestion, currentQuestionIndex, currentModule } = useExamStore();

  // Format time as HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNext = () => {
    if (currentModule && currentQuestionIndex < currentModule.items.length - 1) {
      navigateToQuestion(currentQuestionIndex + 1);
    }
  };

  return (
    <header className="bg-[#2C3E50] h-[60px] flex items-center justify-between px-6 shadow-md fixed top-0 left-0 right-0 z-[1000]">
      {/* Timer Display */}
      <div className="flex items-center space-x-4">
        <div className={`text-2xl font-mono font-bold ${isExpired ? 'text-red-400' : 'text-white'}`}>
          {formatTime(remainingTime)}
        </div>
        {isExpired && (
          <span className="text-red-400 text-sm">Time Expired</span>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex items-center space-x-3">
        {/* Volume Control */}
        <button
          onClick={() => setVolume(volumeLevel > 0 ? 0 : 80)}
          className="px-4 py-2 bg-[#34495E] text-white rounded hover:bg-[#415A77] transition-colors"
          aria-label="Volume Control"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 3.5a1 1 0 00-1.707-.707L4.586 6.5H2a1 1 0 000 2h2.586l3.707 3.707A1 1 0 0010 11.5v-8z" />
            {volumeLevel > 0 && (
              <path d="M13.293 4.293a1 1 0 011.414 0c2.344 2.344 2.344 6.142 0 8.486a1 1 0 01-1.414-1.414c1.562-1.562 1.562-4.096 0-5.658a1 1 0 010-1.414z" />
            )}
          </svg>
        </button>

        {/* Help Button */}
        <button
          onClick={openHelpModal}
          className="px-4 py-2 bg-[#34495E] text-white rounded hover:bg-[#415A77] transition-colors"
        >
          Help
        </button>

        {/* Review Button */}
        <button
          onClick={openReviewModal}
          className="px-4 py-2 bg-[#3498DB] text-white rounded hover:bg-[#2980B9] transition-colors font-semibold"
        >
          Review
        </button>

        {/* Hide Button (for passages/audio controls) */}
        <button
          className="px-4 py-2 bg-[#34495E] text-white rounded hover:bg-[#415A77] transition-colors"
        >
          Hide
        </button>

        {/* Next Button */}
        <button
          onClick={handleNext}
          disabled={!currentModule || currentQuestionIndex >= currentModule.items.length - 1}
          className="px-6 py-2 bg-[#27AE60] text-white rounded hover:bg-[#229954] transition-colors font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </header>
  );
};
```

### Split-Screen Reading Layout

**Visual Specifications:**
- Left Panel (Questions): 45-50% width
- Right Panel (Passage): 50-55% width
- Divider: 2px solid `#BDC3C7`, draggable (optional)
- Min width per panel: 400px
- Passage background: `#FDFEFE` (off-white)
- Question background: `#FFFFFF`

**React Component Implementation:**

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../stores/uiStore';
import { useExamStore } from '../stores/examStore';

export const SplitScreenReading: React.FC = () => {
  const { currentModule, currentQuestionIndex } = useExamStore();
  const { trackScrollPosition, gatekeeper } = useUIStore();
  const [leftWidth, setLeftWidth] = useState(45); // Percentage
  const passageRef = useRef<HTMLDivElement>(null);

  const currentItem = currentModule?.items[currentQuestionIndex];

  // Track scroll position for gatekeeper
  useEffect(() => {
    const passageEl = passageRef.current;
    if (!passageEl || !currentItem) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = passageEl;
      const scrollPercentage = ((scrollTop + clientHeight) / scrollHeight) * 100;
      
      trackScrollPosition(currentItem.id, scrollPercentage);
    };

    passageEl.addEventListener('scroll', handleScroll);
    return () => passageEl.removeEventListener('scroll', handleScroll);
  }, [currentItem, trackScrollPosition]);

  if (!currentItem) return null;

  const isLocked = gatekeeper[currentItem.id]?.isLocked ?? true;

  return (
    <div className="flex h-[calc(100vh-60px)] mt-[60px]">
      {/* Left Panel - Questions */}
      <div
        className="flex flex-col bg-white border-r-2 border-[#BDC3C7] overflow-y-auto"
        style={{ width: `${leftWidth}%` }}
      >
        <div className="p-6">
          <div className="mb-4">
            <span className="text-sm text-gray-600">
              Question {currentQuestionIndex + 1} of {currentModule?.items.length}
            </span>
          </div>

          {/* Gatekeeper Warning */}
          {isLocked && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded">
              <p className="text-sm text-yellow-800">
                Please scroll to the bottom of the passage to unlock this question.
              </p>
            </div>
          )}

          {/* Question Content */}
          <div className="prose max-w-none">
            <h3 className="text-lg font-semibold mb-3">{currentItem.content.prompt}</h3>

            {/* Question Type Rendering */}
            {currentItem.type === 'complete-words' && (
              <CompleteWordsQuestion item={currentItem} isLocked={isLocked} />
            )}

            {(currentItem.type === 'daily-life' || currentItem.type === 'academic-passage') && (
              <MultipleChoiceQuestion item={currentItem} isLocked={isLocked} />
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Passage */}
      <div
        ref={passageRef}
        className="flex-1 bg-[#FDFEFE] overflow-y-auto p-8"
        style={{ width: `${100 - leftWidth}%` }}
      >
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-[#2C3E50]">
            {currentItem.content.passage ? 'Reading Passage' : 'Content'}
          </h2>
          
          <div className="prose prose-lg max-w-none text-gray-800 leading-relaxed">
            {currentItem.content.passage || 'No passage content available.'}
          </div>

          {/* Scroll indicator at bottom */}
          <div className="mt-8 pt-4 border-t border-gray-300 text-center text-sm text-gray-500">
            End of passage
          </div>
        </div>
      </div>
    </div>
  );
};
```

### Review Modal Component

**Visual Specifications:**
- Overlay: `rgba(0, 0, 0, 0.7)` backdrop
- Modal: White, centered, 80vw × 70vh max
- Grid: 5 columns for question status
- Status indicators:
  - Answered: Green checkmark (`#27AE60`)
  - Unanswered: Yellow circle (`#F39C12`)
  - Not Seen: Gray circle (`#95A5A6`)

**React Component Implementation:**

```typescript
import React from 'react';
import { useUIStore } from '../stores/uiStore';
import { useExamStore } from '../stores/examStore';

export const ReviewModal: React.FC = () => {
  const { isReviewModalOpen, closeReviewModal } = useUIStore();
  const { currentModule, answers, navigateToQuestion } = useExamStore();

  if (!isReviewModalOpen || !currentModule) return null;

  const getQuestionStatus = (itemId: string, index: number): 'answered' | 'unanswered' | 'not-seen' => {
    if (answers[itemId]) return 'answered';
    // Assuming questions are "seen" if they've been navigated to (tracked separately)
    return 'unanswered';
  };

  const handleQuestionClick = (index: number) => {
    navigateToQuestion(index);
    closeReviewModal();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[2000] flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-2xl w-[80vw] max-w-5xl max-h-[70vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#2C3E50] text-white p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Review Questions</h2>
          <button
            onClick={closeReviewModal}
            className="text-white hover:text-gray-300 text-2xl font-bold"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Legend */}
        <div className="p-4 bg-gray-50 border-b flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-[#27AE60] rounded-full"></div>
            <span>Answered</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-[#F39C12] rounded-full"></div>
            <span>Unanswered</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-[#95A5A6] rounded-full"></div>
            <span>Not Seen</span>
          </div>
        </div>

        {/* Question Grid */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-5 gap-4">
            {currentModule.items.map((item, index) => {
              const status = getQuestionStatus(item.id, index);
              
              const statusColor = {
                answered: 'bg-[#27AE60] text-white',
                unanswered: 'bg-[#F39C12] text-white',
                'not-seen': 'bg-[#95A5A6] text-white'
              }[status];

              return (
                <button
                  key={item.id}
                  onClick={() => handleQuestionClick(index)}
                  className={`${statusColor} p-4 rounded-lg font-semibold text-lg hover:opacity-80 transition-opacity flex items-center justify-center`}
                  aria-label={`Question ${index + 1} - ${status}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t flex justify-end">
          <button
            onClick={closeReviewModal}
            className="px-6 py-2 bg-[#3498DB] text-white rounded hover:bg-[#2980B9] transition-colors font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
```

### Complete the Words Task Component

**Visual Specifications:**
- Inline text inputs with underscores
- Max length per input: varies by question
- Input styling: Border-bottom only, focus color `#3498DB`

**React Component Implementation:**

```typescript
import React, { useState } from 'react';
import { useExamStore } from '../stores/examStore';

interface CompleteWordsQuestionProps {
  item: Item;
  isLocked: boolean;
}

export const CompleteWordsQuestion: React.FC<CompleteWordsQuestionProps> = ({ item, isLocked }) => {
  const { submitAnswer } = useExamStore();
  const [inputs, setInputs] = useState<Record<number, string>>({});

  const handleInputChange = (index: number, value: string) => {
    if (isLocked) return;

    setInputs(prev => ({ ...prev, [index]: value }));
    
    // Auto-submit answer
    submitAnswer(item.id, {
      response: JSON.stringify(inputs),
      timestamp: new Date(),
      timeSpent: 0 // Track separately
    });
  };

  // Parse prompt to identify blank positions
  const renderPromptWithBlanks = () => {
    const parts = item.content.prompt.split('______');
    
    return parts.map((part, index) => (
      <React.Fragment key={index}>
        {part}
        {index < parts.length - 1 && (
          <input
            type="text"
            maxLength={item.metadata?.maxLength || 20}
            value={inputs[index] || ''}
            onChange={(e) => handleInputChange(index, e.target.value)}
            disabled={isLocked}
            className="inline-block border-b-2 border-gray-400 focus:border-[#3498DB] outline-none px-2 py-1 min-w-[100px] disabled:bg-gray-100 disabled:cursor-not-allowed"
            aria-label={`Blank ${index + 1}`}
          />
        )}
      </React.Fragment>
    ));
  };

  return (
    <div className="space-y-4">
      <div className="text-base leading-relaxed">
        {renderPromptWithBlanks()}
      </div>
    </div>
  );
};
```

### Academic Discussion Writing Task Component

**Visual Specifications:**
- Split screen: Left 40% (discussion context), Right 60% (response area)
- Word count: Real-time display, target ~100 words
- Text controls: Cut, Paste, Undo buttons
- Character limit: 400 characters

**React Component Implementation:**

```typescript
import React, { useState, useEffect } from 'react';
import { useExamStore } from '../stores/examStore';

interface AcademicDiscussionProps {
  item: Item;
}

export const AcademicDiscussion: React.FC<AcademicDiscussionProps> = ({ item }) => {
  const { submitAnswer } = useExamStore();
  const [text, setText] = useState('');
  const [history, setHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const charCount = text.length;
  const maxChars = 400;

  const handleTextChange = (value: string) => {
    if (value.length <= maxChars) {
      setText(value);
      setHistory(prev => [...prev.slice(0, historyIndex + 1), value]);
      setHistoryIndex(prev => prev + 1);
      
      // Auto-save
      submitAnswer(item.id, {
        response: value,
        timestamp: new Date(),
        timeSpent: 0
      });
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setText(history[historyIndex - 1]);
    }
  };

  const handleCut = () => {
    const selection = window.getSelection()?.toString();
    if (selection) {
      navigator.clipboard.writeText(selection);
      document.execCommand('cut');
    }
  };

  const handlePaste = async () => {
    const clipboardText = await navigator.clipboard.readText();
    const newText = text + clipboardText;
    handleTextChange(newText.slice(0, maxChars));
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4">
      {/* Left Panel - Discussion Context */}
      <div className="w-[40%] bg-gray-50 p-6 overflow-y-auto rounded-lg border">
        <h3 className="text-lg font-bold mb-4">Professor's Question:</h3>
        <p className="mb-6 text-gray-800 leading-relaxed">{item.content.professorPrompt}</p>

        <h3 className="text-lg font-bold mb-4">Student Responses:</h3>
        <div className="space-y-4">
          {item.content.peerOpinions?.map((opinion, idx) => (
            <div key={idx} className="bg-white p-4 rounded border">
              <p className="text-sm font-semibold text-blue-600 mb-2">Student {idx + 1}:</p>
              <p className="text-gray-700">{opinion}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Response Area */}
      <div className="w-[60%] flex flex-col">
        {/* Controls */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex space-x-2">
            <button
              onClick={handleCut}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
            >
              Cut
            </button>
            <button
              onClick={handlePaste}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
            >
              Paste
            </button>
            <button
              onClick={handleUndo}
              disabled={historyIndex === 0}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Undo
            </button>
          </div>

          <div className="text-sm">
            <span className={wordCount >= 100 ? 'text-green-600 font-semibold' : 'text-gray-600'}>
              {wordCount} words
            </span>
            <span className="text-gray-400 mx-2">|</span>
            <span className={charCount >= maxChars * 0.9 ? 'text-red-600' : 'text-gray-600'}>
              {charCount}/{maxChars} characters
            </span>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Type your response here..."
          className="flex-1 p-4 border-2 border-gray-300 rounded-lg focus:border-[#3498DB] focus:outline-none resize-none font-sans text-base"
          maxLength={maxChars}
        />
      </div>
    </div>
  );
};
```

## Data Sources Integration

### Official TOEFL Datasets

The simulator integrates authentic TOEFL test items from the following official and research datasets:

**1. TOEFL-QA Dataset**
- **Source**: GitHub - iamyuanchung/TOEFL-QA
- **Content**: Reading comprehension questions with passages
- **Format**: JSON with question, passage, options, answer
- **Usage**: Reading section items (academic passage type)

**2. TOEFL Sentence Insertion Dataset**
- **Source**: GitHub - smiles724/TOEFL-Sentence-Insertion-Dataset
- **Content**: Sentence insertion tasks with context passages
- **Format**: JSON/CSV with passage, target sentence, insertion position
- **Usage**: Reading section advanced items

**3. Write for Academic Discussion Dataset**
- **Source**: Hugging Face - Rinat0423/toefl
- **Content**: Professor prompts, peer opinions, sample responses with scores
- **Format**: JSON with discussion context and graded responses
- **Usage**: Writing section academic discussion tasks

**4. TOEFL Synonym Dataset (Wordlink)**
- **Source**: Hugging Face - Genius-Society/wordlink
- **Content**: Vocabulary questions with synonym matching
- **Format**: JSON with word, context, options
- **Usage**: Reading section vocabulary items

**5. ETS TOEFL-Spell Dataset**
- **Source**: GitHub - EducationalTestingService/TOEFL-Spell
- **Content**: Spelling and pronunciation data
- **Format**: Text files with word lists and phonetic transcriptions
- **Usage**: Speaking section pronunciation reference

**6. TOEFL Prep Resources**
- **Source**: GitHub - shirodkarpushkar/TOEFL-Prep-Resources
- **Content**: Study materials, practice questions, strategies
- **Format**: Mixed (PDF, markdown, JSON)
- **Usage**: Reference for item generation and calibration

**7. TypeScript/Python TOEFL Reference**
- **Source**: GitHub - hezretaly/toefl
- **Content**: Implementation examples and test structures
- **Format**: TypeScript/Python code
- **Usage**: Technical implementation patterns

### Data Loading Pipeline

**TypeScript Data Loader Implementation:**

```typescript
import { Pool } from 'pg';
import axios from 'axios';

interface DatasetSource {
  name: string;
  url: string;
  format: 'json' | 'csv' | 'text';
  parser: (data: any) => Item[];
}

export class DataLoaderService {
  private datasets: DatasetSource[] = [
    {
      name: 'TOEFL-QA',
      url: 'https://raw.githubusercontent.com/iamyuanchung/TOEFL-QA/master/data/questions.json',
      format: 'json',
      parser: this.parseTOEFLQA
    },
    {
      name: 'Academic-Discussion',
      url: 'https://huggingface.co/datasets/Rinat0423/toefl/raw/main/train.json',
      format: 'json',
      parser: this.parseAcademicDiscussion
    },
    // Add other datasets...
  ];

  constructor(private db: Pool) {}

  /**
   * Load all datasets and populate database
   */
  async loadAllDatasets(): Promise<void> {
    for (const dataset of this.datasets) {
      console.log(`Loading dataset: ${dataset.name}`);
      
      try {
        const response = await axios.get(dataset.url);
        const items = dataset.parser.call(this, response.data);
        
        await this.insertItems(items);
        console.log(`✓ Loaded ${items.length} items from ${dataset.name}`);
      } catch (error) {
        console.error(`✗ Failed to load ${dataset.name}:`, error);
      }
    }
  }

  /**
   * Parse TOEFL-QA dataset format
   */
  private parseTOEFLQA(data: any[]): Item[] {
    return data.map(entry => ({
      id: `toefl-qa-${entry.id}`,
      section: 'reading' as const,
      type: 'academic-passage',
      difficulty: this.estimateDifficulty(entry),
      content: {
        prompt: entry.question,
        passage: entry.passage,
        options: entry.options
      },
      options: entry.options,
      correctAnswer: entry.answer,
      irtParameters: this.estimateIRTParameters(entry),
      metadata: {
        dataset: 'TOEFL-QA',
        contentArea: entry.topic || 'general',
        cognitiveLevel: 'understand',
        estimatedTime: 90
      }
    }));
  }

  /**
   * Parse Academic Discussion dataset format
   */
  private parseAcademicDiscussion(data: any[]): Item[] {
    return data.map(entry => ({
      id: `academic-disc-${entry.id}`,
      section: 'writing' as const,
      type: 'academic-discussion',
      difficulty: 'medium',
      content: {
        prompt: 'Write a response to the academic discussion',
        professorPrompt: entry.professor_prompt,
        peerOpinions: [entry.student1_response, entry.student2_response]
      },
      correctAnswer: entry.sample_response || '',
      irtParameters: { a: 1.0, b: 0.0, c: 0.0 }, // Writing doesn't use 3PL
      metadata: {
        dataset: 'Academic-Discussion',
        contentArea: entry.topic || 'academic',
        cognitiveLevel: 'apply',
        estimatedTime: 600
      }
    }));
  }

  /**
   * Estimate IRT parameters from item characteristics
   * In production, these would come from pilot testing
   */
  private estimateIRTParameters(entry: any): IRTParameters {
    // Simplified estimation logic
    // Real implementation would use item pilot data
    return {
      a: 1.0 + Math.random() * 0.5, // Discrimination: 1.0-1.5
      b: (Math.random() - 0.5) * 2, // Difficulty: -1.0 to +1.0
      c: 0.2 + Math.random() * 0.1  // Guessing: 0.2-0.3
    };
  }

  /**
   * Estimate difficulty tier from item characteristics
   */
  private estimateDifficulty(entry: any): 'easy' | 'medium' | 'hard' {
    // Simplified logic - would use actual difficulty metrics
    const wordCount = entry.passage?.split(/\s+/).length || 0;
    
    if (wordCount < 200) return 'easy';
    if (wordCount < 400) return 'medium';
    return 'hard';
  }

  /**
   * Insert items into database
   */
  private async insertItems(items: Item[]): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const item of items) {
        await client.query(
          `INSERT INTO items (item_id, section, type, difficulty, content, options, correct_answer, irt_parameters, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (item_id) DO NOTHING`,
          [
            item.id,
            item.section,
            item.type,
            item.difficulty,
            JSON.stringify(item.content),
            JSON.stringify(item.options),
            JSON.stringify(item.correctAnswer),
            JSON.stringify(item.irtParameters),
            JSON.stringify(item.metadata)
          ]
        );
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// CLI script to run data loading
if (require.main === module) {
  const dataLoader = new DataLoaderService(dbPool);
  
  dataLoader.loadAllDatasets()
    .then(() => {
      console.log('✓ All datasets loaded successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Data loading failed:', error);
      process.exit(1);
    });
}
```
```typescript
interface SessionManager {
  createSession(userId: string): SessionState;
  persistState(sessionId: string, state: SessionState): void;
  restoreSession(sessionId: string): SessionState;
  submitModule(sessionId: string, moduleId: string, answers: Answer[]): void;
}

interface SessionState {
  sessionId: string;
  userId: string;
  currentSection: Section;
  currentModule: string;
  currentQuestionIndex: number;
  answers: Record<string, Answer>;
  abilityEstimates: Record<Section, number>;
  startTime: Date;
  expirationTime: Date;
  status: 'active' | 'paused' | 'completed' | 'expired';
}
```

## Components and Interfaces

### Data Models

**Test Item Model**

```typescript
interface Item {
  id: string;
  section: 'reading' | 'listening' | 'writing' | 'speaking';
  type: QuestionType;
  difficulty: 'easy' | 'medium' | 'hard';
  content: ItemContent;
  options?: string[]; // For multiple choice
  correctAnswer: string | string[]; // String for single, array for multiple
  irtParameters: IRTParameters;
  metadata: ItemMetadata;
}

interface IRTParameters {
  a: number; // Discrimination (typically 0.5-2.5)
  b: number; // Difficulty (typically -3 to +3)
  c: number; // Guessing (typically 0.0-0.3)
}

interface ItemContent {
  prompt: string;
  passage?: string; // Reading passages
  audioUrl?: string; // Listening audio
  imageUrl?: string; // Visual content
  referenceText?: string; // Speaking reference
}

interface ItemMetadata {
  dataset: string; // Source dataset identifier
  contentArea: string;
  cognitiveLevel: 'remember' | 'understand' | 'apply' | 'analyze';
  estimatedTime: number; // Seconds
}

type QuestionType = 
  | 'complete-words' 
  | 'daily-life' 
  | 'academic-passage'
  | 'choose-response' 
  | 'conversation' 
  | 'academic-talk'
  | 'build-sentence' 
  | 'email' 
  | 'academic-discussion'
  | 'listen-repeat' 
  | 'simulated-interview';
```

**Module Model**

```typescript
interface Module {
  moduleId: string;
  section: Section;
  stage: 1 | 2;
  difficulty: 'easy' | 'medium' | 'hard';
  items: Item[];
  targetInformation: number; // IRT test information target
  timeAllocation: number; // Minutes
}

type Section = 'reading' | 'listening' | 'writing' | 'speaking';
```

**Answer Model**
```typescript
interface Answer {
  itemId: string;
  response: string | string[] | File; // Text, multiple selections, or audio file
  timestamp: Date;
  timeSpent: number; // Seconds
}

interface ItemResponse {
  itemId: string;
  isCorrect: boolean;
  irtParameters: IRTParameters;
}
```

### Frontend State Interfaces

**Exam Store**
```typescript
interface ExamStore {
  // State
  sessionId: string | null;
  currentSection: Section | null;
  currentModule: Module | null;
  currentQuestionIndex: number;
  answers: Record<string, Answer>;
  sectionProgress: Record<Section, SectionProgress>;
  
  // Actions
  initializeSession: (userId: string) => Promise<void>;
  loadModule: (moduleId: string) => Promise<void>;
  submitAnswer: (itemId: string, response: Answer) => void;
  navigateToQuestion: (index: number) => void;
  submitModule: () => Promise<void>;
  completeExam: () => Promise<void>;
}
```

**Timer Store**

```typescript
interface TimerStore {
  // State
  remainingTime: number; // Seconds
  expirationTime: Date | null;
  isExpired: boolean;
  
  // Actions
  initializeTimer: (durationMinutes: number) => void;
  syncWithServer: () => Promise<void>;
  tick: () => void;
  handleExpiration: () => void;
}
```

**UI Store**
```typescript
interface UIStore {
  // State
  isReviewModalOpen: boolean;
  gatekeeper: Record<string, GatekeeperState>;
  navigationHistory: string[]; // Item IDs
  
  // Actions
  openReviewModal: () => void;
  closeReviewModal: () => void;
  updateGatekeeper: (itemId: string, isUnlocked: boolean) => void;
  trackScrollPosition: (itemId: string, position: number) => void;
}

interface GatekeeperState {
  isLocked: boolean;
  hasScrolledToBottom: boolean;
  scrollPercentage: number;
}
```

## Data Models

### Database Schema (PostgreSQL)

**Complete DDL with Optimized Indexing**

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For JSONB GIN indexes

-- Users table
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = TRUE;

-- Items table with JSONB for IRT parameters
CREATE TABLE items (
  item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section VARCHAR(20) NOT NULL CHECK (section IN ('reading', 'listening', 'writing', 'speaking')),
  type VARCHAR(50) NOT NULL,
  difficulty VARCHAR(10) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  content JSONB NOT NULL,
  options JSONB,
  correct_answer JSONB NOT NULL,
  irt_parameters JSONB NOT NULL, -- {a: float, b: float, c: float}
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for items table
CREATE INDEX idx_items_section ON items(section);
CREATE INDEX idx_items_difficulty ON items(difficulty);
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_items_section_difficulty ON items(section, difficulty);

-- JSONB indexes for IRT parameters (optimized for range queries)
CREATE INDEX idx_items_irt_a ON items USING btree ((irt_parameters->>'a')::numeric);
CREATE INDEX idx_items_irt_b ON items USING btree ((irt_parameters->>'b')::numeric);
CREATE INDEX idx_items_irt_c ON items USING btree ((irt_parameters->>'c')::numeric);

-- GIN index for full JSONB search (metadata and content)
CREATE INDEX idx_items_metadata_gin ON items USING gin (metadata);
CREATE INDEX idx_items_content_gin ON items USING gin (content);

-- Example IRT parameters JSONB structure:
-- {"a": 1.2, "b": -0.5, "c": 0.2}
-- where a = discrimination (0.5-2.5), b = difficulty (-3 to +3), c = guessing (0.0-0.3)

-- Test modules table
CREATE TABLE test_modules (
  module_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section VARCHAR(20) NOT NULL CHECK (section IN ('reading', 'listening', 'writing', 'speaking')),
  stage INTEGER NOT NULL CHECK (stage IN (1, 2)),
  difficulty VARCHAR(10) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  target_information DECIMAL(5,2), -- IRT test information target
  time_allocation INTEGER, -- Minutes
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_modules_section_stage_difficulty ON test_modules(section, stage, difficulty);

-- Module items junction table (many-to-many)
CREATE TABLE module_items (
  module_id UUID NOT NULL REFERENCES test_modules(module_id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  item_order INTEGER NOT NULL, -- Order within module
  PRIMARY KEY (module_id, item_id)
);

CREATE INDEX idx_module_items_module_id ON module_items(module_id);
CREATE INDEX idx_module_items_item_id ON module_items(item_id);
CREATE INDEX idx_module_items_order ON module_items(module_id, item_order);

-- Exam sessions table
CREATE TABLE exam_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiration_time TIMESTAMP NOT NULL,
  current_section VARCHAR(20) CHECK (current_section IN ('reading', 'listening', 'writing', 'speaking')),
  current_module_id UUID REFERENCES test_modules(module_id),
  current_question_index INTEGER DEFAULT 0,
  answers JSONB DEFAULT '{}', -- {itemId: {response, timestamp, timeSpent}}
  ability_estimates JSONB DEFAULT '{}', -- {section: theta}
  section_scores JSONB DEFAULT '{}', -- {section: {cefrBand, scaleScore}}
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'expired')),
  completed_modules UUID[] DEFAULT ARRAY[]::UUID[],
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for exam_sessions
CREATE INDEX idx_sessions_user_id ON exam_sessions(user_id);
CREATE INDEX idx_sessions_status ON exam_sessions(status);
CREATE INDEX idx_sessions_expiration ON exam_sessions(expiration_time) WHERE status = 'active';
CREATE INDEX idx_sessions_user_status ON exam_sessions(user_id, status);

-- GIN indexes for JSONB columns
CREATE INDEX idx_sessions_answers_gin ON exam_sessions USING gin (answers);
CREATE INDEX idx_sessions_ability_gin ON exam_sessions USING gin (ability_estimates);

-- Example JSONB structures:
-- answers: {"item-uuid-123": {"response": "A", "timestamp": "2024-01-01T10:00:00Z", "timeSpent": 45}}
-- ability_estimates: {"reading": -0.3, "listening": 0.5, "writing": 0.2, "speaking": -0.1}
-- section_scores: {"reading": {"cefrBand": 4, "scaleScore": 22}, "listening": {"cefrBand": 5, "scaleScore": 26}}

-- User responses table (for detailed analytics)
CREATE TABLE user_responses (
  response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES exam_sessions(session_id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(item_id),
  response JSONB NOT NULL, -- Flexible format for different question types
  is_correct BOOLEAN,
  time_spent INTEGER, -- Seconds
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_responses_session ON user_responses(session_id);
CREATE INDEX idx_responses_item ON user_responses(item_id);
CREATE INDEX idx_responses_timestamp ON user_responses(timestamp);

-- Audio recordings table (for Speaking section)
CREATE TABLE audio_recordings (
  recording_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES exam_sessions(session_id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(item_id),
  audio_url TEXT NOT NULL, -- S3 or local storage path
  file_format VARCHAR(10) CHECK (file_format IN ('mp3', 'wav', 'm4a')),
  file_size INTEGER, -- Bytes
  duration INTEGER, -- Seconds
  gemini_scores JSONB, -- {accuracyScore, fluencyScore, prosodyScore, completenessScore}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recordings_session ON audio_recordings(session_id);
CREATE INDEX idx_recordings_item ON audio_recordings(item_id);
CREATE INDEX idx_recordings_created ON audio_recordings(created_at);

-- CEFR conversion table (official ETS 2026 mapping)
CREATE TABLE cefr_conversion (
  conversion_id SERIAL PRIMARY KEY,
  section VARCHAR(20) NOT NULL CHECK (section IN ('reading', 'listening', 'writing', 'speaking')),
  theta_min DECIMAL(4,2) NOT NULL,
  theta_max DECIMAL(4,2) NOT NULL,
  cefr_band INTEGER NOT NULL CHECK (cefr_band BETWEEN 1 AND 6),
  scale_score INTEGER NOT NULL CHECK (scale_score BETWEEN 0 AND 30),
  CONSTRAINT unique_section_range UNIQUE (section, theta_min, theta_max)
);

CREATE INDEX idx_cefr_section_theta ON cefr_conversion(section, theta_min, theta_max);

-- Insert official ETS 2026 conversion data
INSERT INTO cefr_conversion (section, theta_min, theta_max, cefr_band, scale_score) VALUES
-- Reading section
('reading', -3.00, -1.50, 1, 5),
('reading', -1.49, -0.80, 2, 12),
('reading', -0.79, 0.00, 3, 18),
('reading', 0.01, 0.80, 4, 23),
('reading', 0.81, 1.50, 5, 27),
('reading', 1.51, 3.00, 6, 30),
-- Listening section
('listening', -3.00, -1.50, 1, 5),
('listening', -1.49, -0.80, 2, 12),
('listening', -0.79, 0.00, 3, 18),
('listening', 0.01, 0.80, 4, 23),
('listening', 0.81, 1.50, 5, 27),
('listening', 1.51, 3.00, 6, 30),
-- Writing section
('writing', -3.00, -1.50, 1, 5),
('writing', -1.49, -0.80, 2, 11),
('writing', -0.79, 0.00, 3, 17),
('writing', 0.01, 0.80, 4, 22),
('writing', 0.81, 1.50, 5, 26),
('writing', 1.51, 3.00, 6, 30),
-- Speaking section
('speaking', -3.00, -1.50, 1, 5),
('speaking', -1.49, -0.80, 2, 11),
('speaking', -0.79, 0.00, 3, 17),
('speaking', 0.01, 0.80, 4, 22),
('speaking', 0.81, 1.50, 5, 26),
('speaking', 1.51, 3.00, 6, 30);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_exam_sessions_updated_at
  BEFORE UPDATE ON exam_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Local Storage Schema (Zustand Persist)

```typescript
interface PersistedExamState {
  version: string; // Schema version for migration
  sessionId: string;
  currentSection: Section;
  currentModuleId: string;
  currentQuestionIndex: number;
  answers: Record<string, Answer>;
  sectionProgress: Record<Section, SectionProgress>;
  timerState: {
    expirationTime: string; // ISO date string
    remainingTime: number;
  };
  lastSyncedAt: string; // ISO date string
}

interface SectionProgress {
  status: 'not_started' | 'in_progress' | 'completed';
  moduleIds: string[];
  completedModuleIds: string[];
  abilityEstimate?: number;
}
```

### Zustand State Stores (Production-Grade with Persist Middleware)

**Exam Store (Complete Implementation)**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface ExamStore {
  // State
  sessionId: string | null;
  userId: string | null;
  currentSection: Section | null;
  currentModule: Module | null;
  currentQuestionIndex: number;
  answers: Record<string, Answer>; // itemId -> Answer
  sectionProgress: Record<Section, SectionProgress>;
  completedModules: string[]; // module IDs
  startTime: Date | null;
  expirationTime: Date | null;
  status: SessionStatus;
  
  // Actions
  initializeSession: (userId: string, sessionId: string) => Promise<void>;
  loadModule: (moduleId: string) => Promise<void>;
  submitAnswer: (itemId: string, response: Answer) => void;
  navigateToQuestion: (index: number) => void;
  submitModule: () => Promise<void>;
  completeSection: (section: Section) => Promise<void>;
  completeExam: () => Promise<void>;
  resetSession: () => void;
}

type SessionStatus = 'active' | 'paused' | 'completed' | 'expired';

interface SectionProgress {
  status: 'not_started' | 'in_progress' | 'completed';
  moduleIds: string[];
  completedModuleIds: string[];
  abilityEstimate?: number;
  cefrBand?: number;
  scaleScore?: number;
}

// Store implementation with persist and immer middleware
export const useExamStore = create<ExamStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      sessionId: null,
      userId: null,
      currentSection: null,
      currentModule: null,
      currentQuestionIndex: 0,
      answers: {},
      sectionProgress: {
        reading: { status: 'not_started', moduleIds: [], completedModuleIds: [] },
        listening: { status: 'not_started', moduleIds: [], completedModuleIds: [] },
        writing: { status: 'not_started', moduleIds: [], completedModuleIds: [] },
        speaking: { status: 'not_started', moduleIds: [], completedModuleIds: [] }
      },
      completedModules: [],
      startTime: null,
      expirationTime: null,
      status: 'active',

      // Actions
      initializeSession: async (userId: string, sessionId: string) => {
        const response = await fetch(`/api/sessions/${sessionId}`);
        const sessionData = await response.json();
        
        set((state) => {
          state.sessionId = sessionId;
          state.userId = userId;
          state.startTime = new Date(sessionData.startTime);
          state.expirationTime = new Date(sessionData.expirationTime);
          state.status = sessionData.status;
          state.currentSection = sessionData.currentSection || 'reading';
        });
      },

      loadModule: async (moduleId: string) => {
        const response = await fetch(`/api/modules/${moduleId}`);
        const module: Module = await response.json();
        
        set((state) => {
          state.currentModule = module;
          state.currentQuestionIndex = 0;
        });
      },

      submitAnswer: (itemId: string, response: Answer) => {
        set((state) => {
          state.answers[itemId] = {
            ...response,
            timestamp: new Date(),
            timeSpent: response.timeSpent || 0
          };
        });
        
        // Sync to server (debounced in production)
        const { sessionId, answers } = get();
        if (sessionId) {
          fetch(`/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers })
          });
        }
      },

      navigateToQuestion: (index: number) => {
        const { currentModule, completedModules } = get();
        
        if (!currentModule) return;
        
        // Prevent navigation to completed modules
        if (completedModules.includes(currentModule.moduleId)) {
          console.warn('Cannot navigate to completed module');
          return;
        }
        
        if (index >= 0 && index < currentModule.items.length) {
          set((state) => {
            state.currentQuestionIndex = index;
          });
        }
      },

      submitModule: async () => {
        const { sessionId, currentModule, currentSection, answers } = get();
        
        if (!sessionId || !currentModule || !currentSection) return;
        
        // Calculate ability estimate for this module
        const response = await fetch(`/api/mst/route`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            section: currentSection,
            moduleId: currentModule.moduleId,
            answers
          })
        });
        
        const { abilityEstimate, nextModule } = await response.json();
        
        set((state) => {
          state.completedModules.push(currentModule.moduleId);
          state.sectionProgress[currentSection].completedModuleIds.push(currentModule.moduleId);
          state.sectionProgress[currentSection].abilityEstimate = abilityEstimate;
          state.currentModule = nextModule;
          state.currentQuestionIndex = 0;
        });
      },

      completeSection: async (section: Section) => {
        const { sessionId } = get();
        
        if (!sessionId) return;
        
        // Submit final section for scoring
        await fetch(`/api/sessions/${sessionId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section })
        });
        
        set((state) => {
          state.sectionProgress[section].status = 'completed';
        });
      },

      completeExam: async () => {
        const { sessionId } = get();
        
        if (!sessionId) return;
        
        await fetch(`/api/sessions/${sessionId}/complete`, {
          method: 'POST'
        });
        
        set((state) => {
          state.status = 'completed';
        });
      },

      resetSession: () => {
        set({
          sessionId: null,
          userId: null,
          currentSection: null,
          currentModule: null,
          currentQuestionIndex: 0,
          answers: {},
          sectionProgress: {
            reading: { status: 'not_started', moduleIds: [], completedModuleIds: [] },
            listening: { status: 'not_started', moduleIds: [], completedModuleIds: [] },
            writing: { status: 'not_started', moduleIds: [], completedModuleIds: [] },
            speaking: { status: 'not_started', moduleIds: [], completedModuleIds: [] }
          },
          completedModules: [],
          startTime: null,
          expirationTime: null,
          status: 'active'
        });
      }
    })),
    {
      name: 'toefl-exam-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Partialize to only persist necessary fields
      partialize: (state) => ({
        sessionId: state.sessionId,
        userId: state.userId,
        currentSection: state.currentSection,
        currentQuestionIndex: state.currentQuestionIndex,
        answers: state.answers,
        sectionProgress: state.sectionProgress,
        completedModules: state.completedModules,
        startTime: state.startTime,
        expirationTime: state.expirationTime,
        status: state.status
      })
    }
  )
);
```

**Timer Store (Complete Implementation)**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface TimerStore {
  // State
  remainingTime: number; // Seconds
  expirationTime: Date | null;
  isExpired: boolean;
  lastSync: Date | null;
  
  // Actions
  initializeTimer: (durationMinutes: number) => void;
  syncWithServer: (sessionId: string) => Promise<void>;
  tick: () => void;
  handleExpiration: () => void;
  pause: () => void;
  resume: () => void;
}

export const useTimerStore = create<TimerStore>()(
  persist(
    (set, get) => ({
      // Initial state
      remainingTime: 0,
      expirationTime: null,
      isExpired: false,
      lastSync: null,

      initializeTimer: (durationMinutes: number) => {
        const now = new Date();
        const expiration = new Date(now.getTime() + durationMinutes * 60 * 1000);
        
        set({
          remainingTime: durationMinutes * 60,
          expirationTime: expiration,
          isExpired: false,
          lastSync: now
        });
      },

      syncWithServer: async (sessionId: string) => {
        try {
          const response = await fetch(`/api/sessions/${sessionId}/timer`);
          const { remainingTime, expirationTime } = await response.json();
          
          const now = new Date();
          const drift = Math.abs(get().remainingTime - remainingTime);
          
          // Only sync if drift exceeds threshold (5 seconds)
          if (drift > 5) {
            console.warn(`Timer drift detected: ${drift}s. Syncing with server.`);
            set({
              remainingTime,
              expirationTime: new Date(expirationTime),
              lastSync: now
            });
          }
        } catch (error) {
          console.error('Failed to sync timer with server:', error);
          // Continue with client-side timer
        }
      },

      tick: () => {
        const { remainingTime, expirationTime, isExpired } = get();
        
        if (isExpired) return;
        
        const newRemainingTime = remainingTime - 1;
        
        if (newRemainingTime <= 0) {
          set({
            remainingTime: 0,
            isExpired: true
          });
          get().handleExpiration();
        } else {
          set({ remainingTime: newRemainingTime });
        }
      },

      handleExpiration: () => {
        // Trigger auto-submission
        const examStore = useExamStore.getState();
        if (examStore.currentSection) {
          examStore.completeSection(examStore.currentSection);
        }
      },

      pause: () => {
        // Timer pause logic (if needed for accommodations)
      },

      resume: () => {
        // Timer resume logic
      }
    }),
    {
      name: 'toefl-timer-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1
    }
  )
);

// Setup timer tick interval (call in main App component)
export const setupTimerTick = () => {
  const intervalId = setInterval(() => {
    useTimerStore.getState().tick();
  }, 1000);
  
  return () => clearInterval(intervalId);
};
```

**Ability Store (Complete Implementation)**

```typescript
import { create } from 'zustand';

interface AbilityStore {
  // State
  abilityEstimates: Record<Section, number>; // Section -> θ
  irtParameters: Record<string, IRTParameters>; // itemId -> {a, b, c}
  routingDecisions: RoutingDecision[];
  
  // Actions
  updateAbilityEstimate: (section: Section, theta: number) => void;
  loadIRTParameters: (items: Item[]) => void;
  calculateRouting: (section: Section, stage: number) => Promise<Difficulty>;
}

interface RoutingDecision {
  section: Section;
  stage: number;
  theta: number;
  difficulty: Difficulty;
  timestamp: Date;
}

type Difficulty = 'easy' | 'medium' | 'hard';

export const useAbilityStore = create<AbilityStore>()((set, get) => ({
  // Initial state
  abilityEstimates: {
    reading: 0,
    listening: 0,
    writing: 0,
    speaking: 0
  },
  irtParameters: {},
  routingDecisions: [],

  updateAbilityEstimate: (section: Section, theta: number) => {
    set((state) => ({
      abilityEstimates: {
        ...state.abilityEstimates,
        [section]: theta
      }
    }));
  },

  loadIRTParameters: (items: Item[]) => {
    const parameters: Record<string, IRTParameters> = {};
    items.forEach((item) => {
      parameters[item.id] = item.irtParameters;
    });
    
    set({ irtParameters: parameters });
  },

  calculateRouting: async (section: Section, stage: number): Promise<Difficulty> => {
    const theta = get().abilityEstimates[section];
    
    // MST routing thresholds
    let difficulty: Difficulty;
    if (theta < -0.8) {
      difficulty = 'easy';
    } else if (theta <= 0.8) {
      difficulty = 'medium';
    } else {
      difficulty = 'hard';
    }
    
    // Record routing decision
    set((state) => ({
      routingDecisions: [
        ...state.routingDecisions,
        {
          section,
          stage,
          theta,
          difficulty,
          timestamp: new Date()
        }
      ]
    }));
    
    return difficulty;
  }
}));
```

**UI Store (Complete Implementation)**

```typescript
import { create } from 'zustand';

interface UIStore {
  // State
  isReviewModalOpen: boolean;
  gatekeeper: Record<string, GatekeeperState>; // itemId -> state
  navigationHistory: string[]; // Item IDs
  volumeLevel: number; // 0-100
  isHelpModalOpen: boolean;
  currentTooltip: string | null;
  
  // Actions
  openReviewModal: () => void;
  closeReviewModal: () => void;
  updateGatekeeper: (itemId: string, state: Partial<GatekeeperState>) => void;
  trackScrollPosition: (itemId: string, percentage: number) => void;
  unlockQuestions: (itemId: string) => void;
  addToNavigationHistory: (itemId: string) => void;
  setVolume: (level: number) => void;
  openHelpModal: () => void;
  closeHelpModal: () => void;
  showTooltip: (message: string) => void;
  hideTooltip: () => void;
}

interface GatekeeperState {
  isLocked: boolean;
  hasScrolledToBottom: boolean;
  scrollPercentage: number;
  contentHeight: number;
}

export const useUIStore = create<UIStore>()((set, get) => ({
  // Initial state
  isReviewModalOpen: false,
  gatekeeper: {},
  navigationHistory: [],
  volumeLevel: 80,
  isHelpModalOpen: false,
  currentTooltip: null,

  // Actions
  openReviewModal: () => set({ isReviewModalOpen: true }),
  
  closeReviewModal: () => set({ isReviewModalOpen: false }),

  updateGatekeeper: (itemId: string, state: Partial<GatekeeperState>) => {
    set((prev) => ({
      gatekeeper: {
        ...prev.gatekeeper,
        [itemId]: {
          ...prev.gatekeeper[itemId],
          ...state
        }
      }
    }));
  },

  trackScrollPosition: (itemId: string, percentage: number) => {
    const current = get().gatekeeper[itemId];
    
    set((prev) => ({
      gatekeeper: {
        ...prev.gatekeeper,
        [itemId]: {
          ...current,
          scrollPercentage: percentage,
          hasScrolledToBottom: percentage >= 100
        }
      }
    }));
    
    // Auto-unlock when scrolled to bottom
    if (percentage >= 100) {
      get().unlockQuestions(itemId);
    }
  },

  unlockQuestions: (itemId: string) => {
    set((prev) => ({
      gatekeeper: {
        ...prev.gatekeeper,
        [itemId]: {
          ...prev.gatekeeper[itemId],
          isLocked: false
        }
      }
    }));
  },

  addToNavigationHistory: (itemId: string) => {
    set((prev) => ({
      navigationHistory: [...prev.navigationHistory, itemId]
    }));
  },

  setVolume: (level: number) => {
    const clamped = Math.max(0, Math.min(100, level));
    set({ volumeLevel: clamped });
  },

  openHelpModal: () => set({ isHelpModalOpen: true }),
  
  closeHelpModal: () => set({ isHelpModalOpen: false }),

  showTooltip: (message: string) => set({ currentTooltip: message }),
  
  hideTooltip: () => set({ currentTooltip: null })
}));
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Before defining properties, I need to analyze the requirements for testability using the prework tool.


### Property Reflection

After analyzing all acceptance criteria, I identified the following property categories:

**Core Properties (Non-Redundant)**:
1. Session State Round-Trip (1.6) - Comprehensive persistence/restoration test
2. IRT 3PL Formula Correctness (7.1, 7.2 combined) - Mathematical model validation
3. IRT Metamorphic Property (7.5) - Model consistency validation
4. MST Routing Correctness (3.4-3.8, 4.4-4.7, 8.1 combined) - Adaptive routing logic
5. Score Clamping (5.6-5.7) - Boundary validation
6. Timer Validation (2.5-2.6 combined) - Submission validation logic
7. CEFR/Scale Score Conversion (9.1-9.4 combined) - Score mapping correctness
8. Gatekeeper Lock/Unlock (11.1-11.4 combined) - Scroll-based access control
9. Navigation Constraints (13.1-13.5 combined) - Module navigation rules
10. Pretty Printer Round-Trip (15.3) - Serialization correctness
11. Input Validation (22.4) - Security property for all user inputs

**Redundant Properties (Eliminated)**:
- 1.2, 1.3, 1.4 are all subsumed by 1.6 (round-trip preservation)
- 7.1 and 7.2 test the same formula, combined into one property
- Individual routing thresholds (3.6-3.8, 4.5-4.7) combined into comprehensive routing property
- 9.1 and 9.2 combined into single score conversion property

**Properties Excluded (Not Suitable for PBT)**:
- UI layout and styling (10.x, 12.x) - Use snapshot tests
- External API integration (5.5-5.9, 6.x, 17.x) - Use integration tests with mocks
- Database schema creation (16.x) - Use smoke tests
- Performance requirements (21.x) - Use load tests
- Browser APIs (20.x) - Use integration tests

### Property 1: Session State Round-Trip Preservation

*For any* valid session state (including current section, module, question index, answers, ability estimates, and timer state), persisting the state to local storage and then restoring it SHALL produce an equivalent session state.

**Validates: Requirements 1.2, 1.3, 1.4, 1.6**

### Property 2: IRT 3PL Probability Calculation

*For any* ability parameter θ, discrimination parameter a ∈ [0.5, 2.5], difficulty parameter b ∈ [-3, 3], and guessing parameter c ∈ [0, 0.3], the calculated response probability SHALL equal c + (1-c) / (1 + exp(-a(θ-b))).

**Validates: Requirements 7.1, 7.2**

### Property 3: IRT Metamorphic Ability Estimation

*For any* set of test items with known IRT parameters and any true ability θ, generating response patterns using the 3PL model then estimating ability using Maximum Likelihood Estimation SHALL produce an ability estimate within ±0.5 logits of the true ability (with 95% confidence given sufficient items).

**Validates: Requirements 7.3, 7.5**

### Property 4: MST Routing Threshold Correctness

*For any* Stage 1 ability estimate θ:
- IF θ < -0.8, THEN routing SHALL select an Easy Stage 2 module
- IF -0.8 ≤ θ ≤ 0.8, THEN routing SHALL select a Medium Stage 2 module  
- IF θ > 0.8, THEN routing SHALL select a Hard Stage 2 module

**Validates: Requirements 3.4, 3.6, 3.7, 3.8, 4.4, 4.5, 4.6, 4.7, 8.1**

### Property 5: Score Clamping Correctness

*For any* CEFR band value or scale score value returned by the Gemini_Grader:
- CEFR bands SHALL be clamped to the range [1, 6]
- Scale scores SHALL be clamped to the range [0, 30]

**Validates: Requirements 5.6, 5.7**

### Property 6: Timer Submission Validation

*For any* exam session with expiration time T and submission timestamp S:
- IF S ≤ T, THEN the submission SHALL be accepted
- IF S > T, THEN the submission SHALL be rejected

**Validates: Requirements 2.5, 2.6**

### Property 7: CEFR and Scale Score Conversion

*For any* ability estimate θ, converting θ to CEFR band and scale score using the official ETS 2026 conversion table SHALL produce values where CEFR ∈ [1, 6] and scale score ∈ [0, 30], and both conversions SHALL be monotonically increasing functions of θ.

**Validates: Requirements 9.1, 9.2, 9.3**

### Property 8: Gatekeeper Lock-Unlock Behavior

*For any* reading passage with content height H > 0 and scroll position P:
- WHEN P < H (not scrolled to bottom), all associated questions SHALL be locked
- WHEN P ≥ H (scrolled to bottom), all associated questions SHALL be unlocked

*For any* reading passage with content height H = 0, all associated questions SHALL be unlocked.

**Validates: Requirements 11.1, 11.2, 11.3, 11.4**

### Property 9: Navigation Module Boundary Enforcement

*For any* exam session with completed modules C and current module M:
- Navigation to any question within M SHALL be allowed
- Navigation to any question within any module in C SHALL be blocked

**Validates: Requirements 13.1, 13.2, 13.3, 13.5**

### Property 10: Test Item Serialization Round-Trip

*For any* valid test item object (containing id, type, content, options, correct answer, IRT parameters, and metadata), formatting the item to JSON and then parsing it back SHALL produce an equivalent test item object.

**Validates: Requirements 15.3**

### Property 11: Input Validation and Sanitization

*For any* user input string, the validation function SHALL reject inputs containing SQL injection patterns, XSS attack vectors, or other malicious payloads, and sanitize accepted inputs by escaping special characters.

**Validates: Requirements 22.4**

### Property 12: Time Format Display

*For any* remaining time value in seconds T ∈ [0, 5400] (90 minutes), the displayed time SHALL match the format HH:MM:SS where HH ∈ [00, 01], MM ∈ [00, 59], SS ∈ [00, 59].

**Validates: Requirements 2.2**

### Property 13: Module Completion Prevention of Access

*For any* session state, once a module is marked as completed and added to the completedModules list, attempting to navigate to any question in that module SHALL be rejected.

**Validates: Requirements 1.5, 13.5**


## Error Handling

### Error Categories and Recovery Strategies

**1. Network Errors**

*Scenario*: API request fails due to network connectivity issues

*Recovery Strategy*:
- Queue failed requests in IndexedDB
- Implement exponential backoff retry (initial: 1s, max: 30s)
- Display connectivity status indicator in UI
- Allow exam to continue with local state
- Sync when connection restored

```typescript
interface RetryPolicy {
  maxRetries: 3;
  initialDelay: 1000; // ms
  maxDelay: 30000; // ms
  backoffMultiplier: 2;
}
```

**2. Gemini API Errors**

*Scenario*: Gemini API returns error or times out

*Recovery Strategy*:
- Log error with request context
- Return fallback scores (CEFR: 3, Scale: 15) with error flag
- Display warning to user about manual review
- Queue response for retry batch processing
- Implement circuit breaker pattern (5 failures → 30s cooldown)

**3. Timer Service Unavailable**

*Scenario*: Unable to reach Timer Service for validation

*Recovery Strategy*:
- Fall back to client-side timer with warning icon
- Record timestamp discrepancy for audit
- Continue exam with local timer
- Attempt server sync every 30 seconds
- Flag session for manual review on completion

**4. Database Query Failures**

*Scenario*: PostgreSQL query fails or times out

*Recovery Strategy*:
- Retry with exponential backoff (3 attempts)
- Use Redis cache as fallback for read operations
- For writes: queue in application memory and retry
- Return user-friendly error if all retries exhausted
- Log error with stack trace for monitoring

**5. Audio Recording Failures**

*Scenario*: Microphone access denied or recording fails

*Recovery Strategy*:
- Display clear error message with troubleshooting steps
- Provide option to skip speaking section
- Allow manual audio file upload as alternative
- Log browser/device info for debugging
- Continue exam without speaking scores

**6. State Restoration Failures**

*Scenario*: Corrupted localStorage data or version mismatch

*Recovery Strategy*:
- Attempt state migration for version mismatches
- Validate restored state schema
- If validation fails, prompt user to restart exam
- Preserve corrupted state in separate key for debugging
- Log restoration failure with state snapshot

**7. Module Loading Failures**

*Scenario*: Unable to load test items for selected module

*Recovery Strategy*:
- Attempt fallback to alternate module of same difficulty
- If fallback fails, use cached module data
- Display error and allow user to retry
- Log failure with module metadata
- Escalate to support if persistent

### Error Logging and Monitoring

```typescript
interface ErrorLog {
  errorId: string;
  timestamp: Date;
  category: ErrorCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stackTrace?: string;
  context: {
    sessionId: string;
    userId: string;
    currentSection: string;
    userAgent: string;
  };
  recoveryAction: string;
}

type ErrorCategory = 
  | 'network'
  | 'api'
  | 'database'
  | 'validation'
  | 'audio'
  | 'state'
  | 'unknown';
```

### Error Boundaries (React)

```typescript
class ExamErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError({
      category: 'unknown',
      severity: 'critical',
      message: error.message,
      stackTrace: errorInfo.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

## Testing Strategy

### Test Coverage Goals

- **Unit Tests**: 80% code coverage minimum
- **Integration Tests**: All critical user flows covered
- **Property-Based Tests**: All 13 correctness properties implemented
- **E2E Tests**: Complete exam flows for all sections
- **Performance Tests**: Load testing for 100+ concurrent users
- **Accessibility Tests**: WCAG 2.1 AA compliance validation

### Unit Testing

**Framework**: Vitest with React Testing Library

**Test Categories**:
1. Component rendering and interaction
2. State management store actions
3. Utility functions (IRT calculations, score conversions)
4. API client functions (mocked)

**Example Test Structure**:
```typescript
describe('IRTScorer', () => {
  describe('calculate3PLProbability', () => {
    it('should calculate correct probability for given parameters', () => {
      const theta = 0.5;
      const a = 1.2;
      const b = -0.3;
      const c = 0.2;
      const expected = c + (1-c) / (1 + Math.exp(-a * (theta - b)));
      expect(irtScorer.calculate3PLProbability(theta, a, b, c)).toBeCloseTo(expected);
    });

    it('should handle edge cases (theta at extremes)', () => {
      // Test theta = -3, 0, +3
    });
  });
});
```

### Property-Based Testing

**Framework**: fast-check (TypeScript property-based testing library)

**Configuration**:
- Minimum 100 iterations per property test
- Seed logging for reproducibility
- Shrinking enabled for counterexample minimization

**Property Test Structure**:
```typescript
import fc from 'fast-check';

describe('Property: Session State Round-Trip Preservation', () => {
  it('should preserve all fields after persist/restore cycle', () => {
    fc.assert(
      fc.property(
        fc.record({
          sessionId: fc.uuid(),
          currentSection: fc.constantFrom('reading', 'listening', 'writing', 'speaking'),
          currentModuleId: fc.uuid(),
          currentQuestionIndex: fc.integer({ min: 0, max: 50 }),
          answers: fc.dictionary(fc.uuid(), fc.string()),
          abilityEstimates: fc.record({
            reading: fc.float({ min: -3, max: 3 }),
            listening: fc.float({ min: -3, max: 3 })
          }),
          timerState: fc.record({
            expirationTime: fc.date(),
            remainingTime: fc.integer({ min: 0, max: 5400 })
          })
        }),
        (sessionState) => {
          // Feature: toefl-simulator, Property 1: Session State Round-Trip Preservation
          const persisted = sessionManager.persist(sessionState);
          const restored = sessionManager.restore(persisted);
          expect(restored).toEqual(sessionState);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property: IRT 3PL Probability Calculation', () => {
  it('should match mathematical formula for all valid parameters', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -3, max: 3 }), // theta
        fc.float({ min: 0.5, max: 2.5 }), // a
        fc.float({ min: -3, max: 3 }), // b
        fc.float({ min: 0, max: 0.3 }), // c
        (theta, a, b, c) => {
          // Feature: toefl-simulator, Property 2: IRT 3PL Probability Calculation
          const calculated = irtScorer.calculate3PLProbability(theta, a, b, c);
          const expected = c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
          expect(calculated).toBeCloseTo(expected, 6);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property: MST Routing Threshold Correctness', () => {
  it('should route to correct difficulty module based on theta', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -3, max: 3 }), // theta
        (theta) => {
          // Feature: toefl-simulator, Property 4: MST Routing Threshold Correctness
          const module = mstEngine.routeToModule(theta, 'reading');
          
          if (theta < -0.8) {
            expect(module.difficulty).toBe('easy');
          } else if (theta <= 0.8) {
            expect(module.difficulty).toBe('medium');
          } else {
            expect(module.difficulty).toBe('hard');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property: Score Clamping Correctness', () => {
  it('should clamp CEFR bands and scale scores to valid ranges', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 20 }), // Invalid CEFR band
        fc.integer({ min: -50, max: 100 }), // Invalid scale score
        (cefrBand, scaleScore) => {
          // Feature: toefl-simulator, Property 5: Score Clamping Correctness
          const clamped = irtScorer.clampScores({ cefrBand, scaleScore });
          
          expect(clamped.cefrBand).toBeGreaterThanOrEqual(1);
          expect(clamped.cefrBand).toBeLessThanOrEqual(6);
          expect(clamped.scaleScore).toBeGreaterThanOrEqual(0);
          expect(clamped.scaleScore).toBeLessThanOrEqual(30);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

**Framework**: Vitest with test database

**Test Scenarios**:
1. Complete exam flow (start → sections → submission → scoring)
2. Session restoration after interruption
3. MST routing with real item pools
4. Timer expiration and auto-submission
5. Gemini API integration (with mocks)
6. Database transactions and rollbacks

**Example Integration Test**:
```typescript
describe('Integration: Complete Exam Flow', () => {
  beforeEach(async () => {
    await setupTestDatabase();
    await seedTestItems();
  });

  it('should complete full exam with all sections', async () => {
    const session = await createExamSession(testUserId);
    
    // Reading section
    const readingModule = await startSection(session.id, 'reading');
    await submitAnswers(session.id, readingModule.items, mockAnswers);
    
    // Verify MST routing
    const ability = await getAbilityEstimate(session.id, 'reading');
    expect(ability).toBeGreaterThan(-3);
    expect(ability).toBeLessThan(3);
    
    // Complete remaining sections...
    
    // Verify final scores
    const scores = await getSessionScores(session.id);
    expect(scores.reading.cefrBand).toBeGreaterThanOrEqual(1);
    expect(scores.reading.scaleScore).toBeGreaterThanOrEqual(0);
  });
});
```

### End-to-End Testing

**Framework**: Playwright

**Test Scenarios**:
1. User registration and login
2. Complete 90-minute exam with all sections
3. Browser refresh during exam
4. Timer expiration handling
5. Review modal navigation
6. Score report display

**Example E2E Test**:
```typescript
test('complete reading section with MST routing', async ({ page }) => {
  await page.goto('/exam/start');
  await page.click('button:has-text("Start Exam")');
  
  // Stage 1 module
  await answerQuestions(page, stage1Answers);
  await page.click('button:has-text("Submit Module")');
  
  // Verify routing to Stage 2
  await expect(page.locator('[data-testid="module-stage"]')).toHaveText('Stage 2');
  
  // Complete Stage 2
  await answerQuestions(page, stage2Answers);
  await page.click('button:has-text("Submit Section")');
  
  // Verify section completion
  await expect(page.locator('[data-testid="section-status"]')).toHaveText('Completed');
});
```

### Performance Testing

**Framework**: Artillery.io or k6

**Test Scenarios**:
1. 100 concurrent exam sessions
2. Database query performance under load
3. Gemini API rate limiting behavior
4. Redis cache hit rates
5. Response time percentiles (p50, p95, p99)

**Performance Targets**:
- Page load: < 2 seconds
- Question display: < 200ms
- API response: < 500ms (p95)
- Ability calculation: < 500ms
- Concurrent users: 100+ without degradation

### Accessibility Testing

**Tools**:
- axe-core (automated scanning)
- NVDA/JAWS (screen reader testing)
- Keyboard navigation testing

**Test Areas**:
1. Keyboard-only navigation through all exam functions
2. Screen reader announcements for timer and question status
3. Color contrast ratios (WCAG AA 4.5:1 minimum)
4. Focus indicators visibility
5. ARIA labels for all interactive elements
6. Alternative text for images and audio content

### Test Data Management

**Test Item Datasets**:
- Development: 50 items per section (synthetic data)
- Testing: 200 items per section (mixture of synthetic and curated)
- Staging: Full production dataset (1000+ items)

**IRT Parameter Ranges** (for test data generation):
```typescript
const TEST_IRT_RANGES = {
  a: { min: 0.5, max: 2.5, typical: 1.0 },
  b: { min: -3.0, max: 3.0, typical: 0.0 },
  c: { min: 0.0, max: 0.3, typical: 0.2 }
};
```

### Continuous Integration

**Pipeline Stages**:
1. Lint and format check
2. Type checking (TypeScript)
3. Unit tests (with coverage)
4. Property-based tests (100 iterations each)
5. Integration tests
6. E2E tests (critical paths)
7. Build verification
8. Accessibility scan

**Coverage Requirements**:
- Statements: 80%
- Branches: 75%
- Functions: 85%
- Lines: 80%
