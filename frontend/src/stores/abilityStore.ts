import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createStoreStorage } from './persist'

export type AbilitySection = 'reading' | 'listening' | 'speaking' | 'writing'

export type IRTParameters = {
  a: number
  b: number
  c: number
}

export type RoutingDecision = {
  section: AbilitySection
  stage: number
  ability: number
  difficulty: 'easy' | 'medium' | 'hard'
  timestamp: number
}

type AbilityStoreState = {
  abilityEstimates: Partial<Record<AbilitySection, number>>
  irtParameters: Record<string, IRTParameters>
  routingDecisions: RoutingDecision[]
}

type AbilityStoreActions = {
  updateAbility: (section: AbilitySection, theta: number) => void
  setItemParameters: (itemId: string, parameters: IRTParameters) => void
  recordRouting: (
    decision: Omit<RoutingDecision, 'timestamp'> & { timestamp?: number },
  ) => void
  reset: () => void
}

export type AbilityStore = AbilityStoreState & AbilityStoreActions

export const ABILITY_STORE_NAME = 'toefl-ability-store'

const createInitialState = (): AbilityStoreState => ({
  abilityEstimates: {},
  irtParameters: {},
  routingDecisions: [],
})

export const useAbilityStore = create<AbilityStore>()(
  persist(
    (set) => ({
      ...createInitialState(),
      updateAbility: (section, theta) => {
        set((state) => ({
          abilityEstimates: {
            ...state.abilityEstimates,
            [section]: theta,
          },
        }))
      },
      setItemParameters: (itemId, parameters) => {
        set((state) => ({
          irtParameters: {
            ...state.irtParameters,
            [itemId]: parameters,
          },
        }))
      },
      recordRouting: ({ timestamp = Date.now(), ...decision }) => {
        set((state) => ({
          routingDecisions: [...state.routingDecisions, { ...decision, timestamp }],
        }))
      },
      reset: () => {
        set(createInitialState())
      },
    }),
    {
      name: ABILITY_STORE_NAME,
      version: 1,
      storage: createStoreStorage(),
    },
  ),
)

export const resetAbilityStore = () => {
  useAbilityStore.getState().reset()
}