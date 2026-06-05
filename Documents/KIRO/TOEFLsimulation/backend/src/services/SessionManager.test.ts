/**
 * SessionManager Unit Tests
 * 
 * Tests for SessionManager class with mocked database connections
 * 
 * Validates Requirements: 1.1, 1.2, 1.3, 1.4, 13.4, 18.3, 18.4
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Pool } from 'pg';
import { 
  SessionManager, 
  SessionState, 
  SessionStatus, 
  CreateSessionRequest,
  UpdateSessionRequest 
} from './SessionManager.js';

/**
 * Mock database pool for testing
 */
function createMockPool(): Pool {
  return {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  } as any as Pool;
}

describe('SessionManager', () => {
  let mockPool: Pool;
  let sessionManager: SessionManager;

  beforeEach(() => {
    mockPool = createMockPool();
    sessionManager = new SessionManager(mockPool);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session with unique ID and initialize state', async () => {
      // Validates Requirement 1.1
      const mockRow = {
        id: '123',
        session_id: 'test-session-id',
        user_id: 'user-123',
        start_time: new Date(),
        end_time: null,
        expiration_time: new Date(),
        current_section: 'reading',
        current_module: null,
        current_question: 0,
        answers: JSON.stringify({}),
        ability_estimates: JSON.stringify({}),
        status: 'not_started',
        created_at: new Date(),
        updated_at: new Date()
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRow],
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const request: CreateSessionRequest = {
        userId: 'user-123',
        moduleName: 'reading'
      };

      const session = await sessionManager.createSession(request);

      expect(session).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.status).toBe('not_started');
      expect(session.currentQuestion).toBe(0);
      expect(session.answers).toEqual({});
      expect(session.abilityEstimates).toEqual({});
      expect(session.sessionId).toBeDefined();
      expect(session.startedAt).toBeInstanceOf(Date);
    });

    it('should throw error if database insert fails', async () => {
      vi.mocked(mockPool.query).mockRejectedValue(new Error('Database error'));

      const request: CreateSessionRequest = {
        userId: 'user-123'
      };

      await expect(sessionManager.createSession(request)).rejects.toThrow('Session creation failed');
    });
  });

  describe('persistSession', () => {
    it('should update session state in database', async () => {
      // Validates Requirement 1.2
      const mockRow = {
        id: '123',
        session_id: 'test-session-id',
        user_id: 'user-123',
        start_time: new Date(),
        end_time: null,
        expiration_time: new Date(),
        current_section: 'reading',
        current_module: 1,
        current_question: 5,
        answers: JSON.stringify({ q1: 'A', q2: 'B' }),
        ability_estimates: JSON.stringify({}),
        status: 'in_progress',
        created_at: new Date(),
        updated_at: new Date()
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRow],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const updateRequest: UpdateSessionRequest = {
        currentQuestion: 5,
        answers: { q1: 'A', q2: 'B' },
        status: 'in_progress'
      };

      const session = await sessionManager.persistSession('test-session-id', updateRequest);

      expect(session).toBeDefined();
      expect(session.currentQuestion).toBe(5);
      expect(session.answers).toEqual({ q1: 'A', q2: 'B' });
      expect(session.status).toBe('in_progress');
    });

    it('should throw error if no updates provided', async () => {
      await expect(
        sessionManager.persistSession('test-session-id', {})
      ).rejects.toThrow('No updates provided for session persistence');
    });

    it('should throw error if session not found', async () => {
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [],
        command: 'UPDATE',
        rowCount: 0,
        oid: 0,
        fields: []
      });

      const updateRequest: UpdateSessionRequest = {
        currentQuestion: 5
      };

      await expect(
        sessionManager.persistSession('nonexistent-id', updateRequest)
      ).rejects.toThrow('Session nonexistent-id not found');
    });
  });

  describe('restoreSession', () => {
    it('should restore session state from database', async () => {
      // Validates Requirements 1.3, 1.4
      const mockRow = {
        id: '123',
        session_id: 'test-session-id',
        user_id: 'user-123',
        start_time: new Date('2024-01-01T10:00:00Z'),
        end_time: null,
        expiration_time: new Date('2024-01-01T11:30:00Z'),
        current_section: 'reading',
        current_module: 2,
        current_question: 10,
        answers: JSON.stringify({ 
          q1: 'A', 
          q2: 'B',
          completedModules: ['module-1']
        }),
        ability_estimates: JSON.stringify({ reading: 0.5 }),
        status: 'in_progress',
        created_at: new Date(),
        updated_at: new Date()
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRow],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const session = await sessionManager.restoreSession('test-session-id');

      // Verify all state is preserved (Requirement 1.4)
      expect(session.sessionId).toBe('test-session-id');
      expect(session.userId).toBe('user-123');
      expect(session.currentSection).toBe('reading');
      expect(session.currentModule).toBe(2);
      expect(session.currentQuestion).toBe(10);
      expect(session.answers).toEqual({ q1: 'A', q2: 'B', completedModules: ['module-1'] });
      expect(session.abilityEstimates).toEqual({ reading: 0.5 });
      expect(session.status).toBe('in_progress');
      expect(session.completedModules).toEqual(['module-1']);
    });

    it('should throw error if session not found', async () => {
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });

      await expect(
        sessionManager.restoreSession('nonexistent-id')
      ).rejects.toThrow('Session nonexistent-id not found');
    });

    it('should validate restored session state', async () => {
      // Validates Requirement 18.4
      const mockRowInvalid = {
        id: '123',
        session_id: '', // Invalid: empty sessionId
        user_id: 'user-123',
        start_time: new Date(),
        current_section: null,
        current_module: null,
        current_question: 0,
        answers: JSON.stringify({}),
        ability_estimates: JSON.stringify({}),
        status: 'in_progress'
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRowInvalid],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      await expect(
        sessionManager.restoreSession('test-id')
      ).rejects.toThrow('Invalid session state: sessionId is required');
    });
  });

  describe('markModuleCompleted', () => {
    it('should add module to completed modules list', async () => {
      // Validates Requirement 13.4
      const initialAnswers = { completedModules: ['module-1'] };
      
      vi.mocked(mockPool.query)
        .mockResolvedValueOnce({
          rows: [{ answers: initialAnswers }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [],
          command: 'UPDATE',
          rowCount: 1,
          oid: 0,
          fields: []
        });

      await sessionManager.markModuleCompleted('test-session-id', 'module-2');

      const updateCall = vi.mocked(mockPool.query).mock.calls[1];
      const updatedAnswers = JSON.parse(updateCall[1][0] as string);
      
      expect(updatedAnswers.completedModules).toContain('module-1');
      expect(updatedAnswers.completedModules).toContain('module-2');
    });

    it('should initialize completedModules if not present', async () => {
      vi.mocked(mockPool.query)
        .mockResolvedValueOnce({
          rows: [{ answers: {} }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [],
          command: 'UPDATE',
          rowCount: 1,
          oid: 0,
          fields: []
        });

      await sessionManager.markModuleCompleted('test-session-id', 'module-1');

      const updateCall = vi.mocked(mockPool.query).mock.calls[1];
      const updatedAnswers = JSON.parse(updateCall[1][0] as string);
      
      expect(updatedAnswers.completedModules).toEqual(['module-1']);
    });

    it('should not add duplicate modules', async () => {
      const initialAnswers = { completedModules: ['module-1'] };
      
      vi.mocked(mockPool.query)
        .mockResolvedValueOnce({
          rows: [{ answers: initialAnswers }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [],
          command: 'UPDATE',
          rowCount: 1,
          oid: 0,
          fields: []
        });

      await sessionManager.markModuleCompleted('test-session-id', 'module-1');

      const updateCall = vi.mocked(mockPool.query).mock.calls[1];
      const updatedAnswers = JSON.parse(updateCall[1][0] as string);
      
      expect(updatedAnswers.completedModules).toEqual(['module-1']);
    });

    it('should throw error if session not found', async () => {
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });

      await expect(
        sessionManager.markModuleCompleted('nonexistent-id', 'module-1')
      ).rejects.toThrow('Session nonexistent-id not found');
    });
  });

  describe('updateAbilityEstimate', () => {
    it('should update ability estimate for a section', async () => {
      // Validates Requirement 18.3
      const initialEstimates = { reading: 0.3 };
      
      vi.mocked(mockPool.query)
        .mockResolvedValueOnce({
          rows: [{ ability_estimates: initialEstimates }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [],
          command: 'UPDATE',
          rowCount: 1,
          oid: 0,
          fields: []
        });

      await sessionManager.updateAbilityEstimate('test-session-id', 'listening', 0.8);

      const updateCall = vi.mocked(mockPool.query).mock.calls[1];
      const updatedEstimates = JSON.parse(updateCall[1][0] as string);
      
      expect(updatedEstimates.reading).toBe(0.3);
      expect(updatedEstimates.listening).toBe(0.8);
    });

    it('should initialize ability estimates if not present', async () => {
      vi.mocked(mockPool.query)
        .mockResolvedValueOnce({
          rows: [{ ability_estimates: null }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [],
          command: 'UPDATE',
          rowCount: 1,
          oid: 0,
          fields: []
        });

      await sessionManager.updateAbilityEstimate('test-session-id', 'writing', 0.5);

      const updateCall = vi.mocked(mockPool.query).mock.calls[1];
      const updatedEstimates = JSON.parse(updateCall[1][0] as string);
      
      expect(updatedEstimates.writing).toBe(0.5);
    });

    it('should overwrite existing ability estimate', async () => {
      const initialEstimates = { reading: 0.3 };
      
      vi.mocked(mockPool.query)
        .mockResolvedValueOnce({
          rows: [{ ability_estimates: initialEstimates }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [],
          command: 'UPDATE',
          rowCount: 1,
          oid: 0,
          fields: []
        });

      await sessionManager.updateAbilityEstimate('test-session-id', 'reading', 0.9);

      const updateCall = vi.mocked(mockPool.query).mock.calls[1];
      const updatedEstimates = JSON.parse(updateCall[1][0] as string);
      
      expect(updatedEstimates.reading).toBe(0.9);
    });
  });

  describe('getSession', () => {
    it('should retrieve session by ID', async () => {
      const mockRow = {
        id: '123',
        session_id: 'test-session-id',
        user_id: 'user-123',
        start_time: new Date(),
        current_section: 'reading',
        current_module: 1,
        current_question: 0,
        answers: JSON.stringify({}),
        ability_estimates: JSON.stringify({}),
        status: 'in_progress'
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRow],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const session = await sessionManager.getSession('test-session-id');

      expect(session.sessionId).toBe('test-session-id');
      expect(session.userId).toBe('user-123');
    });
  });

  describe('deleteSession', () => {
    it('should delete session from database', async () => {
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [],
        command: 'DELETE',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      await expect(
        sessionManager.deleteSession('test-session-id')
      ).resolves.not.toThrow();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM exam_sessions'),
        ['test-session-id']
      );
    });

    it('should handle deletion errors', async () => {
      vi.mocked(mockPool.query).mockRejectedValue(new Error('Database error'));

      await expect(
        sessionManager.deleteSession('test-session-id')
      ).rejects.toThrow('Session deletion failed');
    });
  });

  describe('state validation', () => {
    it('should reject session with invalid status', async () => {
      const mockRowInvalid = {
        id: '123',
        session_id: 'test-id',
        user_id: 'user-123',
        start_time: new Date(),
        current_section: null,
        current_module: null,
        current_question: 0,
        answers: JSON.stringify({}),
        ability_estimates: JSON.stringify({}),
        status: 'invalid_status' // Invalid status
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRowInvalid],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      await expect(
        sessionManager.restoreSession('test-id')
      ).rejects.toThrow('Invalid session state: status "invalid_status" is not valid');
    });

    it('should reject session with invalid moduleName', async () => {
      const mockRowInvalid = {
        id: '123',
        session_id: 'test-id',
        user_id: 'user-123',
        start_time: new Date(),
        current_section: 'invalid_module', // Invalid module
        current_module: null,
        current_question: 0,
        answers: JSON.stringify({}),
        ability_estimates: JSON.stringify({}),
        status: 'in_progress'
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRowInvalid],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      await expect(
        sessionManager.restoreSession('test-id')
      ).rejects.toThrow('Invalid session state: moduleName "invalid_module" is not valid');
    });

    it('should reject session with negative currentQuestion', async () => {
      const mockRowInvalid = {
        id: '123',
        session_id: 'test-id',
        user_id: 'user-123',
        start_time: new Date(),
        current_section: null,
        current_module: null,
        current_question: -5, // Invalid negative value
        answers: JSON.stringify({}),
        ability_estimates: JSON.stringify({}),
        status: 'in_progress'
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRowInvalid],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      await expect(
        sessionManager.restoreSession('test-id')
      ).rejects.toThrow('Invalid session state: currentQuestion must be a non-negative number');
    });

    it('should reject session with missing userId', async () => {
      const mockRowInvalid = {
        id: '123',
        session_id: 'test-id',
        user_id: '', // Invalid: empty userId
        start_time: new Date(),
        current_section: null,
        current_module: null,
        current_question: 0,
        answers: JSON.stringify({}),
        ability_estimates: JSON.stringify({}),
        status: 'in_progress'
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRowInvalid],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      await expect(
        sessionManager.restoreSession('test-id')
      ).rejects.toThrow('Invalid session state: userId is required');
    });

    it('should reject session with invalid startedAt date', async () => {
      const mockRowInvalid = {
        id: '123',
        session_id: 'test-id',
        user_id: 'user-123',
        start_time: 'invalid-date', // Invalid date
        current_section: null,
        current_module: null,
        current_question: 0,
        answers: JSON.stringify({}),
        ability_estimates: JSON.stringify({}),
        status: 'in_progress'
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRowInvalid],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      await expect(
        sessionManager.restoreSession('test-id')
      ).rejects.toThrow('Invalid session state: startedAt must be a valid date');
    });

    it('should reject session with non-object answers', async () => {
      const mockRowInvalid = {
        id: '123',
        session_id: 'test-id',
        user_id: 'user-123',
        start_time: new Date(),
        current_section: null,
        current_module: null,
        current_question: 0,
        answers: JSON.stringify('not an object'), // Invalid: answers must be object
        ability_estimates: JSON.stringify({}),
        status: 'in_progress'
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRowInvalid],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      await expect(
        sessionManager.restoreSession('test-id')
      ).rejects.toThrow('Invalid session state: answers must be an object');
    });

    it('should reject session with non-object abilityEstimates', async () => {
      const mockRowInvalid = {
        id: '123',
        session_id: 'test-id',
        user_id: 'user-123',
        start_time: new Date(),
        current_section: null,
        current_module: null,
        current_question: 0,
        answers: JSON.stringify({}),
        ability_estimates: JSON.stringify([1, 2, 3]), // Invalid: must be object
        status: 'in_progress'
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRowInvalid],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      await expect(
        sessionManager.restoreSession('test-id')
      ).rejects.toThrow('Invalid session state: abilityEstimates must be an object');
    });
  });

  describe('JSONB field handling', () => {
    it('should handle complex nested answers structure', async () => {
      const complexAnswers = {
        reading: {
          module1: { q1: 'A', q2: 'B' },
          module2: { q1: 'C', q2: 'D' }
        },
        listening: {
          module1: { q1: 'answer1' }
        },
        completedModules: ['reading-module-1', 'listening-module-1']
      };

      const mockRow = {
        id: '123',
        session_id: 'test-session-id',
        user_id: 'user-123',
        start_time: new Date(),
        current_section: 'writing',
        current_module: 1,
        current_question: 5,
        answers: JSON.stringify(complexAnswers),
        ability_estimates: JSON.stringify({ reading: 0.5, listening: -0.3 }),
        status: 'in_progress'
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRow],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const session = await sessionManager.restoreSession('test-session-id');

      expect(session.answers).toEqual(complexAnswers);
      expect(session.completedModules).toEqual(['reading-module-1', 'listening-module-1']);
    });

    it('should handle answers as object (already parsed)', async () => {
      const answersObj = { q1: 'A', q2: 'B' };

      const mockRow = {
        id: '123',
        session_id: 'test-session-id',
        user_id: 'user-123',
        start_time: new Date(),
        current_section: 'reading',
        current_module: 1,
        current_question: 2,
        answers: answersObj, // Already parsed object
        ability_estimates: {},
        status: 'in_progress'
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRow],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const session = await sessionManager.restoreSession('test-session-id');

      expect(session.answers).toEqual(answersObj);
    });

    it('should handle null answers', async () => {
      const mockRow = {
        id: '123',
        session_id: 'test-session-id',
        user_id: 'user-123',
        start_time: new Date(),
        current_section: 'reading',
        current_module: 1,
        current_question: 0,
        answers: null, // Null answers
        ability_estimates: JSON.stringify({}),
        status: 'not_started'
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRow],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const session = await sessionManager.restoreSession('test-session-id');

      expect(session.answers).toEqual({});
      expect(session.completedModules).toEqual([]);
    });

    it('should handle ability_estimates as object (already parsed)', async () => {
      const estimatesObj = { reading: 0.8, writing: -0.2 };

      const mockRow = {
        id: '123',
        session_id: 'test-session-id',
        user_id: 'user-123',
        start_time: new Date(),
        current_section: 'speaking',
        current_module: 1,
        current_question: 3,
        answers: JSON.stringify({}),
        ability_estimates: estimatesObj, // Already parsed object
        status: 'in_progress'
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRow],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const session = await sessionManager.restoreSession('test-session-id');

      expect(session.abilityEstimates).toEqual(estimatesObj);
    });

    it('should handle null ability_estimates', async () => {
      const mockRow = {
        id: '123',
        session_id: 'test-session-id',
        user_id: 'user-123',
        start_time: new Date(),
        current_section: 'reading',
        current_module: 1,
        current_question: 0,
        answers: JSON.stringify({}),
        ability_estimates: null, // Null ability estimates
        status: 'not_started'
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRow],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const session = await sessionManager.restoreSession('test-session-id');

      expect(session.abilityEstimates).toEqual({});
    });
  });

  describe('database error handling', () => {
    it('should handle database errors in markModuleCompleted', async () => {
      vi.mocked(mockPool.query)
        .mockResolvedValueOnce({
          rows: [{ answers: {} }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        })
        .mockRejectedValueOnce(new Error('Database connection lost'));

      await expect(
        sessionManager.markModuleCompleted('test-session-id', 'module-1')
      ).rejects.toThrow('Failed to mark module module-1 as completed');
    });

    it('should handle database errors in updateAbilityEstimate', async () => {
      vi.mocked(mockPool.query)
        .mockResolvedValueOnce({
          rows: [{ ability_estimates: {} }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        })
        .mockRejectedValueOnce(new Error('Database connection lost'));

      await expect(
        sessionManager.updateAbilityEstimate('test-session-id', 'reading', 0.5)
      ).rejects.toThrow('Failed to update ability estimate for section reading');
    });

    it('should handle session not found in updateAbilityEstimate', async () => {
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });

      await expect(
        sessionManager.updateAbilityEstimate('nonexistent-id', 'reading', 0.5)
      ).rejects.toThrow('Session nonexistent-id not found');
    });
  });

  describe('persistSession edge cases', () => {
    it('should persist multiple fields in a single update', async () => {
      const mockRow = {
        id: '123',
        session_id: 'test-session-id',
        user_id: 'user-123',
        start_time: new Date(),
        end_time: null,
        expiration_time: new Date(),
        current_section: 'writing',
        current_module: 2,
        current_question: 10,
        answers: JSON.stringify({ q1: 'A', q2: 'B', q3: 'C' }),
        ability_estimates: JSON.stringify({ reading: 0.5 }),
        status: 'in_progress',
        score: 25,
        completed_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRow],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const updateRequest: UpdateSessionRequest = {
        moduleName: 'writing',
        status: 'in_progress',
        currentQuestion: 10,
        answers: { q1: 'A', q2: 'B', q3: 'C' },
        score: 25,
        currentSection: 'writing',
        currentModule: 2
      };

      const session = await sessionManager.persistSession('test-session-id', updateRequest);

      expect(session.moduleName).toBe('writing');
      expect(session.status).toBe('in_progress');
      expect(session.currentQuestion).toBe(10);
      expect(session.score).toBe(25);
      expect(session.currentModule).toBe(2);
    });

    it('should persist null score', async () => {
      const mockRow = {
        id: '123',
        session_id: 'test-session-id',
        user_id: 'user-123',
        start_time: new Date(),
        current_section: 'reading',
        current_module: 1,
        current_question: 5,
        answers: JSON.stringify({}),
        ability_estimates: JSON.stringify({}),
        status: 'in_progress',
        score: null
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRow],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const session = await sessionManager.persistSession('test-session-id', { score: null });

      expect(session.score).toBeNull();
    });

    it('should persist completedAt date', async () => {
      const completedDate = new Date('2024-01-01T12:00:00Z');
      const mockRow = {
        id: '123',
        session_id: 'test-session-id',
        user_id: 'user-123',
        start_time: new Date(),
        current_section: 'speaking',
        current_module: 2,
        current_question: 11,
        answers: JSON.stringify({}),
        ability_estimates: JSON.stringify({}),
        status: 'completed',
        completed_at: completedDate
      };

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [mockRow],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const session = await sessionManager.persistSession('test-session-id', {
        status: 'completed',
        completedAt: completedDate
      });

      expect(session.status).toBe('completed');
      expect(session.completedAt).toEqual(completedDate);
    });
  });
});
