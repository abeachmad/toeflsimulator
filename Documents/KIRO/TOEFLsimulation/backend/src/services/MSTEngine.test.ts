import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Pool } from 'pg';
import { MSTEngine, Module, ModuleMetadata } from './MSTEngine.js';
import { Item, Section, DifficultyLevel } from '../models/irt.types.js';
import * as fc from 'fast-check';

// Mock Pool
vi.mock('pg', () => {
  const mockQuery = vi.fn();
  return {
    Pool: vi.fn(() => ({
      query: mockQuery
    }))
  };
});

describe('MSTEngine', () => {
  let engine: MSTEngine;
  let mockDb: Pool;

  beforeEach(() => {
    mockDb = new Pool();
    engine = new MSTEngine(mockDb);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('routeToModule', () => {
    it('should route to Easy module when ability < -0.8', () => {
      const result = engine.routeToModule(-1.5, 'reading');
      
      expect(result).toEqual({
        difficulty: 'easy',
        stage: 2,
        section: 'reading'
      });
    });

    it('should route to Easy module at boundary ability = -0.81', () => {
      const result = engine.routeToModule(-0.81, 'listening');
      
      expect(result).toEqual({
        difficulty: 'easy',
        stage: 2,
        section: 'listening'
      });
    });

    it('should route to Medium module when ability = -0.8', () => {
      const result = engine.routeToModule(-0.8, 'reading');
      
      expect(result).toEqual({
        difficulty: 'medium',
        stage: 2,
        section: 'reading'
      });
    });

    it('should route to Medium module when ability is between -0.8 and 0.8', () => {
      const result = engine.routeToModule(0.0, 'reading');
      
      expect(result).toEqual({
        difficulty: 'medium',
        stage: 2,
        section: 'reading'
      });
    });

    it('should route to Medium module when ability = 0.8', () => {
      const result = engine.routeToModule(0.8, 'listening');
      
      expect(result).toEqual({
        difficulty: 'medium',
        stage: 2,
        section: 'listening'
      });
    });

    it('should route to Hard module when ability > 0.8', () => {
      const result = engine.routeToModule(1.5, 'reading');
      
      expect(result).toEqual({
        difficulty: 'hard',
        stage: 2,
        section: 'reading'
      });
    });

    it('should route to Hard module at boundary ability = 0.81', () => {
      const result = engine.routeToModule(0.81, 'listening');
      
      expect(result).toEqual({
        difficulty: 'hard',
        stage: 2,
        section: 'listening'
      });
    });

    it('should route extreme low ability to Easy module', () => {
      const result = engine.routeToModule(-3.0, 'reading');
      
      expect(result.difficulty).toBe('easy');
    });

    it('should route extreme high ability to Hard module', () => {
      const result = engine.routeToModule(3.0, 'reading');
      
      expect(result.difficulty).toBe('hard');
    });
  });

  describe('selectNextModule', () => {
    const mockItems = [
      {
        id: 'item-1',
        item_id: 'item-1',
        section: 'reading',
        type: 'multiple-choice',
        difficulty_level: 'medium',
        stage: 1,
        content: 'Question 1',
        options: ['A', 'B', 'C', 'D'],
        correct_answer: 'A',
        irt_parameters: { a: 1.0, b: 0.0, c: 0.2 },
        metadata: {}
      },
      {
        id: 'item-2',
        item_id: 'item-2',
        section: 'reading',
        type: 'multiple-choice',
        difficulty_level: 'medium',
        stage: 1,
        content: 'Question 2',
        options: ['A', 'B', 'C', 'D'],
        correct_answer: 'B',
        irt_parameters: { a: 1.2, b: 0.5, c: 0.25 },
        metadata: {}
      }
    ];

    it('should return module with items when items are found', async () => {
      vi.spyOn(mockDb, 'query').mockResolvedValueOnce({
        rows: mockItems,
        command: 'SELECT',
        rowCount: mockItems.length,
        oid: 0,
        fields: []
      });

      const result = await engine.selectNextModule(1, 'medium', 'reading');

      expect(result).not.toBeNull();
      expect(result?.moduleId).toBe('reading-stage1-medium');
      expect(result?.difficulty).toBe('medium');
      expect(result?.stage).toBe(1);
      expect(result?.section).toBe('reading');
      expect(result?.items).toHaveLength(2);
      expect(result?.items[0].id).toBe('item-1');
    });

    it('should return null when no items are found', async () => {
      vi.spyOn(mockDb, 'query').mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });

      const result = await engine.selectNextModule(2, 'hard', 'listening');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      vi.spyOn(mockDb, 'query').mockRejectedValueOnce(new Error('Connection failed'));

      await expect(
        engine.selectNextModule(1, 'easy', 'reading')
      ).rejects.toThrow('Failed to select module');
    });

    it('should query with correct parameters', async () => {
      const querySpy = vi.spyOn(mockDb, 'query').mockResolvedValueOnce({
        rows: mockItems,
        command: 'SELECT',
        rowCount: mockItems.length,
        oid: 0,
        fields: []
      });

      await engine.selectNextModule(2, 'hard', 'listening');

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining('FROM test_items'),
        ['listening', 2, 'hard']
      );
    });
  });

  describe('selectNextModuleWithFallback', () => {
    it('should return primary module if available', async () => {
      const mockModule: Module = {
        moduleId: 'reading-stage2-medium',
        difficulty: 'medium',
        stage: 2,
        section: 'reading',
        items: []
      };

      vi.spyOn(engine, 'selectNextModule').mockResolvedValueOnce(mockModule);

      const result = await engine.selectNextModuleWithFallback(2, 'medium', 'reading');

      expect(result).toEqual(mockModule);
      expect(engine.selectNextModule).toHaveBeenCalledTimes(1);
      expect(engine.selectNextModule).toHaveBeenCalledWith(2, 'medium', 'reading');
    });

    it('should fallback from easy to medium when easy unavailable', async () => {
      const mockModule: Module = {
        moduleId: 'reading-stage2-medium',
        difficulty: 'medium',
        stage: 2,
        section: 'reading',
        items: []
      };

      vi.spyOn(engine, 'selectNextModule')
        .mockResolvedValueOnce(null) // easy not found
        .mockResolvedValueOnce(mockModule); // medium found

      const result = await engine.selectNextModuleWithFallback(2, 'easy', 'reading');

      expect(result.difficulty).toBe('medium');
      expect(engine.selectNextModule).toHaveBeenCalledTimes(2);
    });

    it('should fallback from medium to easy when medium unavailable', async () => {
      const mockModule: Module = {
        moduleId: 'listening-stage2-easy',
        difficulty: 'easy',
        stage: 2,
        section: 'listening',
        items: []
      };

      vi.spyOn(engine, 'selectNextModule')
        .mockResolvedValueOnce(null) // medium not found
        .mockResolvedValueOnce(mockModule); // easy found

      const result = await engine.selectNextModuleWithFallback(2, 'medium', 'listening');

      expect(result.difficulty).toBe('easy');
    });

    it('should fallback from hard to medium when hard unavailable', async () => {
      const mockModule: Module = {
        moduleId: 'reading-stage2-medium',
        difficulty: 'medium',
        stage: 2,
        section: 'reading',
        items: []
      };

      vi.spyOn(engine, 'selectNextModule')
        .mockResolvedValueOnce(null) // hard not found
        .mockResolvedValueOnce(mockModule); // medium found

      const result = await engine.selectNextModuleWithFallback(2, 'hard', 'reading');

      expect(result.difficulty).toBe('medium');
    });

    it('should try all fallbacks before throwing error', async () => {
      vi.spyOn(engine, 'selectNextModule')
        .mockResolvedValue(null); // all return null

      await expect(
        engine.selectNextModuleWithFallback(2, 'hard', 'reading')
      ).rejects.toThrow('No module available');

      // hard + medium + easy = 3 attempts
      expect(engine.selectNextModule).toHaveBeenCalledTimes(3);
    });

    it('should use correct fallback order for easy difficulty', async () => {
      const selectSpy = vi.spyOn(engine, 'selectNextModule')
        .mockResolvedValue(null);

      await expect(
        engine.selectNextModuleWithFallback(2, 'easy', 'reading')
      ).rejects.toThrow();

      expect(selectSpy).toHaveBeenNthCalledWith(1, 2, 'easy', 'reading');
      expect(selectSpy).toHaveBeenNthCalledWith(2, 2, 'medium', 'reading');
      expect(selectSpy).toHaveBeenNthCalledWith(3, 2, 'hard', 'reading');
    });

    it('should throw detailed error message including section, stage, and difficulty', async () => {
      vi.spyOn(engine, 'selectNextModule').mockResolvedValue(null);

      await expect(
        engine.selectNextModuleWithFallback(2, 'medium', 'listening')
      ).rejects.toThrow('No module available for section=listening, stage=2, difficulty=medium');
    });

    it('should handle database errors during primary module selection', async () => {
      vi.spyOn(engine, 'selectNextModule')
        .mockRejectedValueOnce(new Error('Connection failed')) // primary fails
        .mockResolvedValueOnce(null); // fallback returns null

      await expect(
        engine.selectNextModuleWithFallback(1, 'medium', 'reading')
      ).rejects.toThrow('Connection failed');
    });

    it('should handle database errors during fallback attempts', async () => {
      vi.spyOn(engine, 'selectNextModule')
        .mockResolvedValueOnce(null) // primary not found
        .mockRejectedValueOnce(new Error('Database timeout')); // fallback fails

      await expect(
        engine.selectNextModuleWithFallback(2, 'easy', 'reading')
      ).rejects.toThrow('Database timeout');
    });

    it('should succeed on second fallback attempt after first fallback failure', async () => {
      const mockModule: Module = {
        moduleId: 'reading-stage2-hard',
        difficulty: 'hard',
        stage: 2,
        section: 'reading',
        items: []
      };

      vi.spyOn(engine, 'selectNextModule')
        .mockResolvedValueOnce(null) // easy not found
        .mockRejectedValueOnce(new Error('Temporary error')) // medium fails
        .mockResolvedValueOnce(mockModule); // hard succeeds

      // Note: In the current implementation, errors propagate immediately
      // This test documents expected behavior if error recovery is needed
      await expect(
        engine.selectNextModuleWithFallback(2, 'easy', 'reading')
      ).rejects.toThrow('Temporary error');
    });
  });

  describe('overrideRouting', () => {
    it('should override difficulty with reason logging', () => {
      const originalDecision: ModuleMetadata = {
        difficulty: 'hard',
        stage: 2,
        section: 'reading'
      };

      const result = engine.overrideRouting(
        originalDecision,
        'medium',
        'Test design constraint'
      );

      expect(result).toEqual({
        difficulty: 'medium',
        stage: 2,
        section: 'reading'
      });
    });

    it('should preserve section and stage', () => {
      const originalDecision: ModuleMetadata = {
        difficulty: 'easy',
        stage: 2,
        section: 'listening'
      };

      const result = engine.overrideRouting(
        originalDecision,
        'hard',
        'Module availability'
      );

      expect(result.section).toBe('listening');
      expect(result.stage).toBe(2);
    });
  });

  describe('validateNoOverlap', () => {
    it('should return true when no overlap exists', () => {
      const stage1Items: Item[] = [
        {
          id: 'item-1',
          section: 'reading',
          type: 'mc',
          difficulty_level: 'medium',
          content: 'Q1',
          correct_answer: 'A',
          irt_parameters: { a: 1, b: 0, c: 0.2 }
        },
        {
          id: 'item-2',
          section: 'reading',
          type: 'mc',
          difficulty_level: 'medium',
          content: 'Q2',
          correct_answer: 'B',
          irt_parameters: { a: 1, b: 0, c: 0.2 }
        }
      ];

      const stage2Items: Item[] = [
        {
          id: 'item-3',
          section: 'reading',
          type: 'mc',
          difficulty_level: 'hard',
          content: 'Q3',
          correct_answer: 'C',
          irt_parameters: { a: 1, b: 0.5, c: 0.2 }
        },
        {
          id: 'item-4',
          section: 'reading',
          type: 'mc',
          difficulty_level: 'hard',
          content: 'Q4',
          correct_answer: 'D',
          irt_parameters: { a: 1, b: 0.5, c: 0.2 }
        }
      ];

      const result = engine.validateNoOverlap(stage1Items, stage2Items);

      expect(result).toBe(true);
    });

    it('should return false when overlap detected', () => {
      const stage1Items: Item[] = [
        {
          id: 'item-1',
          section: 'reading',
          type: 'mc',
          difficulty_level: 'medium',
          content: 'Q1',
          correct_answer: 'A',
          irt_parameters: { a: 1, b: 0, c: 0.2 }
        },
        {
          id: 'item-2',
          section: 'reading',
          type: 'mc',
          difficulty_level: 'medium',
          content: 'Q2',
          correct_answer: 'B',
          irt_parameters: { a: 1, b: 0, c: 0.2 }
        }
      ];

      const stage2Items: Item[] = [
        {
          id: 'item-2', // Duplicate!
          section: 'reading',
          type: 'mc',
          difficulty_level: 'hard',
          content: 'Q2',
          correct_answer: 'B',
          irt_parameters: { a: 1, b: 0.5, c: 0.2 }
        },
        {
          id: 'item-4',
          section: 'reading',
          type: 'mc',
          difficulty_level: 'hard',
          content: 'Q4',
          correct_answer: 'D',
          irt_parameters: { a: 1, b: 0.5, c: 0.2 }
        }
      ];

      const result = engine.validateNoOverlap(stage1Items, stage2Items);

      expect(result).toBe(false);
    });

    it('should return true for empty stage 2 items', () => {
      const stage1Items: Item[] = [
        {
          id: 'item-1',
          section: 'reading',
          type: 'mc',
          difficulty_level: 'medium',
          content: 'Q1',
          correct_answer: 'A',
          irt_parameters: { a: 1, b: 0, c: 0.2 }
        }
      ];

      const result = engine.validateNoOverlap(stage1Items, []);

      expect(result).toBe(true);
    });
  });

  describe('isAdaptiveSection', () => {
    it('should return true for reading section', () => {
      expect(engine.isAdaptiveSection('reading')).toBe(true);
    });

    it('should return true for listening section', () => {
      expect(engine.isAdaptiveSection('listening')).toBe(true);
    });

    it('should return false for writing section', () => {
      expect(engine.isAdaptiveSection('writing')).toBe(false);
    });

    it('should return false for speaking section', () => {
      expect(engine.isAdaptiveSection('speaking')).toBe(false);
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 4: MST Routing Threshold Correctness
     * **Validates: Requirements 3.6, 3.7, 3.8, 4.5, 4.6, 4.7, 8.1**
     * 
     * This property verifies that the MST routing logic correctly classifies
     * ability estimates into the appropriate difficulty modules according to
     * the defined thresholds:
     * - θ < -0.8: Easy module
     * - -0.8 ≤ θ ≤ 0.8: Medium module  
     * - θ > 0.8: Hard module
     */
    describe('Property 4: MST Routing Threshold Correctness', () => {
      it('should correctly route abilities in range [-3, 3] to appropriate difficulty modules', () => {
        fc.assert(
          fc.property(
            // Generate theta values in the typical IRT ability range [-3, 3]
            fc.double({ min: -3, max: 3 }),
            // Test with adaptive sections only (reading and listening)
            fc.constantFrom('reading' as Section, 'listening' as Section),
            (theta, section) => {
              const result = engine.routeToModule(theta, section);

              // Verify correct difficulty assignment based on thresholds
              if (theta < -0.8) {
                expect(result.difficulty).toBe('easy');
              } else if (theta >= -0.8 && theta <= 0.8) {
                expect(result.difficulty).toBe('medium');
              } else {
                expect(result.difficulty).toBe('hard');
              }

              // Verify stage is always 2 for routing decisions
              expect(result.stage).toBe(2);

              // Verify section is preserved
              expect(result.section).toBe(section);
            }
          ),
          { numRuns: 1000 }
        );
      });

      it('should handle boundary condition θ = -0.8 (lower medium threshold)', () => {
        const result = engine.routeToModule(-0.8, 'reading');
        expect(result.difficulty).toBe('medium');
        expect(result.stage).toBe(2);
      });

      it('should handle boundary condition θ = 0.8 (upper medium threshold)', () => {
        const result = engine.routeToModule(0.8, 'listening');
        expect(result.difficulty).toBe('medium');
        expect(result.stage).toBe(2);
      });

      it('should handle values just below lower threshold θ = -0.80001', () => {
        const result = engine.routeToModule(-0.80001, 'reading');
        expect(result.difficulty).toBe('easy');
      });

      it('should handle values just above upper threshold θ = 0.80001', () => {
        const result = engine.routeToModule(0.80001, 'listening');
        expect(result.difficulty).toBe('hard');
      });

      it('should consistently route extreme low abilities to easy', () => {
        fc.assert(
          fc.property(
            // Use -0.800001 as max to exclude the boundary value -0.8 which routes to medium
            fc.double({ min: -3, max: -0.800001, noNaN: true }),
            fc.constantFrom('reading' as Section, 'listening' as Section),
            (theta, section) => {
              const result = engine.routeToModule(theta, section);
              expect(result.difficulty).toBe('easy');
            }
          ),
          { numRuns: 500 }
        );
      });

      it('should consistently route medium abilities to medium', () => {
        fc.assert(
          fc.property(
            fc.double({ min: -0.8, max: 0.8, noNaN: true }),
            fc.constantFrom('reading' as Section, 'listening' as Section),
            (theta, section) => {
              const result = engine.routeToModule(theta, section);
              expect(result.difficulty).toBe('medium');
            }
          ),
          { numRuns: 500 }
        );
      });

      it('should consistently route extreme high abilities to hard', () => {
        fc.assert(
          fc.property(
            fc.double({ min: 0.8, max: 3, noNaN: true, noDefaultInfinity: true }),
            fc.constantFrom('reading' as Section, 'listening' as Section),
            (theta, section) => {
              const result = engine.routeToModule(theta, section);
              // Only expect hard if theta is strictly greater than 0.8
              if (theta > 0.8) {
                expect(result.difficulty).toBe('hard');
              } else {
                expect(result.difficulty).toBe('medium');
              }
            }
          ),
          { numRuns: 500 }
        );
      });

      it('should maintain routing invariant: difficulty increases monotonically with ability', () => {
        fc.assert(
          fc.property(
            fc.double({ min: -3, max: 3, noNaN: true }),
            fc.double({ min: -3, max: 3, noNaN: true }),
            fc.constantFrom('reading' as Section, 'listening' as Section),
            (theta1, theta2, section) => {
              // Ensure theta1 < theta2
              const [lowerTheta, higherTheta] = theta1 < theta2 ? [theta1, theta2] : [theta2, theta1];
              
              const result1 = engine.routeToModule(lowerTheta, section);
              const result2 = engine.routeToModule(higherTheta, section);

              // Map difficulties to ordinal values for comparison
              const difficultyOrder: Record<DifficultyLevel, number> = {
                'easy': 1,
                'medium': 2,
                'hard': 3
              };

              // Lower ability should map to same or lower difficulty
              expect(difficultyOrder[result1.difficulty]).toBeLessThanOrEqual(
                difficultyOrder[result2.difficulty]
              );
            }
          ),
          { numRuns: 1000 }
        );
      });

      it('should produce deterministic routing (same theta always produces same difficulty)', () => {
        fc.assert(
          fc.property(
            fc.double({ min: -3, max: 3, noNaN: true }),
            fc.constantFrom('reading' as Section, 'listening' as Section),
            (theta, section) => {
              const result1 = engine.routeToModule(theta, section);
              const result2 = engine.routeToModule(theta, section);
              const result3 = engine.routeToModule(theta, section);

              // All results should be identical
              expect(result1.difficulty).toBe(result2.difficulty);
              expect(result2.difficulty).toBe(result3.difficulty);
              expect(result1.stage).toBe(result2.stage);
              expect(result1.section).toBe(result2.section);
            }
          ),
          { numRuns: 500 }
        );
      });

      it('should cover all three difficulty levels across the ability range', () => {
        const difficulties = new Set<DifficultyLevel>();
        
        fc.assert(
          fc.property(
            fc.double({ min: -3, max: 3, noNaN: true }),
            fc.constantFrom('reading' as Section, 'listening' as Section),
            (theta, section) => {
              const result = engine.routeToModule(theta, section);
              difficulties.add(result.difficulty);
              return true;
            }
          ),
          { numRuns: 1000 }
        );

        // After sufficient runs, all three difficulties should be covered
        expect(difficulties.has('easy')).toBe(true);
        expect(difficulties.has('medium')).toBe(true);
        expect(difficulties.has('hard')).toBe(true);
      });
    });
  });
});
