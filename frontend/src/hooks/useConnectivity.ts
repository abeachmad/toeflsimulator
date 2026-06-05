import { useState, useEffect } from 'react'
import { addConnectivityListener } from '../services/networkQueue'

/**
 * useConnectivity hook — Task 21.1
 *
 * Tracks online/offline status and exposes it as React state.
 * Subscribes to the networkQueue connectivity listener.
 *
 * Requirements: 19.1
 */
export function useConnectivity(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const remove = addConnectivityListener(setIsOnline)
    return remove
  }, [])

  return isOnline
}
