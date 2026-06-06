import { Component, Suspense, lazy, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useExamStore } from '../stores'

import { LandingPage } from './LandingPage'
import { ConnectivityIndicator } from './ConnectivityIndicator'

// Code-split heavy route components (Task 25.3 — Requirement 21.2)
const ExamStart = lazy(() => import('./ExamStart').then((m) => ({ default: m.ExamStart })))
const SectionDisplay = lazy(() =>
  import('./SectionDisplay').then((m) => ({ default: m.SectionDisplay })),
)
const ScoreReport = lazy(() =>
  import('./ScoreReport').then((m) => ({ default: m.ScoreReport })),
)

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  )
}

/**
 * Error Boundary Component
 * Catches JavaScript errors in child component tree and displays fallback UI
 * Requirements: 19.4
 */
interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ExamShell Error Boundary caught error:', error, errorInfo)
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
    })
    // Reset exam store to clear corrupted state
    useExamStore.getState().reset()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
            <div className="flex items-center justify-center w-16 h-16 bg-red-500 rounded-full mx-auto mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white text-center mb-2">
              Something Went Wrong
            </h1>
            <p className="text-gray-400 text-center mb-6">
              We encountered an unexpected error. Your exam session has been saved and
              you can try again.
            </p>
            {this.state.error && (
              <div className="bg-gray-700 rounded p-3 mb-6">
                <p className="text-red-400 text-sm font-mono break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded transition-colors"
              >
                Return to Home
              </button>
              <a
                href="mailto:support@toeflibt.example.com"
                className="block text-center text-blue-400 hover:text-blue-300 text-sm transition-colors"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * ExamShell Top-Level Container
 * Manages routing, session initialization, and state restoration
 * Requirements: 18.4, 19.4
 */
export function ExamShell() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/exam/start" element={<ExamStart />} />
            <Route path="/exam/section/:id" element={<SectionDisplay />} />
            <Route path="/exam/results" element={<ScoreReport />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <ConnectivityIndicator />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
