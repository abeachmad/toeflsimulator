import { useState, useRef, useCallback, useEffect } from 'react'

interface TextEditorProps {
  /** Controlled value (optional) */
  value?: string
  /** Default initial value */
  defaultValue?: string
  /** Label shown above the editor */
  label?: string
  /** Placeholder text */
  placeholder?: string
  /** Called whenever text changes */
  onChange?: (text: string) => void
  /** Minimum recommended word count (shown as hint) */
  minWordCount?: number
  /** Whether the editor is read-only */
  readOnly?: boolean
  /** CSS class name for outer wrapper */
  className?: string
  /** ARIA label for the textarea (accessibility) */
  ariaLabel?: string
}

/**
 * Count words in a string (split on whitespace runs, ignore empty tokens)
 */
function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/**
 * TextEditor Component
 *
 * Writing section textarea with:
 * - Real-time word count display
 * - Native cut / paste / undo controls (browser)
 * - Official ETS styling (dark charcoal background, white text)
 * - Accessible ARIA attributes
 *
 * Requirements: 5.3, 5.4, 10.5
 */
export function TextEditor({
  value,
  defaultValue = '',
  label,
  placeholder = 'Type your response here...',
  onChange,
  minWordCount,
  readOnly = false,
  className = '',
  ariaLabel = 'Writing response editor',
}: TextEditorProps) {
  const isControlled = value !== undefined
  const [internalText, setInternalText] = useState(defaultValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const text = isControlled ? value : internalText
  const wordCount = countWords(text)

  // When controlled value changes, keep internal state in sync so word count is always fresh
  useEffect(() => {
    if (isControlled && value !== undefined) {
      setInternalText(value)
    }
  }, [isControlled, value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value
      if (!isControlled) {
        setInternalText(newText)
      }
      onChange?.(newText)
    },
    [isControlled, onChange],
  )

  const wordCountColor =
    minWordCount && wordCount < minWordCount ? 'text-yellow-400' : 'text-green-400'

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <label
          htmlFor="text-editor-textarea"
          className="text-sm font-semibold text-ets-light-blue uppercase tracking-wide"
        >
          {label}
        </label>
      )}

      {/* Toolbar — cut, paste, undo use native browser behaviour */}
      <div
        className="flex items-center gap-2 bg-ets-charcoal border border-gray-600 rounded-t px-3 py-1"
        role="toolbar"
        aria-label="Text editing controls"
      >
        <button
          type="button"
          onClick={() => {
            textareaRef.current?.focus()
            document.execCommand('cut')
          }}
          className="text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-600 transition-colors"
          aria-label="Cut selected text"
        >
          Cut
        </button>
        <button
          type="button"
          onClick={() => {
            textareaRef.current?.focus()
            document.execCommand('paste')
          }}
          className="text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-600 transition-colors"
          aria-label="Paste text"
        >
          Paste
        </button>
        <button
          type="button"
          onClick={() => {
            textareaRef.current?.focus()
            document.execCommand('undo')
          }}
          className="text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-600 transition-colors"
          aria-label="Undo last action"
        >
          Undo
        </button>
      </div>

      {/* Main textarea */}
      <textarea
        id="text-editor-textarea"
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        readOnly={readOnly}
        aria-label={ariaLabel}
        aria-describedby="text-editor-word-count"
        aria-readonly={readOnly}
        spellCheck
        className="w-full min-h-[320px] resize-y bg-gray-900 text-white border border-gray-600 rounded-b p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ets-blue focus:border-ets-blue placeholder-gray-500 disabled:opacity-60"
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      />

      {/* Word count */}
      <div
        id="text-editor-word-count"
        role="status"
        className="flex items-center gap-2 text-xs"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className={`font-semibold ${wordCountColor}`}>
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </span>
        {minWordCount && wordCount < minWordCount && (
          <span className="text-gray-400">
            (aim for at least {minWordCount} words)
          </span>
        )}
      </div>
    </div>
  )
}
