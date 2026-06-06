/**
 * GeminiGraderService
 * 
 * AI-powered grading service using Google Gemini Flash API for TOEFL Writing and Speaking assessment.
 * Implements circuit breaker pattern for resilient error handling and retry logic.
 * 
 * Requirements:
 * - 17.1: Use @google/generative-ai SDK for API communications
 * - 17.2: Authenticate using Google Gemini API Free Tier credentials
 * - 17.3: Use Gemini Flash model for writing responses
 * - 17.5: Implement retry logic with exponential backoff
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';

// ============================================================================
// Type Definitions
// ============================================================================

export interface WritingGradeRequest {
  text: string;
  taskType: 'build-sentence' | 'email' | 'academic-discussion';
  professorPrompt?: string;
  peerOpinions?: string[];
}

export interface WritingScore {
  cefrBand: number; // 1-6
  scaleScore: number; // 0-30
  grammarCorrections: GrammarFeedback[];
  lexicalAnalysis: LexicalFeedback;
  needsReview?: boolean; // Flag for manual review when using fallback scores
}

export interface GrammarFeedback {
  originalText: string;
  correctedText: string;
  errorType: string;
  explanation: string;
}

export interface LexicalFeedback {
  vocabularyLevel: string;
  lexicalDiversity: number;
  academicWordCount: number;
  suggestions: string[];
}

export interface SpeakingAssessmentRequest {
  audioPath: string;
  referenceText: string;
  taskType: 'listen-repeat' | 'simulated-interview';
}

export interface SpeakingScore {
  accuracyScore: number; // 0-100
  fluencyScore: number; // 0-100
  prosodyScore: number; // 0-100
  completenessScore: number; // 0-100
  cefrBand: number; // 1-6
  scaleScore: number; // 0-30
  needsReview?: boolean; // Flag for manual review when using fallback scores
}

// ============================================================================
// Circuit Breaker Implementation
// ============================================================================

enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing - reject requests immediately
  HALF_OPEN = 'HALF_OPEN' // Testing - allow limited requests
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // milliseconds
  resetTimeout: number; // milliseconds
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private nextAttempt: number = Date.now();
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 60000,
      resetTimeout: config.resetTimeout ?? 30000
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
      // Transition to HALF_OPEN to test the service
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.config.resetTimeout;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
  }
}

// ============================================================================
// GeminiGraderService Class
// ============================================================================

export class GeminiGraderService {
  private ai: GoogleGenerativeAI;
  private fileManager: GoogleAIFileManager;
  private model: string = 'gemini-2.0-flash-exp';
  private circuitBreaker: CircuitBreaker;

  /**
   * Initialize GeminiGraderService with API key
   * Requirements: 17.1, 17.2
   * 
   * @param apiKey - Google Gemini API key
   * @param circuitBreakerConfig - Optional circuit breaker configuration
   */
  constructor(apiKey: string, circuitBreakerConfig?: Partial<CircuitBreakerConfig>) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Gemini API key is required');
    }

    this.ai = new GoogleGenerativeAI(apiKey);
    this.fileManager = new GoogleAIFileManager(apiKey);
    this.circuitBreaker = new CircuitBreaker(circuitBreakerConfig);
  }

  /**
   * Grade writing response using Gemini Flash model
   * Implements structured JSON output with response schema
   * Requirements: 5.5, 5.6, 5.7, 5.8, 5.9, 17.1, 17.3, 17.5, 19.2, 14.1, 14.2
   * 
   * @param request - Writing grade request with text and task metadata
   * @returns Writing score with CEFR band, scale score, and feedback
   */
  async gradeWriting(request: WritingGradeRequest): Promise<WritingScore> {
    try {
      return await this.circuitBreaker.execute(async () => {
        // Wrap grading with 30-second timeout (Requirement 14.1)
        return await this.withTimeout(
          this.retryWithBackoff(
            async () => this._gradeWritingInternal(request),
            3,
            1000
          ),
          30000 // 30 seconds
        );
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Gemini writing grading failed, returning fallback scores:', errorMessage);
      // Return default scores with manual review flag (Requirement 14.2, 14.3)
      return this.getDefaultWritingScore();
    }
  }

  /**
   * Internal writing grading logic
   */
  private async _gradeWritingInternal(request: WritingGradeRequest): Promise<WritingScore> {
    const { text, taskType, professorPrompt, peerOpinions } = request;

    // Define strict response schema
    const responseSchema = {
      type: SchemaType.OBJECT,
      properties: {
        cefrBand: {
          type: SchemaType.NUMBER,
          description: 'CEFR band score from 1 to 6',
        },
        scaleScore: {
          type: SchemaType.NUMBER,
          description: 'Equivalent scale score from 0 to 30',
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
    const systemPrompt = `You are an expert TOEFL iBT writing assessor. Evaluate the following writing response according to official ETS 2026 rubrics.`;

    let userPrompt = '';

    if (taskType === 'academic-discussion') {
      userPrompt = `
Professor Prompt: ${professorPrompt || 'N/A'}

Peer Opinions:
${peerOpinions?.join('\n\n') || 'None'}

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
          responseSchema: responseSchema as any,
          temperature: 0.2,
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

      // Clamp scores to valid ranges (Requirements 5.6, 5.7)
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
      throw error;
    }
  }

  /**
   * Assess pronunciation using Gemini Flash Pronunciation API
   * Uploads audio file and extracts pronunciation metrics
   * Requirements: 6.3, 6.4, 6.5, 6.6, 6.7, 17.1, 17.4, 17.5, 19.2, 14.1, 14.2
   * 
   * @param audioPath - Path to audio file (WAV format)
   * @param referenceText - Expected text that should have been spoken
   * @returns Speaking score with pronunciation metrics and CEFR/scale scores
   */
  async assessPronunciation(audioPath: string, referenceText: string): Promise<SpeakingScore> {
    try {
      return await this.circuitBreaker.execute(async () => {
        // Wrap assessment with 30-second timeout (Requirement 14.1)
        return await this.withTimeout(
          this.retryWithBackoff(
            async () => this._assessPronunciationInternal(audioPath, referenceText),
            3,
            1000
          ),
          30000 // 30 seconds
        );
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Gemini pronunciation assessment failed, returning fallback scores:', errorMessage);
      // Return default scores with manual review flag (Requirement 14.2, 14.3)
      return this.getDefaultSpeakingScore();
    }
  }

  /**
   * Internal pronunciation assessment logic
   */
  private async _assessPronunciationInternal(audioPath: string, referenceText: string): Promise<SpeakingScore> {

    try {
      // Step 1: Upload audio file
      const uploadResult = await this.fileManager.uploadFile(audioPath, {
        mimeType: 'audio/wav',
        displayName: `speaking-response-${Date.now()}`
      });

      console.log(`Uploaded audio file: ${uploadResult.file.uri}`);

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
          },
          fluencyScore: {
            type: SchemaType.NUMBER,
            description: 'Speaking fluency (0-100)',
          },
          prosodyScore: {
            type: SchemaType.NUMBER,
            description: 'Prosody and intonation (0-100)',
          },
          completenessScore: {
            type: SchemaType.NUMBER,
            description: 'Response completeness (0-100)',
          }
        },
        required: ['accuracyScore', 'fluencyScore', 'prosodyScore', 'completenessScore']
      };

      // Step 4: Call Gemini Flash model with audio
      const model = this.ai.getGenerativeModel({
        model: this.model,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema as any,
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

      // Calculate composite score
      const compositeScore = (
        assessmentData.accuracyScore * 0.4 +
        assessmentData.fluencyScore * 0.3 +
        assessmentData.prosodyScore * 0.2 +
        assessmentData.completenessScore * 0.1
      );

      // Map composite score to CEFR and scale score
      const cefrBand = Math.ceil(compositeScore / 100 * 6);
      const clampedCEFR = Math.max(1, Math.min(6, cefrBand));

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
      throw error;
    }
  }

  /**
   * Retry function with exponential backoff
   * Requirement: 17.5
   * 
   * @param fn - Function to retry
   * @param maxRetries - Maximum number of retry attempts
   * @param baseDelay - Base delay in milliseconds
   * @returns Result of the function
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    baseDelay: number
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Retry failed with unknown error');
  }

  /**
   * Wrap a promise with a timeout
   * Requirement: 14.1
   * 
   * @param promise - Promise to wrap with timeout
   * @param timeoutMs - Timeout in milliseconds
   * @returns Result of the promise or throws timeout error
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Get circuit breaker state for monitoring
   */
  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  /**
   * Reset circuit breaker manually
   */
  resetCircuit(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Get default writing score for error scenarios
   * Requirement: 19.2, 14.2
   */
  getDefaultWritingScore(): WritingScore {
    return {
      cefrBand: 3,
      scaleScore: 15,
      grammarCorrections: [],
      lexicalAnalysis: {
        vocabularyLevel: 'error',
        lexicalDiversity: 0,
        academicWordCount: 0,
        suggestions: ['Grading service temporarily unavailable. Please try again later.']
      },
      needsReview: true // Flag for manual review (Requirement 14.2)
    };
  }

  /**
   * Get default speaking score for error scenarios
   * Requirement: 19.2, 14.2
   */
  getDefaultSpeakingScore(): SpeakingScore {
    return {
      accuracyScore: 50,
      fluencyScore: 50,
      prosodyScore: 50,
      completenessScore: 50,
      cefrBand: 3,
      scaleScore: 15,
      needsReview: true // Flag for manual review (Requirement 14.2)
    };
  }
}
