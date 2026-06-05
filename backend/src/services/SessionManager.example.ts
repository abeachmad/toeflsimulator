/**
 * SessionManager Usage Examples
 * 
 * This file demonstrates how to use the SessionManager service
 * for managing exam session state with PostgreSQL persistence.
 */

import { Pool } from 'pg';
import { SessionManager, CreateSessionRequest, UpdateSessionRequest } from './SessionManager.js';

// Initialize database pool (typically from database config)
// Credentials must come from environment variables — never hardcoded.
// For local development, set these in backend/.env
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'toefl_simulator',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,   // set DB_PASSWORD in .env
});

// Create SessionManager instance
const sessionManager = new SessionManager(pool);

/**
 * Example 1: Create a new exam session
 */
async function createNewSession() {
  const request: CreateSessionRequest = {
    userId: 'user-12345',
    moduleName: 'reading'
  };

  const session = await sessionManager.createSession(request);

  console.log('New session created:', {
    sessionId: session.sessionId,
    userId: session.userId,
    status: session.status,
    startedAt: session.startedAt
  });

  return session.sessionId;
}

/**
 * Example 2: Update session state (persist answers)
 */
async function updateSessionState(sessionId: string) {
  const updateRequest: UpdateSessionRequest = {
    currentQuestion: 5,
    answers: {
      q1: { answer: 'A', timestamp: new Date() },
      q2: { answer: 'B', timestamp: new Date() },
      q3: { answer: 'C', timestamp: new Date() },
      q4: { answer: 'D', timestamp: new Date() },
      q5: { answer: 'A', timestamp: new Date() }
    },
    status: 'in_progress',
    currentModule: 1
  };

  const updatedSession = await sessionManager.persistSession(sessionId, updateRequest);

  console.log('Session updated:', {
    currentQuestion: updatedSession.currentQuestion,
    answersCount: Object.keys(updatedSession.answers).length,
    status: updatedSession.status
  });

  return updatedSession;
}

/**
 * Example 3: Restore session after browser refresh
 */
async function restoreSessionAfterRefresh(sessionId: string) {
  try {
    const session = await sessionManager.restoreSession(sessionId);

    console.log('Session restored:', {
      sessionId: session.sessionId,
      currentSection: session.currentSection,
      currentModule: session.currentModule,
      currentQuestion: session.currentQuestion,
      answersCount: Object.keys(session.answers).length,
      completedModules: session.completedModules
    });

    // Verify all state is preserved
    if (session.currentQuestion > 0) {
      console.log('✓ Progress preserved: on question', session.currentQuestion);
    }

    return session;
  } catch (error) {
    console.error('Failed to restore session:', error);
    // Could redirect to home page or create new session
    throw error;
  }
}

/**
 * Example 4: Mark a module as completed
 */
async function completeModule(sessionId: string, moduleId: string) {
  await sessionManager.markModuleCompleted(sessionId, moduleId);

  console.log(`Module ${moduleId} marked as completed`);

  // Retrieve updated session to verify
  const session = await sessionManager.getSession(sessionId);
  console.log('Completed modules:', session.completedModules);
}

/**
 * Example 5: Update ability estimate after module completion
 */
async function updateAbilityAfterModule(sessionId: string) {
  // Simulate IRT ability calculation
  const readingAbility = 0.75; // θ parameter from IRT scorer

  await sessionManager.updateAbilityEstimate(sessionId, 'reading', readingAbility);

  console.log('Ability estimate updated for reading section:', readingAbility);

  // Retrieve session to verify
  const session = await sessionManager.getSession(sessionId);
  console.log('All ability estimates:', session.abilityEstimates);
}

/**
 * Example 6: Complete exam session workflow
 */
async function completeExamWorkflow() {
  console.log('\n=== Complete Exam Session Workflow ===\n');

  // Step 1: Create new session
  console.log('Step 1: Creating new session...');
  const sessionId = await createNewSession();

  // Step 2: Simulate answering questions
  console.log('\nStep 2: Answering questions in module 1...');
  await updateSessionState(sessionId);

  // Step 3: Mark Stage 1 module as completed
  console.log('\nStep 3: Completing Stage 1 module...');
  await completeModule(sessionId, 'reading-stage1-medium');

  // Step 4: Update ability estimate
  console.log('\nStep 4: Calculating ability estimate...');
  await updateAbilityAfterModule(sessionId);

  // Step 5: Simulate browser refresh - restore session
  console.log('\nStep 5: Simulating browser refresh...');
  await restoreSessionAfterRefresh(sessionId);

  // Step 6: Continue to Stage 2 module
  console.log('\nStep 6: Continuing to Stage 2...');
  await sessionManager.persistSession(sessionId, {
    currentModule: 2,
    currentQuestion: 0,
    status: 'in_progress'
  });

  // Step 7: Complete Stage 2 and finish exam
  console.log('\nStep 7: Completing Stage 2 module...');
  await completeModule(sessionId, 'reading-stage2-hard');
  await sessionManager.persistSession(sessionId, {
    status: 'completed',
    completedAt: new Date()
  });

  console.log('\n✓ Exam session completed successfully!');

  // Clean up
  await sessionManager.deleteSession(sessionId);
  console.log('✓ Session cleaned up');
}

/**
 * Example 7: Error handling for invalid session
 */
async function handleInvalidSession() {
  try {
    await sessionManager.restoreSession('nonexistent-session-id');
  } catch (error) {
    console.error('Expected error:', error instanceof Error ? error.message : error);
    // Handle gracefully - redirect to start page
  }
}

/**
 * Example 8: Handling corrupted state
 */
async function handleCorruptedState() {
  try {
    // The validateSessionState method will catch invalid data
    const sessionId = await createNewSession();

    // Try to restore - validation will occur
    const session = await sessionManager.restoreSession(sessionId);

    console.log('Session validation passed:', session.sessionId);

    await sessionManager.deleteSession(sessionId);
  } catch (error) {
    console.error('Validation error:', error instanceof Error ? error.message : error);
  }
}

// Run examples if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  completeExamWorkflow()
    .then(() => {
      console.log('\n=== Testing Error Handling ===\n');
      return handleInvalidSession();
    })
    .then(() => {
      return handleCorruptedState();
    })
    .then(() => {
      console.log('\n✓ All examples completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Example execution failed:', error);
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}

export {
  createNewSession,
  updateSessionState,
  restoreSessionAfterRefresh,
  completeModule,
  updateAbilityAfterModule,
  completeExamWorkflow
};
