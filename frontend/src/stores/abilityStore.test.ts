import { describe, it, expect, beforeEach } from 'vitest'
import { useAbilityStore, resetAbilityStore, AbilitySection } from './abilityStore'

/**
 * Test suite for abilityStore implementation
 * Task 13.3: Create abilityStore for IRT parameters
 * Requirements: 3.4 (Reading Section ability estimation), 8.1 (Adaptive routing ability estimates)
 */
describe('abilityStore', () => {
  beforeEach(() => {
    resetAbilityStore()
  })

  describe('State: abilityEstimates (by section)', () => {
    it('should initialize with empty abilityEstimates', () => {
      const state = useAbilityStore.getState()
      expect(state.abilityEstimates).toEqual({})
    })

    it('should store ability estimate for a single section', () => {
      const { updateAbility } = useAbilityStore.getState()
      
      updateAbility('reading', 0.5)
      
      const state = useAbilityStore.getState()
      expect(state.abilityEstimates.reading).toBe(0.5)
    })

    it('should store ability estimates for multiple sections independently', () => {
      const { updateAbility } = useAbilityStore.getState()
      
      updateAbility('reading', 0.73)
      updateAbility('listening', -0.2)
      updateAbility('writing', 1.1)
      updateAbility('speaking', -0.9)
      
      const state = useAbilityStore.getState()
      expect(state.abilityEstimates.reading).toBe(0.73)
      expect(state.abilityEstimates.listening).toBe(-0.2)
      expect(state.abilityEstimates.writing).toBe(1.1)
      expect(state.abilityEstimates.speaking).toBe(-0.9)
    })

    it('should update existing ability estimate for a section', () => {
      const { updateAbility } = useAbilityStore.getState()
      
      updateAbility('reading', 0.5)
      updateAbility('reading', 0.85)
      
      const state = useAbilityStore.getState()
      expect(state.abilityEstimates.reading).toBe(0.85)
    })
  })

  describe('State: irtParameters (by item)', () => {
    it('should initialize with empty irtParameters', () => {
      const state = useAbilityStore.getState()
      expect(state.irtParameters).toEqual({})
    })

    it('should store IRT parameters for a single item', () => {
      const { setItemParameters } = useAbilityStore.getState()
      
      setItemParameters('item-1', { a: 1.2, b: -0.4, c: 0.18 })
      
      const state = useAbilityStore.getState()
      expect(state.irtParameters['item-1']).toEqual({ a: 1.2, b: -0.4, c: 0.18 })
    })

    it('should store IRT parameters for multiple items', () => {
      const { setItemParameters } = useAbilityStore.getState()
      
      setItemParameters('item-1', { a: 1.2, b: -0.4, c: 0.18 })
      setItemParameters('item-2', { a: 0.9, b: 0.3, c: 0.25 })
      setItemParameters('item-3', { a: 1.5, b: 1.1, c: 0.2 })
      
      const state = useAbilityStore.getState()
      expect(state.irtParameters['item-1']).toEqual({ a: 1.2, b: -0.4, c: 0.18 })
      expect(state.irtParameters['item-2']).toEqual({ a: 0.9, b: 0.3, c: 0.25 })
      expect(state.irtParameters['item-3']).toEqual({ a: 1.5, b: 1.1, c: 0.2 })
    })

    it('should update existing IRT parameters for an item', () => {
      const { setItemParameters } = useAbilityStore.getState()
      
      setItemParameters('item-1', { a: 1.0, b: 0.0, c: 0.2 })
      setItemParameters('item-1', { a: 1.5, b: -0.5, c: 0.25 })
      
      const state = useAbilityStore.getState()
      expect(state.irtParameters['item-1']).toEqual({ a: 1.5, b: -0.5, c: 0.25 })
    })
  })

  describe('State: routingDecisions', () => {
    it('should initialize with empty routingDecisions array', () => {
      const state = useAbilityStore.getState()
      expect(state.routingDecisions).toEqual([])
    })

    it('should record a single routing decision', () => {
      const { recordRouting } = useAbilityStore.getState()
      
      recordRouting({
        section: 'reading',
        stage: 2,
        ability: 0.73,
        difficulty: 'medium',
      })
      
      const state = useAbilityStore.getState()
      expect(state.routingDecisions).toHaveLength(1)
      expect(state.routingDecisions[0]).toMatchObject({
        section: 'reading',
        stage: 2,
        ability: 0.73,
        difficulty: 'medium',
      })
      expect(state.routingDecisions[0].timestamp).toBeTypeOf('number')
    })

    it('should record multiple routing decisions in order', () => {
      const { recordRouting } = useAbilityStore.getState()
      
      recordRouting({
        section: 'reading',
        stage: 1,
        ability: 0.0,
        difficulty: 'medium',
        timestamp: 1000,
      })
      
      recordRouting({
        section: 'reading',
        stage: 2,
        ability: 0.73,
        difficulty: 'hard',
        timestamp: 2000,
      })
      
      recordRouting({
        section: 'listening',
        stage: 1,
        ability: 0.0,
        difficulty: 'medium',
        timestamp: 3000,
      })
      
      const state = useAbilityStore.getState()
      expect(state.routingDecisions).toHaveLength(3)
      expect(state.routingDecisions[0].section).toBe('reading')
      expect(state.routingDecisions[0].stage).toBe(1)
      expect(state.routingDecisions[1].section).toBe('reading')
      expect(state.routingDecisions[1].stage).toBe(2)
      expect(state.routingDecisions[2].section).toBe('listening')
    })

    it('should auto-generate timestamp if not provided', () => {
      const { recordRouting } = useAbilityStore.getState()
      const beforeTime = Date.now()
      
      recordRouting({
        section: 'writing',
        stage: 1,
        ability: -0.2,
        difficulty: 'medium',
      })
      
      const afterTime = Date.now()
      const state = useAbilityStore.getState()
      
      expect(state.routingDecisions[0].timestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(state.routingDecisions[0].timestamp).toBeLessThanOrEqual(afterTime)
    })

    it('should use provided timestamp if given', () => {
      const { recordRouting } = useAbilityStore.getState()
      
      recordRouting({
        section: 'speaking',
        stage: 1,
        ability: 0.1,
        difficulty: 'medium',
        timestamp: 99999,
      })
      
      const state = useAbilityStore.getState()
      expect(state.routingDecisions[0].timestamp).toBe(99999)
    })
  })

  describe('Action: updateAbility', () => {
    it('should update ability for reading section (Requirement 3.4)', () => {
      const { updateAbility } = useAbilityStore.getState()
      
      // Simulate Stage 1 completion with medium ability
      updateAbility('reading', 0.5)
      
      expect(useAbilityStore.getState().abilityEstimates.reading).toBe(0.5)
    })

    it('should handle routing threshold scenarios (Requirement 8.1)', () => {
      const { updateAbility } = useAbilityStore.getState()
      
      // Easy tier: θ < -0.8
      updateAbility('reading', -1.0)
      expect(useAbilityStore.getState().abilityEstimates.reading).toBe(-1.0)
      
      // Medium tier: -0.8 ≤ θ ≤ 0.8
      updateAbility('listening', 0.0)
      expect(useAbilityStore.getState().abilityEstimates.listening).toBe(0.0)
      
      // Hard tier: θ > 0.8
      updateAbility('writing', 1.2)
      expect(useAbilityStore.getState().abilityEstimates.writing).toBe(1.2)
    })

    it('should handle extreme ability values', () => {
      const { updateAbility } = useAbilityStore.getState()
      
      updateAbility('reading', -3.0)
      updateAbility('listening', 3.0)
      
      const state = useAbilityStore.getState()
      expect(state.abilityEstimates.reading).toBe(-3.0)
      expect(state.abilityEstimates.listening).toBe(3.0)
    })
  })

  describe('Action: recordRouting', () => {
    it('should record routing decision with all required fields (Requirement 8.1)', () => {
      const { recordRouting } = useAbilityStore.getState()
      
      recordRouting({
        section: 'reading',
        stage: 2,
        ability: 0.73,
        difficulty: 'medium',
      })
      
      const state = useAbilityStore.getState()
      const decision = state.routingDecisions[0]
      
      expect(decision).toHaveProperty('section')
      expect(decision).toHaveProperty('stage')
      expect(decision).toHaveProperty('ability')
      expect(decision).toHaveProperty('difficulty')
      expect(decision).toHaveProperty('timestamp')
    })

    it('should record adaptive routing for all difficulty tiers', () => {
      const { recordRouting } = useAbilityStore.getState()
      
      // Easy routing: θ < -0.8
      recordRouting({
        section: 'reading',
        stage: 2,
        ability: -1.0,
        difficulty: 'easy',
      })
      
      // Medium routing: -0.8 ≤ θ ≤ 0.8
      recordRouting({
        section: 'listening',
        stage: 2,
        ability: 0.3,
        difficulty: 'medium',
      })
      
      // Hard routing: θ > 0.8
      recordRouting({
        section: 'writing',
        stage: 2,
        ability: 1.5,
        difficulty: 'hard',
      })
      
      const state = useAbilityStore.getState()
      expect(state.routingDecisions).toHaveLength(3)
      expect(state.routingDecisions[0].difficulty).toBe('easy')
      expect(state.routingDecisions[1].difficulty).toBe('medium')
      expect(state.routingDecisions[2].difficulty).toBe('hard')
    })
  })

  describe('Persistence and Reset', () => {
    it('should reset all state to initial values', () => {
      const { updateAbility, setItemParameters, recordRouting } = useAbilityStore.getState()
      
      // Populate state
      updateAbility('reading', 0.5)
      setItemParameters('item-1', { a: 1.0, b: 0.0, c: 0.2 })
      recordRouting({
        section: 'reading',
        stage: 2,
        ability: 0.5,
        difficulty: 'medium',
      })
      
      // Reset
      resetAbilityStore()
      
      const state = useAbilityStore.getState()
      expect(state.abilityEstimates).toEqual({})
      expect(state.irtParameters).toEqual({})
      expect(state.routingDecisions).toEqual([])
    })

    it('should maintain state integrity across multiple operations', () => {
      const { updateAbility, setItemParameters, recordRouting } = useAbilityStore.getState()
      
      // Simulate complete exam flow
      updateAbility('reading', 0.0) // Stage 1 start
      setItemParameters('item-1', { a: 1.2, b: -0.4, c: 0.18 })
      setItemParameters('item-2', { a: 0.9, b: 0.3, c: 0.25 })
      
      updateAbility('reading', 0.73) // Stage 1 end
      recordRouting({
        section: 'reading',
        stage: 2,
        ability: 0.73,
        difficulty: 'medium',
      })
      
      const state = useAbilityStore.getState()
      expect(state.abilityEstimates.reading).toBe(0.73)
      expect(Object.keys(state.irtParameters)).toHaveLength(2)
      expect(state.routingDecisions).toHaveLength(1)
    })
  })

  describe('Integration with Requirements', () => {
    it('should support Requirement 3.4: Reading section ability calculation', () => {
      const { updateAbility, setItemParameters } = useAbilityStore.getState()
      
      // Store item parameters for reading items
      setItemParameters('reading-item-1', { a: 1.2, b: -0.4, c: 0.18 })
      setItemParameters('reading-item-2', { a: 1.0, b: 0.2, c: 0.20 })
      
      // Update ability after Stage 1
      updateAbility('reading', 0.5)
      
      const state = useAbilityStore.getState()
      expect(state.abilityEstimates.reading).toBeDefined()
      expect(state.irtParameters['reading-item-1']).toBeDefined()
    })

    it('should support Requirement 8.1: Adaptive routing based on ability thresholds', () => {
      const { updateAbility, recordRouting } = useAbilityStore.getState()
      
      // Scenario 1: θ < -0.8 → Easy
      updateAbility('reading', -1.0)
      recordRouting({
        section: 'reading',
        stage: 2,
        ability: -1.0,
        difficulty: 'easy',
      })
      
      // Scenario 2: -0.8 ≤ θ ≤ 0.8 → Medium
      updateAbility('listening', 0.3)
      recordRouting({
        section: 'listening',
        stage: 2,
        ability: 0.3,
        difficulty: 'medium',
      })
      
      // Scenario 3: θ > 0.8 → Hard
      updateAbility('writing', 1.2)
      recordRouting({
        section: 'writing',
        stage: 2,
        ability: 1.2,
        difficulty: 'hard',
      })
      
      const state = useAbilityStore.getState()
      expect(state.routingDecisions).toHaveLength(3)
      expect(state.routingDecisions[0].difficulty).toBe('easy')
      expect(state.routingDecisions[1].difficulty).toBe('medium')
      expect(state.routingDecisions[2].difficulty).toBe('hard')
    })
  })

  describe('Edge Cases', () => {
    it('should handle ability at exact threshold boundaries', () => {
      const { updateAbility } = useAbilityStore.getState()
      
      updateAbility('reading', -0.8) // Exactly at easy/medium boundary
      updateAbility('listening', 0.8) // Exactly at medium/hard boundary
      
      const state = useAbilityStore.getState()
      expect(state.abilityEstimates.reading).toBe(-0.8)
      expect(state.abilityEstimates.listening).toBe(0.8)
    })

    it('should handle zero ability estimate', () => {
      const { updateAbility } = useAbilityStore.getState()
      
      updateAbility('reading', 0.0)
      
      expect(useAbilityStore.getState().abilityEstimates.reading).toBe(0.0)
    })

    it('should handle all four sections', () => {
      const { updateAbility } = useAbilityStore.getState()
      
      const sections: AbilitySection[] = ['reading', 'listening', 'writing', 'speaking']
      sections.forEach((section, index) => {
        updateAbility(section, index * 0.5)
      })
      
      const state = useAbilityStore.getState()
      expect(Object.keys(state.abilityEstimates)).toHaveLength(4)
    })
  })
})
