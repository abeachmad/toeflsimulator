import { Request } from 'express';

/**
 * Extended Express Request types for the TOEFL Simulator API
 */

// Extend Express Request to include custom properties
declare global {
  namespace Express {
    interface Request {
      // User information from authentication middleware
      user?: {
        id: string;
        email: string;
        role: string;
      };
      
      // Session information
      sessionId?: string;
      
      // Validated request data
      validatedBody?: any;
      validatedQuery?: any;
      validatedParams?: any;
    }
  }
}

// Session-related request types
export interface CreateSessionRequest extends Request {
  body: {
    userId?: string;
    testMode?: 'full' | 'section';
    sections?: string[];
  };
}

export interface UpdateSessionRequest extends Request {
  params: {
    id: string;
  };
  body: {
    currentSection?: string;
    currentModule?: number;
    currentQuestion?: number;
    answers?: Record<string, any>;
    abilityEstimates?: Record<string, number>;
  };
}

export interface SubmitSectionRequest extends Request {
  params: {
    id: string;
  };
  body: {
    section: string;
    module: number;
    answers: Record<string, any>;
    timestamp: number;
  };
}

// Grading request types
export interface GradeWritingRequest extends Request {
  body: {
    text: string;
    taskType: 'build-sentence' | 'email' | 'academic-discussion';
    professorPrompt?: string;
    peerOpinions?: string[];
  };
}

export interface GradeSpeakingRequest extends Request {
  file?: Express.Multer.File;
  body: {
    referenceText: string;
    taskType: 'listen-repeat' | 'simulated-interview';
  };
}

// MST routing request types
export interface MSTRouteRequest extends Request {
  body: {
    sessionId: string;
    section: 'reading' | 'listening';
    stage: 1 | 2;
    responses: Array<{
      itemId: string;
      isCorrect: boolean;
      irtParameters: {
        a: number;
        b: number;
        c: number;
      };
    }>;
  };
}

// Timer validation request types
export interface TimerHeartbeatRequest extends Request {
  params: {
    sessionId: string;
  };
  body: {
    clientTimestamp: number;
  };
}

// Item retrieval request types
export interface GetItemsRequest extends Request {
  params: {
    section: string;
    type?: string;
  };
  query: {
    difficulty?: string;
    limit?: string;
    offset?: string;
  };
}
