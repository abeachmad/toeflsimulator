import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Pool } from 'pg';
import { IRT3PLScorer } from './IRT3PLScorer.js';
import { Item, ItemResponse, Section } from '../models/irt.types.js';
import * as fc from 'fast-check';

describe('IRT3PLScorer', () => {
  let mockPool: Pool;
  let scorer: IRT3PLScorer;

  beforeEach(() => {
    // Mock the database pool
    mockPool = {
      query: vi.fn()
    } as any;
    
    scorer = new IRT3PLScorer(mockPool);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('calculate3PLProbability', () => {
    it('should calculate probability using 3PL formula', () => {
      // Test with typical parameters
      const theta = 0.5;
      const a = 1.2;
      const b = -0.3;
      const c = 0.2;
      
      const probability = scorer.calculate3PLProbability(theta, a, b, c);
      
      // Expected: c + (1-c) / (1 + exp(-1.702*a*(θ-b)))
      // = 0.2 + (1-0.2) / (1 + exp(-1.702*1.2*(0.5-(-0.3))))
      // = 0.2 + 0.8 / (1 + exp(-1.702*1.2*0.8))
      // = 0.2 + 0.8 / (1 + exp(-1.63392))
      // ≈ 0.2 + 0.8 / (1 + 0.195)
      // ≈ 0.2 + 0.8 / 1.195
      // ≈ 0.2 + 0.669
      // ≈ 0.869
      
      expect(probability).toBeGreaterThan(0.8);
      expect(probability).toBeLessThan(1.0);
      expect(probability).toBeCloseTo(0.869, 2);
    });

    it('should return value between 0 and 1', () => {
      const probability = scorer.calculate3PLProbability(0, 1, 0, 0.25);
      
      expect(probability).toBeGreaterThanOrEqual(0);
      expect(probability).toBeLessThanOrEqual(1);
    });

    it('should approach c when theta is very low', () => {
      const c = 0.25;
      const probability = scorer.calculate3PLProbability(-5, 1.5, 0, c);
      
      // At very low ability, probability should approach guessing parameter
      expect(probability).toBeCloseTo(c, 1);
    });

    it('should approach 1 when theta is very high', () => {
      const probability = scorer.calculate3PLProbability(5, 1.5, 0, 0.2);
      
      // At very high ability, probability should approach 1
      expect(probability).toBeGreaterThan(0.95);
    });

    it('should handle edge cases with extreme parameters', () => {
      // Minimum discrimination, maximum difficulty, maximum guessing
      const prob1 = scorer.calculate3PLProbability(0, 0.5, 3, 0.3);
      expect(prob1).toBeGreaterThanOrEqual(0);
      expect(prob1).toBeLessThanOrEqual(1);
      
      // Maximum discrimination, minimum difficulty, minimum guessing
      const prob2 = scorer.calculate3PLProbability(0, 2.5, -3, 0);
      expect(prob2).toBeGreaterThanOrEqual(0);
      expect(prob2).toBeLessThanOrEqual(1);
    });
  });

  describe('estimateAbilityMLE', () => {
    const createMockItem = (id: string, a: number, b: number, c: number): Item => ({
      id,
      section: 'reading' as Section,
      type: 'multiple-choice',
      difficulty_level: 'medium',
      content: 'Test question',
      correct_answer: 'A',
      irt_parameters: { a, b, c }
    });

    it('should return 0 for empty response array', () => {
      const theta = scorer.estimateAbilityMLE([], []);
      expect(theta).toBe(0.0);
    });

    it('should estimate positive ability for all correct responses', () => {
      const items: Item[] = [
        createMockItem('item-1', 1.0, -0.5, 0.2),
        createMockItem('item-2', 1.2, 0.0, 0.25),
        createMockItem('item-3', 1.5, 0.5, 0.2)
      ];
      
      const responses: ItemResponse[] = [
        { itemId: 'item-1', isCorrect: true },
        { itemId: 'item-2', isCorrect: true },
        { itemId: 'item-3', isCorrect: true }
      ];
      
      const theta = scorer.estimateAbilityMLE(responses, items);
      
      // All correct should give positive theta
      expect(theta).toBeGreaterThan(0);
      expect(theta).toBeLessThanOrEqual(3.0);
    });

    it('should estimate negative ability for all incorrect responses', () => {
      const items: Item[] = [
        createMockItem('item-1', 1.0, -0.5, 0.2),
        createMockItem('item-2', 1.2, 0.0, 0.25),
        createMockItem('item-3', 1.5, 0.5, 0.2)
      ];
      
      const responses: ItemResponse[] = [
        { itemId: 'item-1', isCorrect: false },
        { itemId: 'item-2', isCorrect: false },
        { itemId: 'item-3', isCorrect: false }
      ];
      
      const theta = scorer.estimateAbilityMLE(responses, items);
      
      // All incorrect should give negative theta
      expect(theta).toBeLessThan(0);
      expect(theta).toBeGreaterThanOrEqual(-3.0);
    });

    it('should estimate moderate ability for mixed responses', () => {
      const items: Item[] = [
        createMockItem('item-1', 1.0, -0.5, 0.2),
        createMockItem('item-2', 1.2, 0.0, 0.25),
        createMockItem('item-3', 1.5, 0.5, 0.2),
        createMockItem('item-4', 1.1, 0.3, 0.2)
      ];
      
      const responses: ItemResponse[] = [
        { itemId: 'item-1', isCorrect: true },
        { itemId: 'item-2', isCorrect: true },
        { itemId: 'item-3', isCorrect: false },
        { itemId: 'item-4', isCorrect: false }
      ];
      
      const theta = scorer.estimateAbilityMLE(responses, items);
      
      // Mixed responses should give moderate theta
      expect(theta).toBeGreaterThanOrEqual(-3.0);
      expect(theta).toBeLessThanOrEqual(3.0);
    });

    it('should clamp theta to valid range [-3, 3]', () => {
      const items: Item[] = Array.from({ length: 20 }, (_, i) => 
        createMockItem(`item-${i}`, 2.0, -2.0, 0.1)
      );
      
      const responses: ItemResponse[] = items.map(item => ({
        itemId: item.id,
        isCorrect: true
      }));
      
      const theta = scorer.estimateAbilityMLE(responses, items);
      
      expect(theta).toBeGreaterThanOrEqual(-3.0);
      expect(theta).toBeLessThanOrEqual(3.0);
    });

    it('should handle items with missing IRT parameters gracefully', () => {
      const items: Item[] = [
        createMockItem('item-1', 1.0, 0, 0.2),
        createMockItem('item-2', 1.2, 0, 0.25)
      ];
      
      const responses: ItemResponse[] = [
        { itemId: 'item-1', isCorrect: true },
        { itemId: 'item-2', isCorrect: false },
        { itemId: 'item-3', isCorrect: true } // Non-existent item
      ];
      
      const theta = scorer.estimateAbilityMLE(responses, items);
      
      // Should still compute based on valid items
      expect(theta).toBeGreaterThanOrEqual(-3.0);
      expect(theta).toBeLessThanOrEqual(3.0);
    });
  });

  describe('convertToCEFR', () => {
    it('should convert theta to CEFR band using database lookup', async () => {
      const mockQueryResult = {
        rows: [{ cefr_band: 4 }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      };
      
      vi.mocked(mockPool.query).mockResolvedValue(mockQueryResult);
      
      const cefrBand = await scorer.convertToCEFR(0.5, 'reading');
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT cefr_band'),
        ['reading', 0.5]
      );
      expect(cefrBand).toBe(4);
    });

    it('should use fallback when database returns no rows', async () => {
      const mockQueryResult = {
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      };
      
      vi.mocked(mockPool.query).mockResolvedValue(mockQueryResult);
      
      const cefrBand = await scorer.convertToCEFR(0.5, 'reading');
      
      expect(cefrBand).toBeGreaterThanOrEqual(1);
      expect(cefrBand).toBeLessThanOrEqual(6);
    });

    it('should use fallback on database error', async () => {
      vi.mocked(mockPool.query).mockRejectedValue(new Error('Database error'));
      
      const cefrBand = await scorer.convertToCEFR(0, 'listening');
      
      expect(cefrBand).toBeGreaterThanOrEqual(1);
      expect(cefrBand).toBeLessThanOrEqual(6);
    });

    it('should map extreme theta values correctly in fallback', async () => {
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });
      
      const lowCEFR = await scorer.convertToCEFR(-3, 'reading');
      const highCEFR = await scorer.convertToCEFR(3, 'writing');
      
      expect(lowCEFR).toBe(1);
      expect(highCEFR).toBe(6);
    });
  });

  describe('convertToScaleScore', () => {
    it('should convert theta to scale score using database lookup', async () => {
      const mockQueryResult = {
        rows: [{ scale_score: 22 }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      };
      
      vi.mocked(mockPool.query).mockResolvedValue(mockQueryResult);
      
      const scaleScore = await scorer.convertToScaleScore(0.8, 'speaking');
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT scale_score'),
        ['speaking', 0.8]
      );
      expect(scaleScore).toBe(22);
    });

    it('should use fallback when database returns no rows', async () => {
      const mockQueryResult = {
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      };
      
      vi.mocked(mockPool.query).mockResolvedValue(mockQueryResult);
      
      const scaleScore = await scorer.convertToScaleScore(0.5, 'reading');
      
      expect(scaleScore).toBeGreaterThanOrEqual(0);
      expect(scaleScore).toBeLessThanOrEqual(30);
    });

    it('should use fallback on database error', async () => {
      vi.mocked(mockPool.query).mockRejectedValue(new Error('Database error'));
      
      const scaleScore = await scorer.convertToScaleScore(-0.5, 'listening');
      
      expect(scaleScore).toBeGreaterThanOrEqual(0);
      expect(scaleScore).toBeLessThanOrEqual(30);
    });

    it('should map extreme theta values correctly in fallback', async () => {
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });
      
      const lowScore = await scorer.convertToScaleScore(-3, 'reading');
      const highScore = await scorer.convertToScaleScore(3, 'writing');
      
      expect(lowScore).toBe(0);
      expect(highScore).toBe(30);
    });

    it('should map middle theta to middle scale score in fallback', async () => {
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });
      
      const midScore = await scorer.convertToScaleScore(0, 'reading');
      
      expect(midScore).toBe(15);
    });
  });

  describe('clampScores', () => {
    it('should clamp CEFR band above 6 to 6', () => {
      const result = scorer.clampScores({ cefrBand: 8, scaleScore: 25 });
      
      expect(result.cefrBand).toBe(6);
      expect(result.scaleScore).toBe(25);
    });

    it('should clamp CEFR band below 1 to 1', () => {
      const result = scorer.clampScores({ cefrBand: -2, scaleScore: 15 });
      
      expect(result.cefrBand).toBe(1);
      expect(result.scaleScore).toBe(15);
    });

    it('should clamp scale score above 30 to 30', () => {
      const result = scorer.clampScores({ cefrBand: 4, scaleScore: 45 });
      
      expect(result.cefrBand).toBe(4);
      expect(result.scaleScore).toBe(30);
    });

    it('should clamp scale score below 0 to 0', () => {
      const result = scorer.clampScores({ cefrBand: 3, scaleScore: -10 });
      
      expect(result.cefrBand).toBe(3);
      expect(result.scaleScore).toBe(0);
    });

    it('should not modify valid scores', () => {
      const result = scorer.clampScores({ cefrBand: 4, scaleScore: 22 });
      
      expect(result.cefrBand).toBe(4);
      expect(result.scaleScore).toBe(22);
    });

    it('should clamp both scores if both are out of range', () => {
      const result = scorer.clampScores({ cefrBand: 10, scaleScore: -50 });
      
      expect(result.cefrBand).toBe(6);
      expect(result.scaleScore).toBe(0);
    });

    it('should handle boundary values correctly', () => {
      const result1 = scorer.clampScores({ cefrBand: 1, scaleScore: 0 });
      expect(result1.cefrBand).toBe(1);
      expect(result1.scaleScore).toBe(0);
      
      const result2 = scorer.clampScores({ cefrBand: 6, scaleScore: 30 });
      expect(result2.cefrBand).toBe(6);
      expect(result2.scaleScore).toBe(30);
    });
  });

  describe('Edge Cases - Empty Response Arrays', () => {
    it('should handle empty responses with empty items', () => {
      const theta = scorer.estimateAbilityMLE([], []);
      expect(theta).toBe(0.0);
    });

    it('should handle undefined or null in response array', () => {
      const items: Item[] = [
        {
          id: 'item-1',
          section: 'reading' as Section,
          type: 'multiple-choice',
          difficulty_level: 'medium',
          content: 'Test',
          correct_answer: 'A',
          irt_parameters: { a: 1.0, b: 0, c: 0.2 }
        }
      ];
      
      const responses: ItemResponse[] = [
        null as any,
        { itemId: 'item-1', isCorrect: true }
      ];
      
      const theta = scorer.estimateAbilityMLE(responses, items);
      expect(theta).toBeGreaterThanOrEqual(-3.0);
      expect(theta).toBeLessThanOrEqual(3.0);
    });
  });

  describe('Edge Cases - Extreme Ability Values', () => {
    const createMockItem = (id: string, a: number, b: number, c: number): Item => ({
      id,
      section: 'reading' as Section,
      type: 'multiple-choice',
      difficulty_level: 'medium',
      content: 'Test question',
      correct_answer: 'A',
      irt_parameters: { a, b, c }
    });

    it('should handle extreme negative ability (-3)', () => {
      const items: Item[] = [
        createMockItem('item-1', 1.0, -2.5, 0.2),
        createMockItem('item-2', 1.2, -2.0, 0.25)
      ];
      
      const responses: ItemResponse[] = [
        { itemId: 'item-1', isCorrect: false },
        { itemId: 'item-2', isCorrect: false }
      ];
      
      const theta = scorer.estimateAbilityMLE(responses, items);
      expect(theta).toBeGreaterThanOrEqual(-3.0);
      expect(theta).toBeLessThan(0);
    });

    it('should handle zero ability', () => {
      const items: Item[] = [
        createMockItem('item-1', 1.0, 0.0, 0.2),
        createMockItem('item-2', 1.2, 0.0, 0.25)
      ];
      
      const responses: ItemResponse[] = [
        { itemId: 'item-1', isCorrect: true },
        { itemId: 'item-2', isCorrect: false }
      ];
      
      const theta = scorer.estimateAbilityMLE(responses, items);
      expect(theta).toBeGreaterThanOrEqual(-1.0);
      expect(theta).toBeLessThanOrEqual(1.0);
    });

    it('should handle extreme positive ability (+3)', () => {
      const items: Item[] = [
        createMockItem('item-1', 1.0, 2.0, 0.2),
        createMockItem('item-2', 1.5, 2.5, 0.15)
      ];
      
      const responses: ItemResponse[] = [
        { itemId: 'item-1', isCorrect: true },
        { itemId: 'item-2', isCorrect: true }
      ];
      
      const theta = scorer.estimateAbilityMLE(responses, items);
      expect(theta).toBeGreaterThan(0);
      expect(theta).toBeLessThanOrEqual(3.0);
    });

    it('should calculate probability correctly for extreme negative theta (-3)', () => {
      const prob = scorer.calculate3PLProbability(-3, 1.5, 0, 0.25);
      
      // At theta = -3, probability should be close to guessing parameter
      expect(prob).toBeGreaterThanOrEqual(0.25);
      expect(prob).toBeLessThan(0.35);
    });

    it('should calculate probability correctly for zero theta', () => {
      const prob = scorer.calculate3PLProbability(0, 1.0, 0, 0.2);
      
      // At theta = 0, b = 0, probability should be midpoint
      // P = 0.2 + 0.8 / (1 + exp(0)) = 0.2 + 0.8/2 = 0.6
      expect(prob).toBeCloseTo(0.6, 1);
    });

    it('should calculate probability correctly for extreme positive theta (+3)', () => {
      const prob = scorer.calculate3PLProbability(3, 1.5, 0, 0.2);
      
      // At theta = 3, probability should be close to 1
      expect(prob).toBeGreaterThan(0.95);
      expect(prob).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Edge Cases - Boundary IRT Parameters', () => {
    it('should handle minimum discrimination (a = 0.5)', () => {
      const prob = scorer.calculate3PLProbability(0, 0.5, 0, 0.2);
      expect(prob).toBeGreaterThanOrEqual(0);
      expect(prob).toBeLessThanOrEqual(1);
    });

    it('should handle maximum discrimination (a = 2.5)', () => {
      const prob = scorer.calculate3PLProbability(0, 2.5, 0, 0.2);
      expect(prob).toBeGreaterThanOrEqual(0);
      expect(prob).toBeLessThanOrEqual(1);
    });

    it('should handle minimum difficulty (b = -3)', () => {
      const prob = scorer.calculate3PLProbability(0, 1.0, -3, 0.2);
      // Easy item, should have high probability
      expect(prob).toBeGreaterThan(0.8);
    });

    it('should handle maximum difficulty (b = 3)', () => {
      const prob = scorer.calculate3PLProbability(0, 1.0, 3, 0.2);
      // Hard item, should have low probability
      expect(prob).toBeLessThan(0.4);
    });

    it('should handle minimum guessing (c = 0)', () => {
      const prob = scorer.calculate3PLProbability(-5, 1.0, 0, 0);
      // With no guessing, very low ability should give very low probability
      expect(prob).toBeLessThan(0.1);
    });

    it('should handle maximum guessing (c = 0.3)', () => {
      const prob = scorer.calculate3PLProbability(-5, 1.0, 0, 0.3);
      // With maximum guessing, probability should not go below 0.3
      expect(prob).toBeGreaterThanOrEqual(0.3);
      expect(prob).toBeLessThan(0.35);
    });

    it('should handle all boundary parameters combined', () => {
      const prob1 = scorer.calculate3PLProbability(-3, 0.5, -3, 0);
      expect(prob1).toBeGreaterThanOrEqual(0);
      expect(prob1).toBeLessThanOrEqual(1);
      
      const prob2 = scorer.calculate3PLProbability(3, 2.5, 3, 0.3);
      expect(prob2).toBeGreaterThanOrEqual(0);
      expect(prob2).toBeLessThanOrEqual(1);
    });
  });

  describe('Edge Cases - Database Fallback Logic', () => {
    it('should use fallback when database connection fails for CEFR', async () => {
      vi.mocked(mockPool.query).mockRejectedValue(new Error('Connection timeout'));
      
      const cefrBand = await scorer.convertToCEFR(1.5, 'reading');
      
      expect(cefrBand).toBeGreaterThanOrEqual(1);
      expect(cefrBand).toBeLessThanOrEqual(6);
    });

    it('should use fallback when database returns null row for CEFR', async () => {
      const mockQueryResult = {
        rows: [null] as any,
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      };
      
      vi.mocked(mockPool.query).mockResolvedValue(mockQueryResult);
      
      const cefrBand = await scorer.convertToCEFR(0.5, 'listening');
      
      expect(cefrBand).toBeGreaterThanOrEqual(1);
      expect(cefrBand).toBeLessThanOrEqual(6);
    });

    it('should use fallback when database connection fails for scale score', async () => {
      vi.mocked(mockPool.query).mockRejectedValue(new Error('Connection timeout'));
      
      const scaleScore = await scorer.convertToScaleScore(1.5, 'writing');
      
      expect(scaleScore).toBeGreaterThanOrEqual(0);
      expect(scaleScore).toBeLessThanOrEqual(30);
    });

    it('should use fallback when database returns null row for scale score', async () => {
      const mockQueryResult = {
        rows: [null] as any,
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      };
      
      vi.mocked(mockPool.query).mockResolvedValue(mockQueryResult);
      
      const scaleScore = await scorer.convertToScaleScore(-0.5, 'speaking');
      
      expect(scaleScore).toBeGreaterThanOrEqual(0);
      expect(scaleScore).toBeLessThanOrEqual(30);
    });

    it('should map theta consistently in fallback for all sections', async () => {
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });
      
      const sections: Section[] = ['reading', 'listening', 'writing', 'speaking'];
      
      for (const section of sections) {
        const cefrLow = await scorer.convertToCEFR(-3, section);
        const cefrMid = await scorer.convertToCEFR(0, section);
        const cefrHigh = await scorer.convertToCEFR(3, section);
        
        expect(cefrLow).toBe(1);
        expect(cefrMid).toBeGreaterThanOrEqual(3);
        expect(cefrMid).toBeLessThanOrEqual(4);
        expect(cefrHigh).toBe(6);
        
        const scaleLow = await scorer.convertToScaleScore(-3, section);
        const scaleMid = await scorer.convertToScaleScore(0, section);
        const scaleHigh = await scorer.convertToScaleScore(3, section);
        
        expect(scaleLow).toBe(0);
        expect(scaleMid).toBe(15);
        expect(scaleHigh).toBe(30);
      }
    });

    it('should handle database returning undefined values', async () => {
      const mockQueryResult = {
        rows: [{ cefr_band: undefined, scale_score: undefined }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      };
      
      vi.mocked(mockPool.query).mockResolvedValue(mockQueryResult);
      
      const cefrBand = await scorer.convertToCEFR(0, 'reading');
      const scaleScore = await scorer.convertToScaleScore(0, 'reading');
      
      // Should use fallback when values are undefined
      expect(cefrBand).toBeGreaterThanOrEqual(1);
      expect(cefrBand).toBeLessThanOrEqual(6);
      expect(scaleScore).toBeGreaterThanOrEqual(0);
      expect(scaleScore).toBeLessThanOrEqual(30);
    });

    it('should handle database query rejection with different error types', async () => {
      const errors = [
        new Error('Connection refused'),
        new Error('Query timeout'),
        new Error('Network error'),
        new Error('Permission denied')
      ];
      
      for (const error of errors) {
        vi.mocked(mockPool.query).mockRejectedValue(error);
        
        const cefrBand = await scorer.convertToCEFR(0.5, 'reading');
        const scaleScore = await scorer.convertToScaleScore(0.5, 'reading');
        
        expect(cefrBand).toBeGreaterThanOrEqual(1);
        expect(cefrBand).toBeLessThanOrEqual(6);
        expect(scaleScore).toBeGreaterThanOrEqual(0);
        expect(scaleScore).toBeLessThanOrEqual(30);
      }
    });

    it('should handle fallback with theta values between standard ranges', async () => {
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });
      
      const thetaValues = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
      
      for (const theta of thetaValues) {
        const cefrBand = await scorer.convertToCEFR(theta, 'reading');
        const scaleScore = await scorer.convertToScaleScore(theta, 'reading');
        
        expect(cefrBand).toBeGreaterThanOrEqual(1);
        expect(cefrBand).toBeLessThanOrEqual(6);
        expect(scaleScore).toBeGreaterThanOrEqual(0);
        expect(scaleScore).toBeLessThanOrEqual(30);
        
        // Verify monotonic relationship: higher theta = higher scores
        if (theta > 0) {
          expect(cefrBand).toBeGreaterThanOrEqual(3);
          expect(scaleScore).toBeGreaterThanOrEqual(15);
        } else if (theta < 0) {
          expect(cefrBand).toBeLessThanOrEqual(4);
          expect(scaleScore).toBeLessThanOrEqual(16);
        }
      }
    });
  });
});
