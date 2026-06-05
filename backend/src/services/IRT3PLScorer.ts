import { Pool } from 'pg';
import {
  Item,
  ItemResponse,
  Section,
  ScoreResult,
  CEFRConversionRow
} from '../models/irt.types.js';

/**
 * IRT 3-Parameter Logistic (3PL) Scorer
 * Implements Item Response Theory scoring for TOEFL iBT 2026 simulator
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 5.6, 5.7, 9.1, 9.2, 9.3
 */
export class IRT3PLScorer {
  // IRT model constants
  private static readonly D = 1.702; // Scaling constant
  private static readonly MAX_ITERATIONS = 50;
  private static readonly CONVERGENCE_CRITERION = 0.001;
  private static readonly MIN_THETA = -3.0;
  private static readonly MAX_THETA = 3.0;
  private static readonly MIN_CEFR = 1;
  private static readonly MAX_CEFR = 6;
  private static readonly MIN_SCALE_SCORE = 0;
  private static readonly MAX_SCALE_SCORE = 30;

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
   * 
   * Validates: Requirements 7.1, 7.2
   */
  calculate3PLProbability(theta: number, a: number, b: number, c: number): number {
    const exponent = -IRT3PLScorer.D * a * (theta - b);
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
   * 
   * Validates: Requirements 7.3, 7.5
   */
  estimateAbilityMLE(responses: ItemResponse[], items: Item[]): number {
    if (responses.length === 0) {
      return 0.0; // Default ability for no responses
    }

    let theta = 0.0; // Initial estimate
    
    for (let iteration = 0; iteration < IRT3PLScorer.MAX_ITERATIONS; iteration++) {
      let firstDerivative = 0.0;
      let secondDerivative = 0.0;
      
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        if (!response) continue;
        
        const item = items.find(it => it.id === response.itemId);
        
        if (!item) continue;
        
        const { a, b, c } = item.irt_parameters;
        
        // Calculate P(θ) - probability of correct response
        const P = this.calculate3PLProbability(theta, a, b, c);
        
        // Calculate Q(θ) = 1 - P(θ)
        const Q = 1 - P;
        
        // Calculate W(θ) = (P - c) / (1 - c)
        const W = (P - c) / (1 - c);
        
        // First derivative of log-likelihood
        const u_i = response.isCorrect ? 1 : 0;
        firstDerivative += IRT3PLScorer.D * a * (u_i - P) * W / (P * Q);
        
        // Second derivative of log-likelihood
        const numerator = Math.pow(IRT3PLScorer.D * a, 2) * W * (u_i * (W - 1) - P * (1 - W));
        const denominator = Math.pow(P, 2) * Math.pow(Q, 2);
        secondDerivative += numerator / denominator;
      }
      
      // Check for zero or near-zero second derivative to avoid division by zero
      if (Math.abs(secondDerivative) < 1e-10) {
        break;
      }
      
      // Newton-Raphson update
      const delta = firstDerivative / Math.abs(secondDerivative);
      theta = theta + delta;
      
      // Prevent extreme values
      theta = Math.max(IRT3PLScorer.MIN_THETA, Math.min(IRT3PLScorer.MAX_THETA, theta));
      
      // Check convergence
      if (Math.abs(delta) < IRT3PLScorer.CONVERGENCE_CRITERION) {
        break;
      }
    }
    
    return theta;
  }

  /**
   * Convert ability estimate to CEFR band (1-6)
   * Uses official ETS 2026 conversion table with database lookup
   * 
   * @param theta - Ability estimate
   * @param section - Test section (reading, listening, writing, speaking)
   * @returns CEFR band score (1-6)
   * 
   * Validates: Requirements 9.1, 9.3
   */
  async convertToCEFR(theta: number, section: Section): Promise<number> {
    try {
      const query = `
        SELECT cefr_band
        FROM cefr_conversion
        WHERE section = $1
          AND theta_min <= $2
          AND theta_max >= $2
        LIMIT 1
      `;
      
      const result = await this.db.query<CEFRConversionRow>(query, [section, theta]);
      
      if (result.rows.length === 0 || !result.rows[0] || result.rows[0].cefr_band === undefined) {
        // Fallback: return appropriate band based on theta
        return this.fallbackThetaToCEFR(theta);
      }
      
      return result.rows[0].cefr_band;
    } catch (error) {
      console.error('Error converting theta to CEFR:', error);
      // Fallback on database error
      return this.fallbackThetaToCEFR(theta);
    }
  }

  /**
   * Fallback method to convert theta to CEFR when database lookup fails
   * Maps theta range [-3, 3] to CEFR bands [1, 6]
   */
  private fallbackThetaToCEFR(theta: number): number {
    // Clamp theta to valid range
    const clampedTheta = Math.max(IRT3PLScorer.MIN_THETA, Math.min(IRT3PLScorer.MAX_THETA, theta));
    
    // Simple linear mapping from theta to CEFR
    // theta -3 → CEFR 1, theta 0 → CEFR 3.5, theta 3 → CEFR 6
    const normalized = (clampedTheta - IRT3PLScorer.MIN_THETA) / 
                      (IRT3PLScorer.MAX_THETA - IRT3PLScorer.MIN_THETA); // 0 to 1
    const cefrFloat = IRT3PLScorer.MIN_CEFR + normalized * (IRT3PLScorer.MAX_CEFR - IRT3PLScorer.MIN_CEFR);
    
    return Math.round(cefrFloat);
  }

  /**
   * Convert ability estimate to scale score (0-30)
   * Uses official ETS 2026 conversion table with database lookup
   * 
   * @param theta - Ability estimate
   * @param section - Test section (reading, listening, writing, speaking)
   * @returns Scale score (0-30)
   * 
   * Validates: Requirements 9.2, 9.3
   */
  async convertToScaleScore(theta: number, section: Section): Promise<number> {
    try {
      const query = `
        SELECT scale_score
        FROM cefr_conversion
        WHERE section = $1
          AND theta_min <= $2
          AND theta_max >= $2
        LIMIT 1
      `;
      
      const result = await this.db.query<CEFRConversionRow>(query, [section, theta]);
      
      if (result.rows.length === 0 || !result.rows[0] || result.rows[0].scale_score === undefined) {
        // Fallback: linear interpolation
        return this.fallbackThetaToScaleScore(theta);
      }
      
      return result.rows[0].scale_score;
    } catch (error) {
      console.error('Error converting theta to scale score:', error);
      // Fallback on database error
      return this.fallbackThetaToScaleScore(theta);
    }
  }

  /**
   * Fallback method to convert theta to scale score when database lookup fails
   * Maps theta range [-3, 3] to scale scores [0, 30]
   */
  private fallbackThetaToScaleScore(theta: number): number {
    // Clamp theta to valid range
    const clampedTheta = Math.max(IRT3PLScorer.MIN_THETA, Math.min(IRT3PLScorer.MAX_THETA, theta));
    
    // Linear interpolation: Map [-3, 3] to [0, 30]
    const normalized = (clampedTheta - IRT3PLScorer.MIN_THETA) / 
                      (IRT3PLScorer.MAX_THETA - IRT3PLScorer.MIN_THETA); // 0 to 1
    const scaleScore = normalized * IRT3PLScorer.MAX_SCALE_SCORE;
    
    return Math.round(scaleScore);
  }

  /**
   * Clamp CEFR and scale scores to valid ranges
   * Required by Requirements 5.6, 5.7
   * 
   * @param scores - Scores object containing cefrBand and scaleScore
   * @returns Clamped scores with cefrBand [1-6] and scaleScore [0-30]
   * 
   * Validates: Requirements 5.6, 5.7
   */
  clampScores(scores: ScoreResult): ScoreResult {
    return {
      cefrBand: Math.max(
        IRT3PLScorer.MIN_CEFR,
        Math.min(IRT3PLScorer.MAX_CEFR, scores.cefrBand)
      ),
      scaleScore: Math.max(
        IRT3PLScorer.MIN_SCALE_SCORE,
        Math.min(IRT3PLScorer.MAX_SCALE_SCORE, scores.scaleScore)
      )
    };
  }
}
