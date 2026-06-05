import { Pool } from 'pg';
import {
  Item,
  Section,
  DifficultyLevel
} from '../models/irt.types.js';

/**
 * Module metadata returned by routing decisions
 */
export interface ModuleMetadata {
  difficulty: DifficultyLevel;
  stage: number;
  section: Section;
}

/**
 * Module contains actual test items for a specific difficulty tier
 */
export interface Module {
  moduleId: string;
  difficulty: DifficultyLevel;
  stage: number;
  section: Section;
  items: Item[];
}

/**
 * MST (Multistage Adaptive Testing) Engine
 * Implements module-level adaptive routing based on IRT ability estimates
 * 
 * Requirements: 3.4, 3.6, 3.7, 3.8, 4.4, 4.5, 4.6, 4.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */
export class MSTEngine {
  // Routing thresholds for adaptive module selection
  private static readonly EASY_UPPER_BOUND = -0.8;
  private static readonly MEDIUM_LOWER_BOUND = -0.8;
  private static readonly MEDIUM_UPPER_BOUND = 0.8;
  private static readonly HARD_LOWER_BOUND = 0.8;

  constructor(private db: Pool) {}

  /**
   * Route to appropriate module based on ability estimate
   * Uses threshold-based routing for Stage 2 module selection
   * 
   * Routing Logic:
   * - θ < -0.8: Easy module
   * - -0.8 ≤ θ ≤ 0.8: Medium module
   * - θ > 0.8: Hard module
   * 
   * @param ability - Estimated ability (θ) from Stage 1 responses
   * @param section - Test section (reading or listening)
   * @returns Module metadata with difficulty tier
   * 
   * Validates: Requirements 3.6, 3.7, 3.8, 4.5, 4.6, 4.7, 8.1
   */
  routeToModule(ability: number, section: Section): ModuleMetadata {
    let difficulty: DifficultyLevel;

    // Apply routing thresholds
    if (ability < MSTEngine.EASY_UPPER_BOUND) {
      difficulty = 'easy';
      console.log(`[MSTEngine] Routing decision: ability=${ability.toFixed(3)} → Easy module (θ < ${MSTEngine.EASY_UPPER_BOUND})`);
    } else if (ability >= MSTEngine.MEDIUM_LOWER_BOUND && ability <= MSTEngine.MEDIUM_UPPER_BOUND) {
      difficulty = 'medium';
      console.log(`[MSTEngine] Routing decision: ability=${ability.toFixed(3)} → Medium module (${MSTEngine.MEDIUM_LOWER_BOUND} ≤ θ ≤ ${MSTEngine.MEDIUM_UPPER_BOUND})`);
    } else {
      difficulty = 'hard';
      console.log(`[MSTEngine] Routing decision: ability=${ability.toFixed(3)} → Hard module (θ > ${MSTEngine.HARD_LOWER_BOUND})`);
    }

    return {
      difficulty,
      stage: 2,
      section
    };
  }

  /**
   * Select next module with items from database
   * Queries test_items table for items matching stage and difficulty
   * 
   * @param stage - Test stage (1 or 2)
   * @param difficulty - Difficulty level (easy, medium, hard)
   * @param section - Test section (reading, listening, writing, speaking)
   * @returns Module with items, or null if unavailable
   * 
   * Validates: Requirements 8.2, 8.3, 8.4
   */
  async selectNextModule(
    stage: number,
    difficulty: DifficultyLevel,
    section: Section
  ): Promise<Module | null> {
    try {
      console.log(`[MSTEngine] Selecting module: section=${section}, stage=${stage}, difficulty=${difficulty}`);

      const query = `
        SELECT 
          id,
          item_id,
          section,
          type,
          difficulty_level,
          stage,
          content,
          options,
          correct_answer,
          irt_parameters,
          metadata
        FROM test_items
        WHERE section = $1
          AND stage = $2
          AND difficulty_level = $3
        ORDER BY id
      `;

      const result = await this.db.query(query, [section, stage, difficulty]);

      if (result.rows.length === 0) {
        console.warn(`[MSTEngine] No items found for section=${section}, stage=${stage}, difficulty=${difficulty}`);
        return null;
      }

      // Map database rows to Item objects
      const items: Item[] = result.rows.map(row => ({
        id: row.item_id,
        section: row.section as Section,
        type: row.type,
        difficulty_level: row.difficulty_level as DifficultyLevel | undefined,
        content: row.content,
        options: row.options,
        correct_answer: row.correct_answer,
        irt_parameters: row.irt_parameters,
        metadata: row.metadata
      }));

      const module: Module = {
        moduleId: `${section}-stage${stage}-${difficulty}`,
        difficulty,
        stage,
        section,
        items
      };

      console.log(`[MSTEngine] Module selected: ${module.moduleId} with ${items.length} items`);

      return module;
    } catch (error) {
      console.error(`[MSTEngine] Database error selecting module:`, error);
      throw new Error(`Failed to select module: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Select next module with fallback logic
   * Attempts to load module from database, falls back to alternative difficulty if unavailable
   * 
   * Fallback Order:
   * - Easy → Medium → Hard
   * - Medium → Easy → Hard
   * - Hard → Medium → Easy
   * 
   * @param stage - Test stage (1 or 2)
   * @param difficulty - Preferred difficulty level
   * @param section - Test section
   * @returns Module with items, or throws error if all fallbacks fail
   * 
   * Validates: Requirements 8.5, 8.6, 8.7
   */
  async selectNextModuleWithFallback(
    stage: number,
    difficulty: DifficultyLevel,
    section: Section
  ): Promise<Module> {
    console.log(`[MSTEngine] Attempting to load module with fallback: section=${section}, stage=${stage}, difficulty=${difficulty}`);

    // Try primary difficulty
    let module = await this.selectNextModule(stage, difficulty, section);
    if (module !== null) {
      return module;
    }

    // Define fallback order based on primary difficulty
    let fallbackOrder: DifficultyLevel[];
    if (difficulty === 'easy') {
      fallbackOrder = ['medium', 'hard'];
    } else if (difficulty === 'medium') {
      fallbackOrder = ['easy', 'hard'];
    } else {
      fallbackOrder = ['medium', 'easy'];
    }

    // Try fallbacks
    for (const fallbackDifficulty of fallbackOrder) {
      console.log(`[MSTEngine] Fallback attempt: trying ${fallbackDifficulty} difficulty`);
      module = await this.selectNextModule(stage, fallbackDifficulty, section);
      
      if (module !== null) {
        console.log(`[MSTEngine] Fallback successful: using ${fallbackDifficulty} difficulty instead of ${difficulty}`);
        return module;
      }
    }

    // All attempts failed
    const errorMessage = `No module available for section=${section}, stage=${stage}, difficulty=${difficulty} (including fallbacks)`;
    console.error(`[MSTEngine] ${errorMessage}`);
    throw new Error(errorMessage);
  }

  /**
   * Override routing decision based on module availability or test design constraints
   * Allows manual override of automatic routing for special cases
   * 
   * @param originalDecision - Original routing decision from routeToModule
   * @param overrideDifficulty - Manual difficulty override
   * @param reason - Reason for override (for logging)
   * @returns Updated module metadata with overridden difficulty
   * 
   * Validates: Requirements 8.3
   */
  overrideRouting(
    originalDecision: ModuleMetadata,
    overrideDifficulty: DifficultyLevel,
    reason: string
  ): ModuleMetadata {
    console.log(
      `[MSTEngine] Routing override: ${originalDecision.difficulty} → ${overrideDifficulty}. Reason: ${reason}`
    );

    return {
      ...originalDecision,
      difficulty: overrideDifficulty
    };
  }

  /**
   * Validate that Stage 2 module has non-overlapping content with Stage 1
   * Checks that item IDs in Stage 2 are not present in Stage 1
   * 
   * @param stage1Items - Items from Stage 1 module
   * @param stage2Items - Items from Stage 2 module
   * @returns True if no overlap, false if overlap detected
   * 
   * Validates: Requirements 8.4
   */
  validateNoOverlap(stage1Items: Item[], stage2Items: Item[]): boolean {
    const stage1ItemIds = new Set(stage1Items.map(item => item.id));
    const stage2ItemIds = stage2Items.map(item => item.id);

    const overlap = stage2ItemIds.filter(id => stage1ItemIds.has(id));

    if (overlap.length > 0) {
      console.warn(`[MSTEngine] Content overlap detected: ${overlap.length} duplicate items`, overlap);
      return false;
    }

    console.log(`[MSTEngine] No content overlap detected between Stage 1 and Stage 2`);
    return true;
  }

  /**
   * Check if adaptive routing applies to a section
   * MST routing only applies to Reading and Listening sections
   * 
   * @param section - Test section
   * @returns True if adaptive routing applies, false otherwise
   * 
   * Validates: Requirements 8.7
   */
  isAdaptiveSection(section: Section): boolean {
    const isAdaptive = section === 'reading' || section === 'listening';
    console.log(`[MSTEngine] Section ${section} adaptive routing: ${isAdaptive}`);
    return isAdaptive;
  }
}
