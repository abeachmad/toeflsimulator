/**
 * Comprehensive unit tests for Zustand store persistence
 * Task 13.5: Write unit tests for Zustand stores
 * 
 * Tests:
 * - Store actions update state correctly
 * - Persistence to localStorage
 * - State restoration on app load
 * - State version migration
 * 
 * Requirements: 18.3, 18.4, 18.5, 18.8
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  useExamStore,
  resetExamStore,
  EXAM_STORE_NAME,
  EXAM_STORE_VERSION,
} from './examStore'
import {
  useTimerStore,
  resetTimerStore,
  TIMER_STORE_NAME,
  TIMER_STORE_VERSION,
} from './timerStore'
import {
  useAbilityStore,
  resetAbilityStore,
  ABILITY_STORE_NAME,
} from './abilityStore'
import { useUIStore, resetUIStore, UI_STORE_NAME } from './uiStore'

describe('Zustand Stores - Persistence and State Management', () => {
  beforeEach(async () => {
    localStorage.clear()
    resetExamStore()
    resetTimerStore()
    resetAbilityStore()
    resetUIStore()
    // Wait for any pending persistence operations to complete
    await new Promise((resolve) => setTimeout(resolve, 50))
    vi.clearAllTimers()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('examStore - Persistence (Requirement 18.3)', () => {
    it('persists state to localStorage when actions are called', async () => {
      const { setSession, updateAnswer, markModuleComplete } =
        useExamStore.getState()

      setSession({
        sessionId: 'test-session-123',
        currentSection: 'reading',
        currentModule: 'reading-m1',
        currentQuestionIndex: 5,
      })
      updateAnswer('q1', 'A')
      markModuleComplete('module-1')

      // Wait for persistence (debounced)
      await new Promise((resolve) => setTimeout(resolve, 100))

      const stored = localStorage.getItem(EXAM_STORE_NAME)
      expect(stored).toBeTruthy()

      const parsed = JSON.parse(stored!)
      expect(parsed.state.sessionId).toBe('test-session-123')
      expect(parsed.state.currentSection).toBe('reading')
    })

    it('restores state from localStorage on initialization (Requirement 18.4)', async () => {
      // Set up initial state
      const { setSession, updateAnswer } = useExamStore.getState()
      setSession({
        sessionId: 'restore-test',
        currentSection: 'listening',
        currentQuestionIndex: 3,
      })
      updateAnswer('q1', 'B')
      updateAnswer('q2', ['C', 'D'])

      // Wait for persistence to complete (Zustand persist middleware debounces writes)
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Verify data is in localStorage
      const stored = localStorage.getItem(EXAM_STORE_NAME)
      expect(stored).toBeTruthy()

      // Rehydrate from localStorage (simulates app reload)
      await useExamStore.persist.rehydrate()

      const restoredState = useExamStore.getState()
      expect(restoredState.sessionId).toBe('restore-test')
      expect(restoredState.currentSection).toBe('listening')
      expect(restoredState.currentQuestionIndex).toBe(3)
      expect(restoredState.answers.get('q1')).toBe('B')
      expect(restoredState.answers.get('q2')).toEqual(['C', 'D'])
    })

    it('persists Map and Set data structures correctly', async () => {
      const { updateAnswer, markModuleComplete } = useExamStore.getState()

      updateAnswer('q1', 'A')
      updateAnswer('q2', 'B')
      markModuleComplete('module-1')
      markModuleComplete('module-2')

      await new Promise((resolve) => setTimeout(resolve, 200))

      // Rehydrate from localStorage
      await useExamStore.persist.rehydrate()

      const state = useExamStore.getState()
      expect(state.answers).toBeInstanceOf(Map)
      expect(state.completedModules).toBeInstanceOf(Set)
      expect(state.answers.get('q1')).toBe('A')
      expect(state.answers.get('q2')).toBe('B')
      expect(state.completedModules.has('module-1')).toBe(true)
      expect(state.completedModules.has('module-2')).toBe(true)
    })

    it('includes version in persisted state (Requirement 18.8)', async () => {
      useExamStore.getState().setSession({ sessionId: 'version-test' })

      await new Promise((resolve) => setTimeout(resolve, 200))

      const stored = localStorage.getItem(EXAM_STORE_NAME)
      expect(stored).toBeTruthy()

      const parsed = JSON.parse(stored!)
      expect(parsed.version).toBe(EXAM_STORE_VERSION)
    })

    it('migrates state when version changes (Requirement 18.8)', async () => {
      // Simulate old version state with plain objects instead of Map/Set
      const oldState = {
        version: 0,
        state: {
          sessionId: 'migrated-session',
          currentSection: 'reading',
          currentModule: 'reading-m1',
          currentQuestionIndex: 2,
          answers: { q1: 'A', q2: 'B' }, // Plain object, not Map
          completedModules: ['module-1', 'module-2'], // Array, not Set
        },
      }

      localStorage.setItem(EXAM_STORE_NAME, JSON.stringify(oldState))

      // Rehydrate with migration
      await useExamStore.persist.rehydrate()

      const state = useExamStore.getState()
      expect(state.sessionId).toBe('migrated-session')
      expect(state.answers).toBeInstanceOf(Map)
      expect(state.completedModules).toBeInstanceOf(Set)
      expect(state.answers.get('q1')).toBe('A')
      expect(state.completedModules.has('module-1')).toBe(true)
    })

    it('clears persisted state when reset is called (Requirement 18.5)', async () => {
      const { setSession, updateAnswer, reset } = useExamStore.getState()

      setSession({ sessionId: 'clear-test' })
      updateAnswer('q1', 'A')

      await new Promise((resolve) => setTimeout(resolve, 200))

      expect(localStorage.getItem(EXAM_STORE_NAME)).toBeTruthy()

      reset()

      await new Promise((resolve) => setTimeout(resolve, 200))

      // After reset, localStorage should have empty state
      const stored = localStorage.getItem(EXAM_STORE_NAME)
      if (stored) {
        const parsed = JSON.parse(stored)
        expect(parsed.state.sessionId).toBeNull()
      }
    })
  })

  describe('timerStore - Persistence (Requirement 18.3)', () => {
    it('persists timer state to localStorage', async () => {
      const now = Date.now()

      useTimerStore.getState().initializeTimer(30, now)

      // Wait for Zustand persistence (uses debouncing)
      await new Promise((resolve) => setTimeout(resolve, 200))

      const stored = localStorage.getItem(TIMER_STORE_NAME)
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed.state.remainingTime).toBe(1800)
      expect(parsed.state.expirationTime).toBe(now + 30 * 60_000)
    })

    it('restores timer state on app load (Requirement 18.4)', async () => {
      const now = Date.now()

      useTimerStore.getState().initializeTimer(45, now)
      useTimerStore.setState({ remainingTime: 2000 })

      await new Promise((resolve) => setTimeout(resolve, 200))

      await useTimerStore.persist.rehydrate()

      const restoredState = useTimerStore.getState()
      expect(restoredState.remainingTime).toBe(2000)
      expect(restoredState.expirationTime).toBe(now + 45 * 60_000)
    })

    it('does not persist interval IDs (runtime-only state)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            serverTime: Date.now(),
            expirationTime: Date.now() + 60000,
            remainingTime: 60,
            driftDetected: false,
          },
        }),
      } as Response)

      useTimerStore.getState().startCountdown()
      useTimerStore.getState().startHeartbeat('test-session')

      await new Promise((resolve) => setTimeout(resolve, 200))

      const stored = localStorage.getItem(TIMER_STORE_NAME)
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed.state.countdownIntervalId).toBeUndefined()
      expect(parsed.state.heartbeatIntervalId).toBeUndefined()
    })

    it('includes version in persisted state (Requirement 18.8)', async () => {
      useTimerStore.getState().initializeTimer(10)

      await new Promise((resolve) => setTimeout(resolve, 200))

      const stored = localStorage.getItem(TIMER_STORE_NAME)
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed.version).toBe(TIMER_STORE_VERSION)
    })

    it('clears timer state when reset is called (Requirement 18.5)', async () => {
      useTimerStore.getState().initializeTimer(30)

      await vi.waitFor(
        () => localStorage.getItem(TIMER_STORE_NAME) !== null,
        { timeout: 1000 }
      )

      useTimerStore.getState().reset()

      const state = useTimerStore.getState()
      expect(state.remainingTime).toBe(0)
      expect(state.expirationTime).toBeNull()
    })
  })

  describe('abilityStore - Persistence (Requirement 18.3)', () => {
    it('persists ability estimates to localStorage', async () => {
      const { updateAbility, setItemParameters } = useAbilityStore.getState()

      updateAbility('reading', 0.73)
      updateAbility('listening', -0.2)
      setItemParameters('item-1', { a: 1.2, b: -0.4, c: 0.18 })

      await new Promise((resolve) => setTimeout(resolve, 200))

      const stored = localStorage.getItem(ABILITY_STORE_NAME)
      expect(stored).toBeTruthy()

      const parsed = JSON.parse(stored!)
      expect(parsed.state.abilityEstimates.reading).toBe(0.73)
      expect(parsed.state.abilityEstimates.listening).toBe(-0.2)
    })

    it('restores ability state on app load (Requirement 18.4)', async () => {
      const { updateAbility, recordRouting } = useAbilityStore.getState()

      updateAbility('reading', 1.1)
      recordRouting({
        section: 'reading',
        stage: 2,
        ability: 1.1,
        difficulty: 'hard',
        timestamp: 5000,
      })

      await new Promise((resolve) => setTimeout(resolve, 200))

      await useAbilityStore.persist.rehydrate()

      const state = useAbilityStore.getState()
      expect(state.abilityEstimates.reading).toBe(1.1)
      expect(state.routingDecisions).toHaveLength(1)
      expect(state.routingDecisions[0].difficulty).toBe('hard')
    })

    it('includes version in persisted state (Requirement 18.8)', async () => {
      useAbilityStore.getState().updateAbility('reading', 0.5)

      await new Promise((resolve) => setTimeout(resolve, 200))

      const stored = localStorage.getItem(ABILITY_STORE_NAME)
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed.version).toBe(1)
    })
  })

  describe('uiStore - Persistence (Requirement 18.3)', () => {
    it('persists UI state to localStorage', async () => {
      const { openReviewModal, lockQuestion, recordNavigation } =
        useUIStore.getState()

      openReviewModal()
      lockQuestion('q1')
      lockQuestion('q2')
      recordNavigation('/exam/reading')

      await new Promise((resolve) => setTimeout(resolve, 200))

      const stored = localStorage.getItem(UI_STORE_NAME)
      expect(stored).toBeTruthy()

      const parsed = JSON.parse(stored!)
      expect(parsed.state.isReviewModalOpen).toBe(true)
    })

    it('restores UI state on app load (Requirement 18.4)', async () => {
      const { lockQuestion, setGatekeeperActive } = useUIStore.getState()

      lockQuestion('q1')
      lockQuestion('q2')
      setGatekeeperActive(true)

      await new Promise((resolve) => setTimeout(resolve, 200))

      await useUIStore.persist.rehydrate()

      const state = useUIStore.getState()
      expect(state.lockedQuestions.has('q1')).toBe(true)
      expect(state.lockedQuestions.has('q2')).toBe(true)
      expect(state.isGatekeeperActive).toBe(true)
    })

    it('migrates Set data structure correctly (Requirement 18.8)', async () => {
      // Simulate old state with array instead of Set - migration happens during rehydration
      // For this test, we'll use the migration function directly by setting raw data
      const oldStateRaw = JSON.stringify({
        version: 1,
        state: {
          isReviewModalOpen: false,
          isGatekeeperActive: false,
          lockedQuestions: {
            __type: 'Set',
            value: ['q1', 'q2', 'q3'],
          },
          navigationHistory: ['/exam/reading'],
        },
      })

      localStorage.setItem(UI_STORE_NAME, oldStateRaw)

      await useUIStore.persist.rehydrate()

      const state = useUIStore.getState()
      expect(state.lockedQuestions).toBeInstanceOf(Set)
      expect(state.lockedQuestions.has('q1')).toBe(true)
      expect(state.lockedQuestions.has('q2')).toBe(true)
      expect(state.lockedQuestions.has('q3')).toBe(true)
    })
  })

  describe('Cross-Store State Restoration (Requirement 18.4)', () => {
    it('restores all stores independently', async () => {
      // Set up state in all stores
      useExamStore.getState().setSession({ sessionId: 'multi-test' })
      useTimerStore.getState().initializeTimer(30)
      useAbilityStore.getState().updateAbility('reading', 0.5)
      useUIStore.getState().lockQuestion('q1')

      // Wait for all stores to persist
      await new Promise((resolve) => setTimeout(resolve, 300))

      // Rehydrate all stores (simulates app reload)
      await useExamStore.persist.rehydrate()
      await useTimerStore.persist.rehydrate()
      await useAbilityStore.persist.rehydrate()
      await useUIStore.persist.rehydrate()

      // Verify each store restored independently
      expect(useExamStore.getState().sessionId).toBe('multi-test')
      expect(useTimerStore.getState().remainingTime).toBe(1800)
      expect(useAbilityStore.getState().abilityEstimates.reading).toBe(0.5)
      expect(useUIStore.getState().lockedQuestions.has('q1')).toBe(true)
    })

    it('handles missing localStorage gracefully', async () => {
      localStorage.clear()

      await useExamStore.persist.rehydrate()
      await useTimerStore.persist.rehydrate()
      await useAbilityStore.persist.rehydrate()
      await useUIStore.persist.rehydrate()

      // All stores should have default state
      expect(useExamStore.getState().sessionId).toBeNull()
      expect(useTimerStore.getState().remainingTime).toBe(0)
      expect(Object.keys(useAbilityStore.getState().abilityEstimates)).toHaveLength(0)
      expect(useUIStore.getState().lockedQuestions.size).toBe(0)
    })

    it('handles corrupted localStorage data', async () => {
      localStorage.setItem(EXAM_STORE_NAME, 'invalid json {')
      localStorage.setItem(TIMER_STORE_NAME, '{"broken": true')

      // Should not throw
      await expect(useExamStore.persist.rehydrate()).resolves.not.toThrow()
      await expect(useTimerStore.persist.rehydrate()).resolves.not.toThrow()

      // Should fall back to default state
      expect(useExamStore.getState().sessionId).toBeNull()
      expect(useTimerStore.getState().remainingTime).toBe(0)
    })
  })

  describe('Store Actions Update State Correctly', () => {
    it('examStore actions update state immediately', () => {
      const { setSession, updateAnswer, nextQuestion } =
        useExamStore.getState()

      setSession({ sessionId: 'action-test' })
      expect(useExamStore.getState().sessionId).toBe('action-test')

      updateAnswer('q1', 'A')
      expect(useExamStore.getState().answers.get('q1')).toBe('A')

      nextQuestion()
      expect(useExamStore.getState().currentQuestionIndex).toBe(1)
    })

    it('timerStore actions update state immediately', () => {
      const { initializeTimer, updateRemainingTime } =
        useTimerStore.getState()

      initializeTimer(30)
      expect(useTimerStore.getState().remainingTime).toBe(1800)

      updateRemainingTime(1500)
      expect(useTimerStore.getState().remainingTime).toBe(1500)
    })

    it('abilityStore actions update state immediately', () => {
      const { updateAbility, recordRouting } = useAbilityStore.getState()

      updateAbility('reading', 0.8)
      expect(useAbilityStore.getState().abilityEstimates.reading).toBe(0.8)

      recordRouting({
        section: 'reading',
        stage: 2,
        ability: 0.8,
        difficulty: 'medium',
      })
      expect(useAbilityStore.getState().routingDecisions).toHaveLength(1)
    })

    it('uiStore actions update state immediately', () => {
      const { openReviewModal, lockQuestion } = useUIStore.getState()

      openReviewModal()
      expect(useUIStore.getState().isReviewModalOpen).toBe(true)

      lockQuestion('q1')
      expect(useUIStore.getState().lockedQuestions.has('q1')).toBe(true)
    })
  })

  describe('State Version Migration (Requirement 18.8)', () => {
    it('examStore migrates from version 0 to version 1', async () => {
      const oldState = {
        version: 0,
        state: {
          sessionId: 'v0-session',
          currentSection: 'reading',
          currentModule: null,
          currentQuestionIndex: 0,
          answers: { q1: 'A', q2: 'B' },
          completedModules: ['module-1'],
        },
      }

      localStorage.setItem(EXAM_STORE_NAME, JSON.stringify(oldState))
      await useExamStore.persist.rehydrate()

      const state = useExamStore.getState()
      expect(state.answers).toBeInstanceOf(Map)
      expect(state.completedModules).toBeInstanceOf(Set)
      expect(state.answers.get('q1')).toBe('A')
      expect(state.completedModules.has('module-1')).toBe(true)
    })

    it('handles missing version field gracefully', async () => {
      const stateWithoutVersion = {
        state: {
          sessionId: 'no-version',
          currentSection: null,
          currentModule: null,
          currentQuestionIndex: 0,
          answers: {},
          completedModules: [],
        },
      }

      localStorage.setItem(EXAM_STORE_NAME, JSON.stringify(stateWithoutVersion))
      await useExamStore.persist.rehydrate()

      const state = useExamStore.getState()
      expect(state.sessionId).toBe('no-version')
    })

    it('uiStore migrates array to Set for lockedQuestions', async () => {
      const oldState = {
        version: 0,
        state: {
          isReviewModalOpen: false,
          isGatekeeperActive: true,
          lockedQuestions: ['q1', 'q2'],
          navigationHistory: [],
        },
      }

      localStorage.setItem(UI_STORE_NAME, JSON.stringify(oldState))
      await useUIStore.persist.rehydrate()

      const state = useUIStore.getState()
      expect(state.lockedQuestions).toBeInstanceOf(Set)
      expect(state.lockedQuestions.has('q1')).toBe(true)
    })
  })

  describe('Complete Exam Flow Persistence', () => {
    it('persists and restores complete exam session', async () => {
      const now = Date.now()

      // Simulate complete exam flow
      // 1. Start exam session
      useExamStore.getState().setSession({
        sessionId: 'flow-test',
        currentSection: 'reading',
        currentModule: 'reading-m1',
        currentQuestionIndex: 0,
      })

      // 2. Initialize timer
      useTimerStore.getState().initializeTimer(30, now)

      // 3. Answer questions
      useExamStore.getState().updateAnswer('q1', 'A')
      useExamStore.getState().updateAnswer('q2', 'B')
      useExamStore.getState().nextQuestion()
      useExamStore.getState().nextQuestion()

      // 4. Lock questions (gatekeeper)
      useUIStore.getState().lockQuestion('q3')
      useUIStore.getState().lockQuestion('q4')

      // 5. Record ability estimate
      useAbilityStore.getState().updateAbility('reading', 0.73)
      useAbilityStore.getState().recordRouting({
        section: 'reading',
        stage: 2,
        ability: 0.73,
        difficulty: 'medium',
      })

      // Wait for all stores to persist
      await new Promise((resolve) => setTimeout(resolve, 300))

      // Restore all stores (simulates app reload)
      await useExamStore.persist.rehydrate()
      await useTimerStore.persist.rehydrate()
      await useAbilityStore.persist.rehydrate()
      await useUIStore.persist.rehydrate()

      // Verify complete state restoration
      const examState = useExamStore.getState()
      expect(examState.sessionId).toBe('flow-test')
      expect(examState.currentSection).toBe('reading')
      expect(examState.currentQuestionIndex).toBe(2)
      expect(examState.answers.get('q1')).toBe('A')
      expect(examState.answers.get('q2')).toBe('B')

      const timerState = useTimerStore.getState()
      expect(timerState.remainingTime).toBe(1800)

      const abilityState = useAbilityStore.getState()
      expect(abilityState.abilityEstimates.reading).toBe(0.73)
      expect(abilityState.routingDecisions).toHaveLength(1)

      const uiState = useUIStore.getState()
      expect(uiState.lockedQuestions.has('q3')).toBe(true)
      expect(uiState.lockedQuestions.has('q4')).toBe(true)
    })
  })
})
