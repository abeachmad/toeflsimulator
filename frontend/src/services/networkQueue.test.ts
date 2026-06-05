import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'

// ---- IndexedDB synchronous mock ----
// Set up before any imports trigger module code
const fakeStore: Map<string, unknown> = new Map()

function makeObjectStore() {
  return {
    put: vi.fn((item: { id: string }) => {
      fakeStore.set(item.id, structuredClone(item))
      const req = { onsuccess: null as null | (() => void) }
      queueMicrotask(() => req.onsuccess?.())
      return req
    }),
    getAll: vi.fn(() => {
      const req = {
        result: [...fakeStore.values()],
        onsuccess: null as null | (() => void),
      }
      queueMicrotask(() => req.onsuccess?.())
      return req
    }),
    delete: vi.fn((id: string) => {
      fakeStore.delete(id)
      const req = { onsuccess: null as null | (() => void) }
      queueMicrotask(() => req.onsuccess?.())
      return req
    }),
  }
}

const fakeTransaction = { objectStore: vi.fn(() => makeObjectStore()) }

vi.stubGlobal('indexedDB', {
  open: vi.fn(() => {
    const db = {
      transaction: vi.fn(() => fakeTransaction),
      createObjectStore: vi.fn(),
    }
    const req = {
      onupgradeneeded: null as null | (() => void),
      onsuccess: null as null | (() => void),
      onerror: null as null | (() => void),
      result: db,
    }
    queueMicrotask(() => req.onsuccess?.())
    return req
  }),
})

// Import AFTER stubbing globals
import { enqueueRequest, replayQueue } from './networkQueue'

describe('networkQueue', () => {
  beforeAll(() => {
    fakeStore.clear()
  })

  afterEach(() => {
    fakeStore.clear()
    vi.clearAllMocks()
  })

  it('enqueueRequest stores item in IndexedDB', async () => {
    await enqueueRequest('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    })

    // Give microtasks time to flush
    await new Promise((r) => setTimeout(r, 20))

    expect(fakeStore.size).toBe(1)
    const [item] = fakeStore.values() as IterableIterator<{ url: string; method: string }>
    expect(item.url).toBe('/api/sessions')
    expect(item.method).toBe('POST')
  }, 10000)

  it('replayQueue calls fetch for queued items', async () => {
    fakeStore.set('test-id', {
      id: 'test-id',
      url: '/api/sessions',
      method: 'POST',
      headers: {},
      body: '{}',
      enqueuedAt: Date.now(),
      retryCount: 0,
    })

    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)

    await replayQueue()
    await new Promise((r) => setTimeout(r, 20))

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sessions',
      expect.objectContaining({ method: 'POST' }),
    )
  }, 10000)

  it('retryCount increments when request fails', async () => {
    fakeStore.set('retry-id', {
      id: 'retry-id',
      url: '/api/sessions',
      method: 'POST',
      headers: {},
      body: '{}',
      enqueuedAt: Date.now(),
      retryCount: 0,
    })

    const mockFetch = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', mockFetch)

    await replayQueue()
    await new Promise((r) => setTimeout(r, 20))

    const updated = fakeStore.get('retry-id') as { retryCount: number } | undefined
    expect(updated?.retryCount).toBe(1)
  }, 10000)

  it('removes request after MAX_RETRIES (5) exceeded', async () => {
    fakeStore.set('max-id', {
      id: 'max-id',
      url: '/api/sessions',
      method: 'POST',
      headers: {},
      body: '{}',
      enqueuedAt: Date.now(),
      retryCount: 5,
    })

    const mockFetch = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', mockFetch)

    await replayQueue()
    await new Promise((r) => setTimeout(r, 20))

    expect(fakeStore.has('max-id')).toBe(false)
  }, 10000)
})
