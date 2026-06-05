import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextEditor } from './TextEditor'

describe('TextEditor', () => {
  it('renders with default placeholder', () => {
    render(<TextEditor />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    render(<TextEditor label="Your Response" />)
    expect(screen.getByText('Your Response')).toBeInTheDocument()
  })

  it('displays initial word count of 0 for empty input', () => {
    render(<TextEditor />)
    expect(screen.getByText('0 words')).toBeInTheDocument()
  })

  it('updates word count as user types', async () => {
    const user = userEvent.setup()
    render(<TextEditor />)
    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Hello world test')
    expect(screen.getByText('3 words')).toBeInTheDocument()
  })

  it('shows singular "word" for exactly 1 word', async () => {
    const user = userEvent.setup()
    render(<TextEditor />)
    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Hello')
    expect(screen.getByText('1 word')).toBeInTheDocument()
  })

  it('calls onChange with updated text', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TextEditor onChange={onChange} />)
    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Hi')
    expect(onChange).toHaveBeenCalled()
    expect(onChange).toHaveBeenLastCalledWith('Hi')
  })

  it('respects defaultValue', () => {
    render(<TextEditor defaultValue="initial text" />)
    expect(screen.getByRole('textbox')).toHaveValue('initial text')
  })

  it('is controlled when value prop is provided', () => {
    render(<TextEditor value="controlled" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('controlled')
  })

  it('shows minWordCount hint when below threshold', async () => {
    const user = userEvent.setup()
    render(<TextEditor minWordCount={50} />)
    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'only three words')
    expect(screen.getByText(/aim for at least 50 words/)).toBeInTheDocument()
  })

  it('does not show minWordCount hint when above threshold', async () => {
    const user = userEvent.setup()
    render(<TextEditor minWordCount={2} />)
    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'three words here')
    expect(screen.queryByText(/aim for at least/)).not.toBeInTheDocument()
  })

  it('textarea is read-only when readOnly=true', () => {
    render(<TextEditor readOnly value="locked" onChange={() => {}} />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('readonly')
  })

  it('has correct aria attributes', () => {
    render(<TextEditor ariaLabel="My editor" />)
    const textarea = screen.getByLabelText('My editor')
    expect(textarea).toBeInTheDocument()
  })

  it('word count has live region for accessibility', () => {
    render(<TextEditor />)
    const wordCountEl = screen.getByRole('status')
    expect(wordCountEl).toHaveAttribute('aria-live', 'polite')
  })

  it('counts words correctly with extra whitespace', async () => {
    render(<TextEditor value="  hello   world  " onChange={() => {}} />)
    expect(screen.getByText('2 words')).toBeInTheDocument()
  })

  it('renders Cut / Paste / Undo toolbar buttons', () => {
    render(<TextEditor />)
    expect(screen.getByRole('button', { name: /cut/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /paste/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument()
  })

  it('toolbar has correct ARIA role', () => {
    render(<TextEditor />)
    expect(screen.getByRole('toolbar')).toBeInTheDocument()
  })
})
