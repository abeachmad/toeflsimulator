import {
  ABILITY_STORE_NAME,
  EXAM_STORE_NAME,
  resetAbilityStore,
  resetExamStore,
  resetTimerStore,
  resetUIStore,
  TIMER_STORE_NAME,
  UI_STORE_NAME,
  useAbilityStore,
  useExamStore,
  useTimerStore,
  useUIStore,
} from './index'

const rehydrateStores = async () => {
  await useExamStore.persist.rehydrate()
  await useTimerStore.persist.rehydrate()
  await useAbilityStore.persist.rehydrate()
  await useUIStore.persist.rehydrate()
}

describe('frontend stores', () => {
  beforeEach(async () => {
    localStorage.clear()
    resetExamStore()
    resetTimerStore()
    resetAbilityStore()
    resetUIStore()
    // Wait for stores to finish any pending persistence operations
    await new Promise((resolve) => setTimeout(resolve, 50))
  })

  it('updates exam state through store actions', () => {
    const examStore = useExamStore.getState()

    examStore.setSession({
      sessionId: 'session-1',
      currentSection: 'reading',
      currentModule: 'module-1',
    })
    examStore.updateAnswer('q-1', 'B')
    examStore.nextQuestion(5)
    examStore.submitModule()

    const state = useExamStore.getState()

    expect(state.sessionId).toBe('session-1')
    expect(state.currentSection).toBe('reading')
    expect(state.currentQuestionIndex).toBe(1)
    expect(state.answers.get('q-1')).toBe('B')
    expect(state.completedModules.has('module-1')).toBe(true)
  })

  it('persists and restores exam state with map and set values', async () => {
    useExamStore.getState().setSession({
      sessionId: 'session-2',
      currentSection: 'listening',
      currentModule: 'module-2',
      currentQuestionIndex: 3,
    })
    useExamStore.getState().updateAnswer('q-7', 'C')
    useExamStore.getState().markModuleComplete('module-2')

    // Wait for persistence debounce to complete (Zustand persist uses debounce)
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Verify data was persisted to localStorage
    const stored = localStorage.getItem(EXAM_STORE_NAME)
    expect(stored).toBeTruthy()
    
    // Parse to verify structure
    const parsed = JSON.parse(stored!)
    expect(parsed.state.sessionId).toBe('session-2')

    // Now simulate app restart by directly calling rehydrate
    // (rehydrate will merge the persisted state back into the store)
    await useExamStore.persist.rehydrate()

    const state = useExamStore.getState()

    expect(state.sessionId).toBe('session-2')
    expect(state.currentQuestionIndex).toBe(3)
    expect(state.answers.get('q-7')).toBe('C')
    expect(state.completedModules.has('module-2')).toBe(true)
  })

  it('migrates a legacy exam store payload to versioned persisted state', async () => {
    localStorage.setItem(
      EXAM_STORE_NAME,
      JSON.stringify({
        state: {
          sessionId: 'legacy-session',
          currentSection: 'writing',
          currentModule: 'module-3',
          currentQuestionIndex: 2,
          answers: { 'q-1': 'typed answer' },
          completedModules: ['module-1'],
        },
        version: 0,
      }),
    )

    await useExamStore.persist.rehydrate()

    const state = useExamStore.getState()

    expect(state.sessionId).toBe('legacy-session')
    expect(state.answers).toBeInstanceOf(Map)
    expect(state.answers.get('q-1')).toBe('typed answer')
    expect(state.completedModules).toBeInstanceOf(Set)
    expect(state.completedModules.has('module-1')).toBe(true)
  })

  it('tracks timer state and server drift', () => {
    vi.spyOn(Date, 'now').mockReturnValue(12_000)

    useTimerStore.getState().initializeTimer(1, 10_000)
    useTimerStore.getState().syncWithServer({
      serverTime: 1_000,
      expirationTime: 61_000,
    })
    useTimerStore.getState().tick(61_000)

    const state = useTimerStore.getState()

    expect(state.driftDetected).toBe(true)
    expect(state.isExpired).toBe(true)
    expect(state.remainingTime).toBe(0)
  })

  it('records ability estimates and routing decisions', async () => {
    const abilityStore = useAbilityStore.getState()
    abilityStore.updateAbility('reading', 0.73)
    abilityStore.setItemParameters('item-1', { a: 1.2, b: -0.4, c: 0.18 })
    abilityStore.recordRouting({
      section: 'reading',
      stage: 2,
      ability: 0.73,
      difficulty: 'medium',
      timestamp: 99,
    })

    // Wait for persistence debounce to complete
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Verify persistence occurred
    const stored = localStorage.getItem(ABILITY_STORE_NAME)
    expect(stored).toBeTruthy()

    await useAbilityStore.persist.rehydrate()

    const state = useAbilityStore.getState()

    expect(state.abilityEstimates.reading).toBe(0.73)
    expect(state.irtParameters['item-1']).toEqual({ a: 1.2, b: -0.4, c: 0.18 })
    expect(state.routingDecisions).toHaveLength(1)
  })

  it('locks and unlocks UI questions and restores persisted history', async () => {
    const uiStore = useUIStore.getState()
    uiStore.openReviewModal()
    uiStore.setGatekeeperActive(true)
    uiStore.lockQuestion('q-2')
    uiStore.recordNavigation('/exam/section/reading')
    uiStore.recordNavigation('/exam/review')

    // Wait for persistence debounce to complete
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Verify persistence occurred
    const stored = localStorage.getItem(UI_STORE_NAME)
    expect(stored).toBeTruthy()

    await useUIStore.persist.rehydrate()

    const state = useUIStore.getState()

    expect(state.isReviewModalOpen).toBe(true)
    expect(state.isGatekeeperActive).toBe(true)
    expect(state.lockedQuestions.has('q-2')).toBe(true)
    expect(state.navigationHistory).toEqual([
      '/exam/section/reading',
      '/exam/review',
    ])

    state.unlockQuestion('q-2')
    state.closeReviewModal()

    expect(useUIStore.getState().lockedQuestions.has('q-2')).toBe(false)
    expect(useUIStore.getState().isReviewModalOpen).toBe(false)
  })

  it('writes persisted payloads for each store', async () => {
    useExamStore.getState().setSession({ sessionId: 'persist-check' })
    useTimerStore.getState().initializeTimer(30, 0)
    useAbilityStore.getState().updateAbility('speaking', -0.2)
    useUIStore.getState().recordNavigation('/exam/start')

    await rehydrateStores()

    expect(localStorage.getItem(EXAM_STORE_NAME)).toContain('persist-check')
    expect(localStorage.getItem(TIMER_STORE_NAME)).toContain('expirationTime')
    expect(localStorage.getItem(ABILITY_STORE_NAME)).toContain('speaking')
    expect(localStorage.getItem(UI_STORE_NAME)).toContain('/exam/start')
  })
})