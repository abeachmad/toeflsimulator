import { useConnectivity } from '../hooks/useConnectivity'

/**
 * ConnectivityIndicator
 *
 * Shows a subtle banner when the browser is offline.
 * Requirements: 19.1
 */
export function ConnectivityIndicator() {
  const isOnline = useConnectivity()

  if (isOnline) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-0 left-0 right-0 bg-yellow-700 text-yellow-100 text-center text-sm py-2 px-4 z-50"
    >
      You are currently offline. Your progress is saved locally and will sync when
      connection is restored.
    </div>
  )
}
