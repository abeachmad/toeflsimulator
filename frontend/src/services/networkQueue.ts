/**
 * Network Queue Service — Task 21.1
 *
 * Queues failed API requests in IndexedDB and retries them with
 * exponential backoff when the connection is restored.
 *
 * Requirements: 19.1
 */

const DB_NAME = 'toefl-network-queue'
const DB_VERSION = 1
const STORE_NAME = 'pending-requests'

export interface QueuedRequest {
  id: string
  url: string
  method: string
  headers: Record<string, string>
  body: string | null
  enqueuedAt: number
  retryCount: number
}

/** Exponential backoff params */
const INITIAL_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000
const MAX_RETRIES = 5

function backoffDelay(retryCount: number): number {
  return Math.min(INITIAL_DELAY_MS * 2 ** retryCount, MAX_DELAY_MS)
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ---------- IndexedDB helpers ----------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getAllQueued(): Promise<QueuedRequest[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result as QueuedRequest[])
    req.onerror = () => reject(req.error)
  })
}

async function saveQueued(item: QueuedRequest): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(item)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function deleteQueued(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ---------- Public API ----------

/**
 * Enqueue a failed request for later retry.
 */
export async function enqueueRequest(
  url: string,
  init: RequestInit,
): Promise<void> {
  const headers: Record<string, string> = {}
  if (init.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => {
        headers[k] = v
      })
    } else if (Array.isArray(init.headers)) {
      for (const [k, v] of init.headers) {
        headers[k] = v
      }
    } else {
      Object.assign(headers, init.headers)
    }
  }

  const item: QueuedRequest = {
    id: generateId(),
    url,
    method: (init.method ?? 'GET').toUpperCase(),
    headers,
    body: typeof init.body === 'string' ? init.body : null,
    enqueuedAt: Date.now(),
    retryCount: 0,
  }

  await saveQueued(item)
}

/**
 * Attempt to replay all queued requests. Should be called when
 * the `online` event fires or during periodic sync.
 */
export async function replayQueue(
  onProgress?: (processed: number, total: number) => void,
): Promise<void> {
  const items = await getAllQueued()
  let processed = 0

  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      })

      if (response.ok) {
        await deleteQueued(item.id)
      } else if (item.retryCount >= MAX_RETRIES) {
        // Give up after max retries
        await deleteQueued(item.id)
      } else {
        // Increment retry count
        await saveQueued({ ...item, retryCount: item.retryCount + 1 })
      }
    } catch {
      if (item.retryCount >= MAX_RETRIES) {
        await deleteQueued(item.id)
      } else {
        await saveQueued({ ...item, retryCount: item.retryCount + 1 })
      }
    }

    processed++
    onProgress?.(processed, items.length)
  }
}

// ---------- Connectivity monitoring ----------

type ConnectivityListener = (online: boolean) => void
const listeners: Set<ConnectivityListener> = new Set()

export function addConnectivityListener(fn: ConnectivityListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notifyListeners(online: boolean): void {
  listeners.forEach((fn) => fn(online))
}

// Retry with backoff when connection is restored
let retryTimeoutId: ReturnType<typeof setTimeout> | null = null

function scheduleRetry(attempt = 0): void {
  if (retryTimeoutId) clearTimeout(retryTimeoutId)
  const delay = backoffDelay(attempt)
  retryTimeoutId = setTimeout(async () => {
    if (navigator.onLine) {
      await replayQueue()
    } else {
      scheduleRetry(attempt + 1)
    }
  }, delay)
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    notifyListeners(true)
    replayQueue()
  })
  window.addEventListener('offline', () => {
    notifyListeners(false)
    scheduleRetry()
  })
}

/**
 * Wrapper around fetch that automatically queues the request on network failure.
 * Use this instead of bare `fetch` for important exam-related API calls.
 */
export async function resilientFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  try {
    const response = await fetch(url, init)
    return response
  } catch (err) {
    // Network error — queue for retry
    await enqueueRequest(url, init)
    throw err
  }
}
