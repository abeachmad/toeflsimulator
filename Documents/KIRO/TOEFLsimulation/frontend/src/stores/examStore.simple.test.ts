import { describe, it, expect, beforeEach } from 'vitest'
import { useExamStore, resetExamStore } from './examStore'

/**
 * Simple unit tests for examStore (Task 13.1)
 * Tests core functionality without complex localStorage interactions
 */
describe('examStore - Simple Unit Tests', () => {
  beforeEach(() => {
    resetExamStore()
  })

  it('should initialize with correct default state', () => {
    const state = useExamStore.getState()
    
    expect(state.sessionId).toBeNull()
    expect(state.currentSection).toBeNull()
    expect(state.currentModule).toBeNull()
    expect(state.currentQuestionIndex).toBe(0)
    expect(state.answers).toBeInstanceOf(Map)
    expect(state.completedModules).toBeInstanceOf(Set)
  })

  it('should set session with all parameters', () => {
    const { setSession } = useExamStore.getState()
    
    setSession({
      sessionId: 'test-session',
      currentSection: 'reading',
      currentModule: 'reading-m1',
      currentQuestionIndex: 5
    })
    
    const state = useExamStore.getState()
    expect(state.sessionId).toBe('test-session')
    expect(state.currentSection).toBe('reading')
    expect(state.currentModule).toBe('reading-m1')
    expect(state.currentQuestionIndex).toBe(5)
  })

  it('should update answers correctly', () => {
    const { updateAnswer } = useExamStore.getState()
    
    updateAnswer('q1', 'A')
    updateAnswer('q2', ['B', 'C'])
    updateAnswer('q3', 42)
    
    const state = useExamStore.getState()
    expect(state.answers.get('q1')).toBe('A')
    expect(state.answers.get('q2')).toEqual(['B', 'C'])
    expect(state.answers.get('q3')).toBe(42)
  })

  it('should navigate questions with nextQuestion and prevQuestion', () => {
    const { nextQuestion, prevQuestion } = useExamStore.getState()
    
    nextQuestion()
    expect(useExamStore.getState().currentQuestionIndex).toBe(1)
    
    nextQuestion()
    expect(useExamStore.getState().currentQuestionIndex).toBe(2)
    
    prevQuestion()
    expect(useExamStore.getState().currentQuestionIndex).toBe(1)
  })

  it('should respect boundaries in question navigation', () => {
    const { nextQuestion, prevQuestion } = useExamStore.getState()
    
    // Test lower boundary
    prevQuestion()
    expect(useExamStore.getState().currentQuestionIndex).toBe(0)
    
    // Test upper boundary with maxQuestions
    for (let i = 0; i < 20; i++) {
      nextQuestion(10)
    }
    expect(useExamStore.getState().currentQuestionIndex).toBe(9) // 0-indexed, max is 9 for 10 questions
  })

  it('should mark modules as completed', () => {
    const { setSession, submitModule, markModuleComplete } = useExamStore.getState()
    
    setSession({
      sessionId: 'test',
      currentModule: 'module-1'
    })
    
    submitModule()
    expect(useExamStore.getState().completedModules.has('module-1')).toBe(true)
    
    markModuleComplete('module-2')
    markModuleComplete('module-3')
    
    const state = useExamStore.getState()
    expect(state.completedModules.size).toBe(3)
    expect(state.completedModules.has('module-2')).toBe(true)
    expect(state.completedModules.has('module-3')).toBe(true)
  })

  it('should reset all state', () => {
    const { setSession, updateAnswer, markModuleComplete, reset } = useExamStore.getState()
    
    // Set up state
    setSession({
      sessionId: 'test',
      currentSection: 'reading',
      currentModule: 'module-1',
      currentQuestionIndex: 5
    })
    updateAnswer('q1', 'A')
    markModuleComplete('module-1')
    
    // Reset
    reset()
    
    // Verify all state is cleared
    const state = useExamStore.getState()
    expect(state.sessionId).toBeNull()
    expect(state.currentSection).toBeNull()
    expect(state.currentModule).toBeNull()
    expect(state.currentQuestionIndex).toBe(0)
    expect(state.answers.size).toBe(0)
    expect(state.completedModules.size).toBe(0)
  })
})
