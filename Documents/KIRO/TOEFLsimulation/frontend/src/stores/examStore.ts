import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createStoreStorage } from './persist'

export type ExamAnswer = string | string[] | number | null

export type ExamSection =
  | 'reading'
  | 'listening'
  | 'speaking'
  | 'writing'
  | null

export type SectionScore = {
  cefrBand: number
  scaleScore: number
  feedback?: string
  details?: Record<string, unknown>
}

type ExamStoreState = {
  sessionId: string | null
  currentSection: ExamSection
  currentModule: string | null
  currentQuestionIndex: number
  answers: Map<string, ExamAnswer>
  sectionScores: Partial<Record<NonNullable<ExamSection>, SectionScore>>
  completedModules: Set<string>
}

type ExamStoreActions = {
  setSession: (payload: {
    sessionId: string
    currentSection?: ExamSection
    currentModule?: string | null
    currentQuestionIndex?: number
  }) => void
  setCurrentSection: (section: ExamSection) => void
  setCurrentModule: (moduleId: string | null) => void
  goToQuestion: (index: number) => void
  updateAnswer: (questionId: string, answer: ExamAnswer) => void
  nextQuestion: (maxQuestions?: number) => void
  prevQuestion: () => void
  submitModule: () => void
  markModuleComplete: (moduleId: string) => void
  setSectionScore: (section: NonNullable<ExamSection>, score: SectionScore) => void
  reset: () => void
}

export type ExamStore = ExamStoreState & ExamStoreActions

export const EXAM_STORE_VERSION = 1
export const EXAM_STORE_NAME = 'toefl-exam-store'

const createInitialState = (): ExamStoreState => ({
  sessionId: null,
  currentSection: null,
  currentModule: null,
  currentQuestionIndex: 0,
  answers: new Map(),
  completedModules: new Set(),
  sectionScores: {},
})

const migrateExamStore = (persistedState: unknown): Partial<ExamStoreState> => {
  if (!persistedState || typeof persistedState !== 'object') {
    return createInitialState()
  }

  const candidate = persistedState as Partial<ExamStoreState> & {
    answers?: Map<string, ExamAnswer> | Record<string, ExamAnswer>
    completedModules?: Set<string> | string[]
  }

  return {
    sessionId: candidate.sessionId ?? null,
    currentSection: candidate.currentSection ?? null,
    currentModule: candidate.currentModule ?? null,
    currentQuestionIndex: candidate.currentQuestionIndex ?? 0,
    answers:
      candidate.answers instanceof Map
        ? candidate.answers
        : new Map(Object.entries(candidate.answers ?? {})),
    completedModules:
      candidate.completedModules instanceof Set
        ? candidate.completedModules
        : new Set(candidate.completedModules ?? []),
    sectionScores: (candidate as ExamStoreState).sectionScores ?? {},
  }
}

export const useExamStore = create<ExamStore>()(
  persist(
    (set, get) => ({
      ...createInitialState(),
      setSession: ({
        sessionId,
        currentSection,
        currentModule,
        currentQuestionIndex,
      }) => {
        set({
          sessionId,
          currentSection: currentSection ?? null,
          currentModule: currentModule ?? null,
          currentQuestionIndex: currentQuestionIndex ?? 0,
        })
      },
      setCurrentSection: (currentSection) => set({ currentSection }),
      setCurrentModule: (currentModule) => set({ currentModule }),
      goToQuestion: (index) => {
        set({ currentQuestionIndex: Math.max(0, index) })
      },
      updateAnswer: (questionId, answer) => {
        const answers = new Map(get().answers)
        answers.set(questionId, answer)
        set({ answers })
      },
      nextQuestion: (maxQuestions) => {
        const nextIndex = get().currentQuestionIndex + 1
        const boundedIndex =
          typeof maxQuestions === 'number'
            ? Math.min(nextIndex, Math.max(0, maxQuestions - 1))
            : nextIndex

        set({ currentQuestionIndex: boundedIndex })
      },
      prevQuestion: () => {
        set((state) => ({
          currentQuestionIndex: Math.max(0, state.currentQuestionIndex - 1),
        }))
      },
      submitModule: () => {
        const { currentModule } = get()

        if (!currentModule) {
          return
        }

        const completedModules = new Set(get().completedModules)
        completedModules.add(currentModule)
        set({ completedModules })
      },
      markModuleComplete: (moduleId) => {
        const completedModules = new Set(get().completedModules)
        completedModules.add(moduleId)
        set({ completedModules })
      },
      setSectionScore: (section, score) => {
        set((state) => ({
          sectionScores: { ...state.sectionScores, [section]: score },
        }))
      },
      reset: () => {
        set(createInitialState())
      },
    }),
    {
      name: EXAM_STORE_NAME,
      version: EXAM_STORE_VERSION,
      storage: createStoreStorage(),
      migrate: (persistedState) => migrateExamStore(persistedState),
    },
  ),
)

/**
 * Reset the exam store for testing.
 * Saves localStorage state before reset so rehydration tests can restore it.
 */
export const resetExamStore = () => {
  const saved = localStorage.getItem(EXAM_STORE_NAME)
  useExamStore.getState().reset()
  // Restore pre-reset localStorage so persist.rehydrate() tests work
  if (saved !== null) {
    localStorage.setItem(EXAM_STORE_NAME, saved)
  }
}