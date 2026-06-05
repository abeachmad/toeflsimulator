import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore, resetUIStore } from './uiStore'

/**
 * Validation test for Task 13.4: Create `uiStore` for UI state
 * 
 * Requirements:
 * - State: isReviewModalOpen, isGatekeeperActive, lockedQuestions (Set), navigationHistory
 * - Actions: openReviewModal, closeReviewModal, lockQuestion, unlockQuestion, unlockAllQuestions
 * - Requirements: 11.1, 11.3, 12.1
 */
describe('uiStore - Task 13.4 Validation', () => {
  beforeEach(() => {
    localStorage.clear()
    resetUIStore()
  })

  describe('State Properties', () => {
    it('has isReviewModalOpen state property', () => {
      const state = useUIStore.getState()
      expect(state).toHaveProperty('isReviewModalOpen')
      expect(typeof state.isReviewModalOpen).toBe('boolean')
      expect(state.isReviewModalOpen).toBe(false) // Initial state
    })

    it('has isGatekeeperActive state property', () => {
      const state = useUIStore.getState()
      expect(state).toHaveProperty('isGatekeeperActive')
      expect(typeof state.isGatekeeperActive).toBe('boolean')
      expect(state.isGatekeeperActive).toBe(false) // Initial state
    })

    it('has lockedQuestions state property as Set', () => {
      const state = useUIStore.getState()
      expect(state).toHaveProperty('lockedQuestions')
      expect(state.lockedQuestions).toBeInstanceOf(Set)
      expect(state.lockedQuestions.size).toBe(0) // Initial state
    })

    it('has navigationHistory state property as array', () => {
      const state = useUIStore.getState()
      expect(state).toHaveProperty('navigationHistory')
      expect(Array.isArray(state.navigationHistory)).toBe(true)
      expect(state.navigationHistory.length).toBe(0) // Initial state
    })
  })

  describe('Action Methods', () => {
    it('has openReviewModal action', () => {
      const state = useUIStore.getState()
      expect(typeof state.openReviewModal).toBe('function')
    })

    it('has closeReviewModal action', () => {
      const state = useUIStore.getState()
      expect(typeof state.closeReviewModal).toBe('function')
    })

    it('has lockQuestion action', () => {
      const state = useUIStore.getState()
      expect(typeof state.lockQuestion).toBe('function')
    })

    it('has unlockQuestion action', () => {
      const state = useUIStore.getState()
      expect(typeof state.unlockQuestion).toBe('function')
    })

    it('has unlockAllQuestions action', () => {
      const state = useUIStore.getState()
      expect(typeof state.unlockAllQuestions).toBe('function')
    })
  })

  describe('Review Modal Actions - Requirement 12.1', () => {
    it('opens review modal when openReviewModal is called', () => {
      const store = useUIStore.getState()
      
      expect(store.isReviewModalOpen).toBe(false)
      
      store.openReviewModal()
      
      expect(useUIStore.getState().isReviewModalOpen).toBe(true)
    })

    it('closes review modal when closeReviewModal is called', () => {
      const store = useUIStore.getState()
      
      store.openReviewModal()
      expect(useUIStore.getState().isReviewModalOpen).toBe(true)
      
      store.closeReviewModal()
      
      expect(useUIStore.getState().isReviewModalOpen).toBe(false)
    })
  })

  describe('Gatekeeper Actions - Requirement 11.1, 11.3', () => {
    it('locks a question when lockQuestion is called', () => {
      const store = useUIStore.getState()
      
      expect(store.lockedQuestions.has('q-1')).toBe(false)
      
      store.lockQuestion('q-1')
      
      const updatedState = useUIStore.getState()
      expect(updatedState.lockedQuestions.has('q-1')).toBe(true)
    })

    it('locks multiple questions', () => {
      const store = useUIStore.getState()
      
      store.lockQuestion('q-1')
      store.lockQuestion('q-2')
      store.lockQuestion('q-3')
      
      const state = useUIStore.getState()
      expect(state.lockedQuestions.size).toBe(3)
      expect(state.lockedQuestions.has('q-1')).toBe(true)
      expect(state.lockedQuestions.has('q-2')).toBe(true)
      expect(state.lockedQuestions.has('q-3')).toBe(true)
    })

    it('unlocks a question when unlockQuestion is called', () => {
      const store = useUIStore.getState()
      
      store.lockQuestion('q-1')
      expect(useUIStore.getState().lockedQuestions.has('q-1')).toBe(true)
      
      store.unlockQuestion('q-1')
      
      expect(useUIStore.getState().lockedQuestions.has('q-1')).toBe(false)
    })

    it('unlocks all questions when unlockAllQuestions is called', () => {
      const store = useUIStore.getState()
      
      store.lockQuestion('q-1')
      store.lockQuestion('q-2')
      store.lockQuestion('q-3')
      
      expect(useUIStore.getState().lockedQuestions.size).toBe(3)
      
      store.unlockAllQuestions()
      
      const state = useUIStore.getState()
      expect(state.lockedQuestions.size).toBe(0)
    })
  })

  describe('Navigation History', () => {
    it('records navigation history', () => {
      const store = useUIStore.getState()
      
      store.recordNavigation('/exam/reading')
      store.recordNavigation('/exam/listening')
      store.recordNavigation('/exam/review')
      
      const state = useUIStore.getState()
      expect(state.navigationHistory).toEqual([
        '/exam/reading',
        '/exam/listening',
        '/exam/review',
      ])
    })
  })

  describe('State Persistence', () => {
    it('persists and restores uiStore state', async () => {
      const store = useUIStore.getState()
      
      // Set up state
      store.openReviewModal()
      store.setGatekeeperActive(true)
      store.lockQuestion('q-1')
      store.lockQuestion('q-2')
      store.recordNavigation('/exam/reading')
      
      // Reset and rehydrate
      resetUIStore()
      await useUIStore.persist.rehydrate()
      
      // Verify state was restored
      const restoredState = useUIStore.getState()
      expect(restoredState.isReviewModalOpen).toBe(true)
      expect(restoredState.isGatekeeperActive).toBe(true)
      expect(restoredState.lockedQuestions.has('q-1')).toBe(true)
      expect(restoredState.lockedQuestions.has('q-2')).toBe(true)
      expect(restoredState.navigationHistory).toEqual(['/exam/reading'])
    })
  })

  describe('Integration - Complete Workflow', () => {
    it('supports complete gatekeeper and review modal workflow', () => {
      const store = useUIStore.getState()
      
      // 1. Lock questions for reading passage (Requirement 11.1)
      store.lockQuestion('q-1')
      store.lockQuestion('q-2')
      store.lockQuestion('q-3')
      
      expect(useUIStore.getState().lockedQuestions.size).toBe(3)
      
      // 2. User scrolls to bottom and questions unlock (Requirement 11.3)
      store.unlockQuestion('q-1')
      store.unlockQuestion('q-2')
      store.unlockQuestion('q-3')
      
      expect(useUIStore.getState().lockedQuestions.size).toBe(0)
      
      // 3. User opens review modal (Requirement 12.1)
      store.openReviewModal()
      
      expect(useUIStore.getState().isReviewModalOpen).toBe(true)
      
      // 4. User navigates and closes modal
      store.recordNavigation('/exam/review')
      store.closeReviewModal()
      
      const finalState = useUIStore.getState()
      expect(finalState.isReviewModalOpen).toBe(false)
      expect(finalState.navigationHistory).toEqual(['/exam/review'])
    })
  })
})
