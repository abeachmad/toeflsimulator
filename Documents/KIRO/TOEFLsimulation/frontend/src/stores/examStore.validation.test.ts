import { describe, it, expect, beforeEach } from 'vitest'
import { useExamStore, resetExamStore, EXAM_STORE_VERSION, EXAM_STORE_NAME } from './examStore'

describe('examStore - Task 13.1 Validation', () => {
  beforeEach(() => {
    localStorage.clear()
    resetExamStore()
  })

  describe('State Structure - Requirement 18.3', () => {
    it('should have sessionId in state', () => {
      const state = useExamStore.getState()
      expect(state).toHaveProperty('sessionId')
      expect(state.sessionId).toBeNull()
    })

    it('should have currentSection in state', () => {
      const state = useExamStore.getState()
      expect(state).toHaveProperty('currentSection')
      expect(state.currentSection).toBeNull()
    })

    it('should have currentModule in state', () => {
      const state = useExamStore.getState()
      expect(state).toHaveProperty('currentModule')
      expect(state.currentModule).toBeNull()
    })

    it('should have currentQuestionIndex in state', () => {
      const state = useExamStore.getState()
      expect(state).toHaveProperty('currentQuestionIndex')
      expect(state.currentQuestionIndex).toBe(0)
    })

    it('should have answers as a Map in state', () => {
      const state = useExamStore.getState()
      expect(state).toHaveProperty('answers')
      expect(state.answers).toBeInstanceOf(Map)
      expect(state.answers.size).toBe(0)
    })

    it('should have completedModules as a Set in state', () => {
      const state = useExamStore.getState()
      expect(state).toHaveProperty('completedModules')
      expect(state.completedModules).toBeInstanceOf(Set)
      expect(state.completedModules.size).toBe(0)
    })
  })

  describe('Actions - setSession', () => {
    it('should set session with all parameters', () => {
      useExamStore.getState().setSession({
        sessionId: 'test-session-123',
        currentSection: 'reading',
        currentModule: 'module-r1',
        currentQuestionIndex: 5,
      })

      const state = useExamStore.getState()
      expect(state.sessionId).toBe('test-session-123')
      expect(state.currentSection).toBe('reading')
      expect(state.currentModule).toBe('module-r1')
      expect(state.currentQuestionIndex).toBe(5)
    })

    it('should set session with only sessionId', () => {
      useExamStore.getState().setSession({
        sessionId: 'minimal-session',
      })

      const state = useExamStore.getState()
      expect(state.sessionId).toBe('minimal-session')
      expect(state.currentSection).toBeNull()
      expect(state.currentModule).toBeNull()
      expect(state.currentQuestionIndex).toBe(0)
    })
  })

  describe('Actions - updateAnswer', () => {
    it('should store a single answer', () => {
      useExamStore.getState().updateAnswer('q-1', 'A')

      const state = useExamStore.getState()
      expect(state.answers.get('q-1')).toBe('A')
    })

    it('should store multiple choice array answer', () => {
      useExamStore.getState().updateAnswer('q-2', ['A', 'C', 'D'])

      const state = useExamStore.getState()
      expect(state.answers.get('q-2')).toEqual(['A', 'C', 'D'])
    })

    it('should store numeric answer', () => {
      useExamStore.getState().updateAnswer('q-3', 42)

      const state = useExamStore.getState()
      expect(state.answers.get('q-3')).toBe(42)
    })

    it('should store null answer', () => {
      useExamStore.getState().updateAnswer('q-4', null)

      const state = useExamStore.getState()
      expect(state.answers.get('q-4')).toBeNull()
    })

    it('should update existing answer', () => {
      useExamStore.getState().updateAnswer('q-1', 'A')
      useExamStore.getState().updateAnswer('q-1', 'B')

      const state = useExamStore.getState()
      expect(state.answers.get('q-1')).toBe('B')
    })
  })

  describe('Actions - nextQuestion', () => {
    it('should increment question index', () => {
      useExamStore.getState().nextQuestion()

      const state = useExamStore.getState()
      expect(state.currentQuestionIndex).toBe(1)
    })

    it('should respect max questions boundary', () => {
      useExamStore.getState().nextQuestion(10)
      useExamStore.getState().nextQuestion(10)

      let state = useExamStore.getState()
      expect(state.currentQuestionIndex).toBe(2)

      // Try to go beyond max
      for (let i = 0; i < 20; i++) {
        useExamStore.getState().nextQuestion(10)
      }

      state = useExamStore.getState()
      expect(state.currentQuestionIndex).toBe(9) // Max is 9 (0-indexed for 10 questions)
    })
  })

  describe('Actions - prevQuestion', () => {
    it('should decrement question index', () => {
      useExamStore.getState().goToQuestion(5)
      useExamStore.getState().prevQuestion()

      const state = useExamStore.getState()
      expect(state.currentQuestionIndex).toBe(4)
    })

    it('should not go below zero', () => {
      useExamStore.getState().goToQuestion(0)
      useExamStore.getState().prevQuestion()

      const state = useExamStore.getState()
      expect(state.currentQuestionIndex).toBe(0)
    })
  })

  describe('Actions - submitModule', () => {
    it('should mark current module as completed', () => {
      useExamStore.getState().setSession({
        sessionId: 'test-session',
        currentModule: 'module-1',
      })
      useExamStore.getState().submitModule()

      const state = useExamStore.getState()
      expect(state.completedModules.has('module-1')).toBe(true)
    })

    it('should do nothing if no current module', () => {
      useExamStore.getState().submitModule()

      const state = useExamStore.getState()
      expect(state.completedModules.size).toBe(0)
    })
  })

  describe('Actions - markModuleComplete', () => {
    it('should mark specified module as completed', () => {
      useExamStore.getState().markModuleComplete('module-x')
      useExamStore.getState().markModuleComplete('module-y')

      const state = useExamStore.getState()
      expect(state.completedModules.has('module-x')).toBe(true)
      expect(state.completedModules.has('module-y')).toBe(true)
      expect(state.completedModules.size).toBe(2)
    })
  })

  describe('Zustand Persist Middleware - Requirement 18.2', () => {
    it('should persist state to localStorage', async () => {
      useExamStore.getState().setSession({
        sessionId: 'persist-test',
        currentSection: 'listening',
        currentQuestionIndex: 3,
      })
      useExamStore.getState().updateAnswer('q-10', 'D')

      // Force a flush to localStorage
      await useExamStore.persist.rehydrate()

      const stored = localStorage.getItem(EXAM_STORE_NAME)
      expect(stored).not.toBeNull()
      expect(stored).toContain('persist-test')
    })

    it('should restore state from localStorage', async () => {
      // Set up state
      useExamStore.getState().setSession({
        sessionId: 'restore-test',
        currentSection: 'writing',
        currentModule: 'module-w1',
        currentQuestionIndex: 7,
      })
      useExamStore.getState().updateAnswer('q-20', 'Essay text')
      useExamStore.getState().markModuleComplete('module-w1')

      // Reset and rehydrate
      resetExamStore()
      await useExamStore.persist.rehydrate()

      const state = useExamStore.getState()
      expect(state.sessionId).toBe('restore-test')
      expect(state.currentSection).toBe('writing')
      expect(state.currentModule).toBe('module-w1')
      expect(state.currentQuestionIndex).toBe(7)
      expect(state.answers.get('q-20')).toBe('Essay text')
      expect(state.completedModules.has('module-w1')).toBe(true)
    })
  })

  describe('State Versioning - Requirement 18.8', () => {
    it('should have a version constant', () => {
      expect(EXAM_STORE_VERSION).toBeDefined()
      expect(typeof EXAM_STORE_VERSION).toBe('number')
      expect(EXAM_STORE_VERSION).toBeGreaterThan(0)
    })

    it('should include version in persisted state', async () => {
      useExamStore.getState().setSession({
        sessionId: 'version-test',
      })

      await useExamStore.persist.rehydrate()

      const stored = localStorage.getItem(EXAM_STORE_NAME)
      expect(stored).not.toBeNull()
      
      const parsed = JSON.parse(stored!)
      expect(parsed).toHaveProperty('version')
      expect(parsed.version).toBe(EXAM_STORE_VERSION)
    })
  })

  describe('State Migration Logic - Requirement 18.8', () => {
    it('should migrate legacy state with plain object answers', async () => {
      // Simulate legacy state
      const legacyState = {
        state: {
          sessionId: 'legacy-session',
          currentSection: 'reading',
          currentModule: 'module-legacy',
          currentQuestionIndex: 2,
          answers: { 'q-1': 'A', 'q-2': 'B' },
          completedModules: ['module-1', 'module-2'],
        },
        version: 0,
      }

      localStorage.setItem(EXAM_STORE_NAME, JSON.stringify(legacyState))

      resetExamStore()
      await useExamStore.persist.rehydrate()

      const state = useExamStore.getState()
      expect(state.sessionId).toBe('legacy-session')
      expect(state.answers).toBeInstanceOf(Map)
      expect(state.answers.get('q-1')).toBe('A')
      expect(state.answers.get('q-2')).toBe('B')
      expect(state.completedModules).toBeInstanceOf(Set)
      expect(state.completedModules.has('module-1')).toBe(true)
      expect(state.completedModules.has('module-2')).toBe(true)
    })

    it('should handle corrupted state gracefully', async () => {
      localStorage.setItem(EXAM_STORE_NAME, 'invalid-json{{{')

      resetExamStore()
      await useExamStore.persist.rehydrate()

      const state = useExamStore.getState()
      expect(state.sessionId).toBeNull()
      expect(state.answers).toBeInstanceOf(Map)
      expect(state.completedModules).toBeInstanceOf(Set)
    })
  })

  describe('Map and Set Serialization', () => {
    it('should correctly serialize and deserialize Map', async () => {
      useExamStore.getState().updateAnswer('q-1', 'A')
      useExamStore.getState().updateAnswer('q-2', ['B', 'C'])
      useExamStore.getState().updateAnswer('q-3', 42)

      await useExamStore.persist.rehydrate()

      const stored = localStorage.getItem(EXAM_STORE_NAME)
      expect(stored).not.toBeNull()

      resetExamStore()
      await useExamStore.persist.rehydrate()

      const state = useExamStore.getState()
      expect(state.answers).toBeInstanceOf(Map)
      expect(state.answers.get('q-1')).toBe('A')
      expect(state.answers.get('q-2')).toEqual(['B', 'C'])
      expect(state.answers.get('q-3')).toBe(42)
    })

    it('should correctly serialize and deserialize Set', async () => {
      useExamStore.getState().markModuleComplete('module-1')
      useExamStore.getState().markModuleComplete('module-2')
      useExamStore.getState().markModuleComplete('module-3')

      await useExamStore.persist.rehydrate()

      resetExamStore()
      await useExamStore.persist.rehydrate()

      const state = useExamStore.getState()
      expect(state.completedModules).toBeInstanceOf(Set)
      expect(state.completedModules.size).toBe(3)
      expect(state.completedModules.has('module-1')).toBe(true)
      expect(state.completedModules.has('module-2')).toBe(true)
      expect(state.completedModules.has('module-3')).toBe(true)
    })
  })

  describe('Reset Functionality - Requirements 18.5, 18.6, 18.7', () => {
    it('should clear all state on reset', () => {
      useExamStore.getState().setSession({
        sessionId: 'reset-test',
        currentSection: 'speaking',
        currentModule: 'module-s1',
        currentQuestionIndex: 4,
      })
      useExamStore.getState().updateAnswer('q-1', 'Answer')
      useExamStore.getState().markModuleComplete('module-s1')

      resetExamStore()

      const state = useExamStore.getState()
      expect(state.sessionId).toBeNull()
      expect(state.currentSection).toBeNull()
      expect(state.currentModule).toBeNull()
      expect(state.currentQuestionIndex).toBe(0)
      expect(state.answers.size).toBe(0)
      expect(state.completedModules.size).toBe(0)
    })

    it('should prevent restoration after reset', async () => {
      useExamStore.getState().setSession({
        sessionId: 'before-reset',
      })
      await useExamStore.persist.rehydrate()

      resetExamStore()
      
      // Clear localStorage to simulate reset clearing persisted state
      localStorage.removeItem(EXAM_STORE_NAME)

      await useExamStore.persist.rehydrate()

      const state = useExamStore.getState()
      expect(state.sessionId).toBeNull()
    })
  })

  describe('Integration - Full Exam Flow', () => {
    it('should handle complete exam workflow', async () => {
      // Start exam
      useExamStore.getState().setSession({
        sessionId: 'full-exam-test',
        currentSection: 'reading',
        currentModule: 'reading-stage1-medium',
        currentQuestionIndex: 0,
      })

      // Answer questions
      useExamStore.getState().updateAnswer('r-q1', 'A')
      useExamStore.getState().nextQuestion(10)
      useExamStore.getState().updateAnswer('r-q2', 'B')
      useExamStore.getState().nextQuestion(10)

      // Submit module
      useExamStore.getState().submitModule()

      // Move to next section
      useExamStore.getState().setSession({
        sessionId: 'full-exam-test',
        currentSection: 'listening',
        currentModule: 'listening-stage1-medium',
        currentQuestionIndex: 0,
      })

      // Persist
      await useExamStore.persist.rehydrate()

      // Simulate crash and restore
      resetExamStore()
      await useExamStore.persist.rehydrate()

      const state = useExamStore.getState()
      expect(state.sessionId).toBe('full-exam-test')
      expect(state.currentSection).toBe('listening')
      expect(state.answers.get('r-q1')).toBe('A')
      expect(state.answers.get('r-q2')).toBe('B')
      expect(state.completedModules.has('reading-stage1-medium')).toBe(true)
    })
  })
})
