/**
 * Type definitions for IRT (Item Response Theory) models
 */

export interface IRTParameters {
  a: number; // Discrimination parameter (0.5 to 2.5)
  b: number; // Difficulty parameter (-3 to +3)
  c: number; // Guessing parameter (0.0 to 0.3)
}

export interface Item {
  id: string;
  section: Section;
  type: string;
  difficulty_level?: DifficultyLevel;
  content: string;
  options?: string[];
  correct_answer: string;
  irt_parameters: IRTParameters;
  metadata?: Record<string, any>;
}

export interface ItemResponse {
  itemId: string;
  isCorrect: boolean;
  timestamp?: Date;
}

export type Section = 'reading' | 'listening' | 'writing' | 'speaking';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface ScoreResult {
  cefrBand: number; // 1-6
  scaleScore: number; // 0-30
}

export interface CEFRConversionRow {
  section: Section;
  theta_min: number;
  theta_max: number;
  cefr_band: number;
  scale_score: number;
}
