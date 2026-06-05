import { createJSONStorage, type StateStorage } from 'zustand/middleware'

type TaggedValue = {
  __type: 'Map' | 'Set'
  value: unknown
}

const isTaggedValue = (value: unknown): value is TaggedValue => {
  if (!value || typeof value !== 'object') {
    return false
  }

  return '__type' in value && 'value' in value
}

export const createStoreStorage = () => {
  const storageFactory = () => localStorage satisfies StateStorage

  return createJSONStorage(storageFactory, {
    replacer: (_key, value) => {
      if (value instanceof Map) {
        return {
          __type: 'Map',
          value: Array.from(value.entries()),
        }
      }

      if (value instanceof Set) {
        return {
          __type: 'Set',
          value: Array.from(value.values()),
        }
      }

      return value
    },
    reviver: (_key, value) => {
      if (!isTaggedValue(value)) {
        return value
      }

      if (value.__type === 'Map' && Array.isArray(value.value)) {
        return new Map(value.value as Iterable<readonly [string, unknown]>)
      }

      if (value.__type === 'Set' && Array.isArray(value.value)) {
        return new Set(value.value)
      }

      return value
    },
  })
}