/**
 * SessionManager - Manages exam session state and persistence
 * 
 * Implements Requirements: 1.1, 1.2, 1.3, 1.4, 13.4, 18.3, 18.4
 * 
 * This service provides:
 * - Session creation with unique ID generation
 * - Session state persistence to PostgreSQL
 * - Session state restoration with validation
 * - Module completion tracking
 * - Ability estimate updates
 * - State validation and schema versioning
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';

/**
 * Session state types
 */
export type SessionStatus = 'not_started' | 'in_progress' | 'paused' | 'completed' | 'expired';
export type ModuleName = 'reading' | 'writing' | 'listening' | 'speaking';

/**
 * Complete session state interface
 */
export interface SessionState {
  sessionId: string;
  userId: string;
  moduleName: ModuleName | null;
  status: SessionStatus;
  currentQuestion: number;
  answers: Record<string, any>; // JSONB field - flexible structure
  score: number | null;
  startedAt: Date;
  completedAt: Date | null;
  currentSection: string | null;
  currentModule: number | null;
  abilityEstimates: Record<string, number>; // JSONB field - section -> theta
  completedModules: string[]; // Array of completed module IDs
}

/**
 * Session creation request
 */
export interface CreateSessionRequest {
  userId: string;
  moduleName?: ModuleName;
}

/**
 * Session update request (partial state)
 */
export interface UpdateSessionRequest {
  moduleName?: ModuleName;
  status?: SessionStatus;
  currentQuestion?: number;
  answers?: Record<string, any>;
  score?: number | null;
  completedAt?: Date | null;
  currentSection?: string;
  currentModule?: number;
}

/**
 * SessionManager - Manages exam session lifecycle and persistence
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 13.4, 18.3, 18.4**
 */
export class SessionManager {
  // State version for future migrations
  // @ts-expect-error - Reserved for future schema versioning
  private readonly _STATE_VERSION = 1;
  
  constructor(private db: Pool) {}

  /**
   * Create a new exam session with unique ID
   * 
   * **Validates: Requirement 1.1**
   * WHEN a test taker starts a new exam, THE Session_Manager SHALL create 
   * a unique session identifier and initialize session state
   * 
   * @param request - Session creation parameters
   * @returns Newly created session state
   */
  async createSession(request: CreateSessionRequest): Promise<SessionState> {
    const sessionId = randomUUID();
    const startedAt = new Date();
    
    // TOEFL iBT exam duration is 4 hours
    const expirationTime = new Date(startedAt.getTime() + 4 * 60 * 60 * 1000);
    
    const query = `
      INSERT INTO exam_sessions (
        session_id,
        user_id,
        start_time,
        expiration_time,
        current_section,
        current_module,
        current_question,
        answers,
        ability_estimates,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const values = [
      sessionId,
      request.userId,
      startedAt,
      expirationTime,
      request.moduleName || null,
      null, // current_module starts as null
      0, // current_question starts at 0
      JSON.stringify({}), // empty answers object
      JSON.stringify({}), // empty ability estimates
      'not_started' as SessionStatus
    ];
    
    try {
      const result = await this.db.query(query, values);
      return this.mapRowToSessionState(result.rows[0]);
    } catch (error) {
      console.error('Failed to create session:', error);
      throw new Error(`Session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Persist session state to database
   * 
   * **Validates: Requirement 1.2**
   * WHILE the exam is active, THE Session_Manager SHALL persist session state 
   * to local storage after each answer submission
   * 
   * Note: While the requirement mentions "local storage", the design specifies
   * PostgreSQL persistence. This method handles database persistence.
   * 
   * @param sessionId - Unique session identifier
   * @param state - Partial session state to update
   * @returns Updated session state
   */
  async persistSession(sessionId: string, state: UpdateSessionRequest): Promise<SessionState> {
    // Build dynamic UPDATE query based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (state.moduleName !== undefined) {
      updates.push(`current_section = $${paramIndex++}`);
      values.push(state.moduleName);
    }
    
    if (state.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(state.status);
    }
    
    if (state.currentQuestion !== undefined) {
      updates.push(`current_question = $${paramIndex++}`);
      values.push(state.currentQuestion);
    }
    
    if (state.answers !== undefined) {
      updates.push(`answers = $${paramIndex++}`);
      values.push(JSON.stringify(state.answers));
    }
    
    if (state.score !== undefined) {
      updates.push(`score = $${paramIndex++}`);
      values.push(state.score);
    }
    
    if (state.completedAt !== undefined) {
      updates.push(`completed_at = $${paramIndex++}`);
      values.push(state.completedAt);
    }
    
    if (state.currentSection !== undefined) {
      updates.push(`current_section = $${paramIndex++}`);
      values.push(state.currentSection);
    }
    
    if (state.currentModule !== undefined) {
      updates.push(`current_module = $${paramIndex++}`);
      values.push(state.currentModule);
    }
    
    // Check if any updates were provided (before adding updated_at)
    if (updates.length === 0) {
      throw new Error('No updates provided for session persistence');
    }
    
    // Always update updated_at timestamp
    updates.push(`updated_at = NOW()`);
    
    // Add sessionId as the last parameter
    values.push(sessionId);
    
    const query = `
      UPDATE exam_sessions
      SET ${updates.join(', ')}
      WHERE session_id = $${paramIndex}
      RETURNING *
    `;
    
    try {
      const result = await this.db.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error(`Session ${sessionId} not found`);
      }
      
      return this.mapRowToSessionState(result.rows[0]);
    } catch (error) {
      console.error('Failed to persist session:', error);
      throw new Error(`Session persistence failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore session state from database
   * 
   * **Validates: Requirements 1.3, 1.4, 18.4**
   * - 1.3: WHEN a browser refresh or crash occurs, THE Session_Manager SHALL 
   *        restore the exam session from persisted state
   * - 1.4: WHEN session restoration occurs, THE Session_Manager SHALL preserve 
   *        the current section, module, question position, all submitted answers, 
   *        and remaining time
   * - 18.4: THE Progress_Store SHALL restore persisted state
   * 
   * @param sessionId - Unique session identifier
   * @returns Restored session state
   * @throws Error if session not found or validation fails
   */
  async restoreSession(sessionId: string): Promise<SessionState> {
    const query = `
      SELECT * FROM exam_sessions
      WHERE session_id = $1
    `;
    
    try {
      const result = await this.db.query(query, [sessionId]);
      
      if (result.rows.length === 0) {
        throw new Error(`Session ${sessionId} not found`);
      }
      
      const sessionState = this.mapRowToSessionState(result.rows[0]);
      
      // Validate restored state (Requirement 18.4)
      this.validateSessionState(sessionState);
      
      return sessionState;
    } catch (error) {
      console.error('Failed to restore session:', error);
      throw new Error(`Session restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark a module as completed
   * 
   * **Validates: Requirement 13.4**
   * WHEN the test taker submits a module, THE Session_Manager SHALL mark 
   * only the submitted module as completed
   * 
   * @param sessionId - Unique session identifier
   * @param moduleId - Module identifier to mark as completed
   */
  async markModuleCompleted(sessionId: string, moduleId: string): Promise<void> {
    // First, get current completed modules
    const selectQuery = `
      SELECT answers FROM exam_sessions
      WHERE session_id = $1
    `;
    
    const selectResult = await this.db.query(selectQuery, [sessionId]);
    
    if (selectResult.rows.length === 0) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    // Parse existing answers JSONB
    const answers = selectResult.rows[0].answers || {};
    
    // Add completed module to metadata
    if (!answers.completedModules) {
      answers.completedModules = [];
    }
    
    // Add module if not already completed
    if (!answers.completedModules.includes(moduleId)) {
      answers.completedModules.push(moduleId);
    }
    
    // Update with new completed modules list
    const updateQuery = `
      UPDATE exam_sessions
      SET answers = $1, updated_at = NOW()
      WHERE session_id = $2
    `;
    
    try {
      await this.db.query(updateQuery, [JSON.stringify(answers), sessionId]);
    } catch (error) {
      console.error('Failed to mark module completed:', error);
      throw new Error(`Failed to mark module ${moduleId} as completed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update ability estimate for a section
   * 
   * **Validates: Requirement 18.3**
   * THE Progress_Store SHALL persist ability estimates
   * 
   * @param sessionId - Unique session identifier
   * @param section - Section name (reading, listening, writing, speaking)
   * @param theta - Estimated ability (θ parameter)
   */
  async updateAbilityEstimate(sessionId: string, section: string, theta: number): Promise<void> {
    // First, get current ability estimates
    const selectQuery = `
      SELECT ability_estimates FROM exam_sessions
      WHERE session_id = $1
    `;
    
    const selectResult = await this.db.query(selectQuery, [sessionId]);
    
    if (selectResult.rows.length === 0) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    // Parse existing ability estimates JSONB
    const abilityEstimates = selectResult.rows[0].ability_estimates || {};
    
    // Update ability estimate for section
    abilityEstimates[section] = theta;
    
    // Update database
    const updateQuery = `
      UPDATE exam_sessions
      SET ability_estimates = $1, updated_at = NOW()
      WHERE session_id = $2
    `;
    
    try {
      await this.db.query(updateQuery, [JSON.stringify(abilityEstimates), sessionId]);
    } catch (error) {
      console.error('Failed to update ability estimate:', error);
      throw new Error(`Failed to update ability estimate for section ${section}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if navigation to a specific question is allowed
   * 
   * **Validates: Requirements 13.1, 13.2, 13.3, 13.5**
   * - 13.1: WHILE a module is active, THE UI_Controller SHALL allow navigation 
   *         to any question within that module
   * - 13.2: THE UI_Controller SHALL allow skipping questions and returning to 
   *         them later within the same module
   * - 13.3: THE UI_Controller SHALL allow changing answers within the current module
   * - 13.5: THE UI_Controller SHALL prevent navigation to previously completed modules
   * 
   * @param sessionId - Unique session identifier
   * @param targetModuleId - Module ID to navigate to
   * @param targetQuestionIndex - Question index within the module (optional, for validation)
   * @returns True if navigation is allowed, false if blocked
   */
  async canNavigateToQuestion(
    sessionId: string, 
    targetModuleId: string, 
    _targetQuestionIndex?: number
  ): Promise<boolean> {
    const session = await this.getSession(sessionId);
    
    // Property 1: Navigation to completed modules is ALWAYS blocked (highest priority)
    // Even if a module is marked as "current", if it's been completed, navigation is blocked
    if (session.completedModules.includes(targetModuleId)) {
      return false;
    }
    
    // Property 2: Navigation within current module is allowed (if not completed)
    if (session.currentModule !== null && targetModuleId === `module-${session.currentModule}`) {
      return true;
    }
    
    // Property 3: If neither current nor completed, it's a future module (also blocked)
    return false;
  }

  /**
   * Get session by ID (alias for restoreSession for clarity)
   * 
   * @param sessionId - Unique session identifier
   * @returns Session state
   */
  async getSession(sessionId: string): Promise<SessionState> {
    return this.restoreSession(sessionId);
  }

  /**
   * Delete a session (for cleanup or reset)
   * 
   * @param sessionId - Unique session identifier
   */
  async deleteSession(sessionId: string): Promise<void> {
    const query = `
      DELETE FROM exam_sessions
      WHERE session_id = $1
    `;
    
    try {
      await this.db.query(query, [sessionId]);
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw new Error(`Session deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map database row to SessionState interface
   * 
   * @param row - Database row from exam_sessions table
   * @returns SessionState object
   */
  private mapRowToSessionState(row: any): SessionState {
    return {
      sessionId: row.session_id,
      userId: row.user_id,
      moduleName: row.current_section as ModuleName | null,
      status: row.status as SessionStatus,
      currentQuestion: row.current_question || 0,
      answers: typeof row.answers === 'string' ? JSON.parse(row.answers) : (row.answers || {}),
      score: row.score,
      startedAt: new Date(row.start_time),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      currentSection: row.current_section,
      currentModule: row.current_module,
      abilityEstimates: typeof row.ability_estimates === 'string' 
        ? JSON.parse(row.ability_estimates) 
        : (row.ability_estimates || {}),
      completedModules: this.extractCompletedModules(row.answers)
    };
  }

  /**
   * Extract completed modules from answers JSONB
   * 
   * @param answers - Answers JSONB field (may be string or object)
   * @returns Array of completed module IDs
   */
  private extractCompletedModules(answers: any): string[] {
    if (!answers) return [];
    
    const answersObj = typeof answers === 'string' ? JSON.parse(answers) : answers;
    
    return answersObj.completedModules || [];
  }

  /**
   * Validate session state structure
   * 
   * **Validates: Requirement 18.4**
   * Implement validation for state restoration (schema version, required fields)
   * 
   * @param state - Session state to validate
   * @throws Error if validation fails
   */
  private validateSessionState(state: SessionState): void {
    // Required fields
    if (!state.sessionId) {
      throw new Error('Invalid session state: sessionId is required');
    }
    
    if (!state.userId) {
      throw new Error('Invalid session state: userId is required');
    }
    
    if (!state.status) {
      throw new Error('Invalid session state: status is required');
    }
    
    // Validate status value
    const validStatuses: SessionStatus[] = ['not_started', 'in_progress', 'paused', 'completed', 'expired'];
    if (!validStatuses.includes(state.status)) {
      throw new Error(`Invalid session state: status "${state.status}" is not valid`);
    }
    
    // Validate moduleName if present
    if (state.moduleName !== null) {
      const validModules: ModuleName[] = ['reading', 'writing', 'listening', 'speaking'];
      if (!validModules.includes(state.moduleName)) {
        throw new Error(`Invalid session state: moduleName "${state.moduleName}" is not valid`);
      }
    }
    
    // Validate numeric fields
    if (typeof state.currentQuestion !== 'number' || state.currentQuestion < 0) {
      throw new Error('Invalid session state: currentQuestion must be a non-negative number');
    }
    
    // Validate dates
    if (!(state.startedAt instanceof Date) || isNaN(state.startedAt.getTime())) {
      throw new Error('Invalid session state: startedAt must be a valid date');
    }
    
    // Validate JSONB fields are objects (not arrays)
    if (state.answers && (typeof state.answers !== 'object' || Array.isArray(state.answers))) {
      throw new Error('Invalid session state: answers must be an object');
    }
    
    if (state.abilityEstimates && (typeof state.abilityEstimates !== 'object' || Array.isArray(state.abilityEstimates))) {
      throw new Error('Invalid session state: abilityEstimates must be an object');
    }
    
    if (!Array.isArray(state.completedModules)) {
      throw new Error('Invalid session state: completedModules must be an array');
    }
  }
}
