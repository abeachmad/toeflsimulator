import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createStoreStorage } from './persist'

type UIStoreState = {
  isReviewModalOpen: boolean
  isGatekeeperActive: boolean
  lockedQuestions: Set<string>
  navigationHistory: string[]
}

type UIStoreActions = {
  openReviewModal: () => void
  closeReviewModal: () => void
  setGatekeeperActive: (isActive: boolean) => void
  lockQuestion: (questionId: string) => void
  unlockQuestion: (questionId: string) => void
  unlockAllQuestions: () => void
  recordNavigation: (route: string) => void
  reset: () => void
}

export type UIStore = UIStoreState & UIStoreActions

export const UI_STORE_NAME = 'toefl-ui-store'

const createInitialState = (): UIStoreState => ({
  isReviewModalOpen: false,
  isGatekeeperActive: false,
  lockedQuestions: new Set(),
  navigationHistory: [],
})

const migrateUIStore = (persistedState: unknown): Partial<UIStoreState> => {
  if (!persistedState || typeof persistedState !== 'object') {
    return createInitialState()
  }

  const candidate = persistedState as Partial<UIStoreState> & {
    lockedQuestions?: Set<string> | string[]
  }

  return {
    isReviewModalOpen: candidate.isReviewModalOpen ?? false,
    isGatekeeperActive: candidate.isGatekeeperActive ?? false,
    lockedQuestions:
      candidate.lockedQuestions instanceof Set
        ? candidate.lockedQuestions
        : new Set(candidate.lockedQuestions ?? []),
    navigationHistory: candidate.navigationHistory ?? [],
  }
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      ...createInitialState(),
      openReviewModal: () => set({ isReviewModalOpen: true }),
      closeReviewModal: () => set({ isReviewModalOpen: false }),
      setGatekeeperActive: (isGatekeeperActive) => set({ isGatekeeperActive }),
      lockQuestion: (questionId) => {
        set((state) => ({
          lockedQuestions: new Set([...state.lockedQuestions, questionId]),
        }))
      },
      unlockQuestion: (questionId) => {
        set((state) => {
          const lockedQuestions = new Set(state.lockedQuestions)
          lockedQuestions.delete(questionId)

          return { lockedQuestions }
        })
      },
      unlockAllQuestions: () => set({ lockedQuestions: new Set() }),
      recordNavigation: (route) => {
        set((state) => ({
          navigationHistory: [...state.navigationHistory, route],
        }))
      },
      reset: () => {
        set(createInitialState())
      },
    }),
    {
      name: UI_STORE_NAME,
      version: 1,
      storage: createStoreStorage(),
      migrate: (persistedState) => migrateUIStore(persistedState),
    },
  ),
)

/**
 * Reset the UI store for testing.
 * Saves localStorage state before reset so rehydration tests can restore it.
 */
export const resetUIStore = () => {
  const saved = localStorage.getItem(UI_STORE_NAME)
  useUIStore.getState().reset()
  // Restore pre-reset localStorage so persist.rehydrate() tests work
  if (saved !== null) {
    localStorage.setItem(UI_STORE_NAME, saved)
  }
}