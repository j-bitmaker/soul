import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Pencil, Plus, X } from 'lucide-react'
import type { Label } from '../domain/types'

/** A save that may report failure. Anything but `false` counts as saved. */
type Saved = Promise<boolean> | void

/** One line for adding something: type, press Enter, it is saved and the field clears. */
export function InlineAdd({ label, action, placeholder, disabled, onAdd }: {
  label: string
  action: string
  placeholder: string
  disabled?: boolean
  onAdd: (text: string) => Saved
}) {
  const id = useId()
  const [text, setText] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = text.trim()
    if (!value || disabled) return
    if ((await onAdd(value)) !== false) setText('')
  }
  return <form className="inline-add" onSubmit={(event) => { void submit(event) }}>
    <input id={id} value={text} aria-label={label} placeholder={placeholder} disabled={disabled}
      onChange={(event) => setText(event.target.value)} />
    <button className="icon-button" type="submit" aria-label={action} title={action} disabled={disabled || !text.trim()}>
      <Plus aria-hidden="true" />
    </button>
  </form>
}

/** A small text field that saves on Enter or when it loses focus, and cancels on Escape. */
function LabelInput({ initial = '', label, placeholder, onCommit, onCancel }: {
  initial?: string
  label: string
  placeholder?: string
  onCommit: (text: string, more: boolean) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const finished = useRef(false)
  const [value, setValue] = useState(initial)
  useEffect(() => { ref.current?.focus() }, [])
  function finish(action: () => void) {
    if (finished.current) return
    finished.current = true
    action()
  }
  return <input ref={ref} className="label-input" value={value} aria-label={label} placeholder={placeholder}
    size={Math.max(8, value.length + 1)}
    onChange={(event) => setValue(event.target.value)}
    onBlur={() => finish(() => onCommit(value, false))}
    onKeyDown={(event) => {
      if (event.key === 'Enter') { event.preventDefault(); finish(() => onCommit(value, true)) }
      if (event.key === 'Escape') { event.preventDefault(); finish(onCancel) }
    }} />
}

/**
 * Labels the owner can change where they stand: tap a label to rename it, × removes it,
 * "+ Label" adds one (Enter adds and keeps the field open for the next). Every change is saved at once.
 */
export function EditableLabels({ labels, disabled, subject, compact, className = '', onChange }: {
  labels: Label[]
  disabled?: boolean
  /** Whose labels these are, so that several editors on one page have distinct names for assistive technology. */
  subject?: string
  /** Only a small "+" instead of "+ Label", for tight places such as a goal in a card. */
  compact?: boolean
  className?: string
  onChange: (labels: Label[]) => Saved
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [adding, setAdding] = useState<number | null>(null)
  const save = (next: Label[]) => { void onChange(next) }
  const of = subject ? ` of ${subject}` : ''
  const busy = adding !== null || renaming !== null
  return <span className={`label-list editable${busy ? ' is-adding' : ''} ${className}`.trim()}>
    {labels.map((label) => renaming === label.id
      ? <LabelInput key={label.id} initial={label.text} label={`Rename label ${label.text}${of}`}
        onCancel={() => setRenaming(null)}
        onCommit={(text) => {
          setRenaming(null)
          const value = text.trim()
          if (value === label.text) return
          save(value ? labels.map((item) => item.id === label.id ? { ...item, text: value } : item) : labels.filter((item) => item.id !== label.id))
        }} />
      : <span className="label-pill editable" key={label.id}>
        <button type="button" className="label-text" disabled={disabled} aria-label={`Edit label ${label.text}${of}`} onClick={() => setRenaming(label.id)}>{label.text}</button>
        <button type="button" className="label-remove" disabled={disabled} aria-label={`Remove label ${label.text}${subject ? ` from ${subject}` : ''}`}
          onClick={() => save(labels.filter((item) => item.id !== label.id))}><X aria-hidden="true" /></button>
      </span>)}
    {adding !== null
      ? <LabelInput key={`add-${adding}`} label={subject ? `New label for ${subject}` : 'New label'} placeholder="New label"
        onCancel={() => setAdding(null)}
        onCommit={(text, more) => {
          const value = text.trim()
          if (value) save([...labels, { id: crypto.randomUUID(), text: value }])
          setAdding(more && value ? adding + 1 : null)
        }} />
      : <button type="button" className={`label-add${compact ? ' compact' : ''}`} disabled={disabled} title="Add label"
        aria-label={subject ? `Add label to ${subject}` : 'Add label'} onClick={() => setAdding(0)}>
        <Plus aria-hidden="true" />{!compact && ' Label'}
      </button>}
  </span>
}

function TextEdit({ initial, label, multiline, onDone }: {
  initial: string
  label: string
  multiline?: boolean
  onDone: (text: string | null) => void
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const finished = useRef(false)
  const [value, setValue] = useState(initial)
  useEffect(() => {
    const field = ref.current
    if (!field) return
    field.focus()
    field.setSelectionRange(field.value.length, field.value.length)
  }, [])
  function finish(text: string | null) {
    if (finished.current) return
    finished.current = true
    onDone(text)
  }
  const common = {
    ref, value, 'aria-label': label, className: `inline-text-input${multiline ? ' multiline' : ''}`,
    onChange: (event: { target: { value: string } }) => setValue(event.target.value),
    onBlur: () => finish(value),
  }
  return multiline
    ? <textarea {...common} rows={Math.max(2, value.split('\n').length)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); finish(null) }
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); finish(value) }
      }} />
    : <input {...common}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); finish(null) }
        if (event.key === 'Enter') { event.preventDefault(); finish(value) }
      }} />
}

/**
 * Text that the owner edits where it is shown: press it, type, and it saves on Enter or when the field
 * loses focus (Escape cancels). Everyone else just reads it. Optional text may be emptied; a required
 * one (the name) keeps its old value instead.
 */
export function InlineText({ value, label, placeholder, editable, multiline, required, className = '', onSave }: {
  value: string
  label: string
  placeholder: string
  editable: boolean
  multiline?: boolean
  required?: boolean
  className?: string
  onSave: (text: string) => Saved
}) {
  const [editing, setEditing] = useState(false)
  if (!editable) return value ? <>{value}</> : null
  if (editing) {
    return <TextEdit initial={value} label={`Edit ${label}`} multiline={multiline} onDone={(text) => {
      setEditing(false)
      if (text === null) return
      const next = text.trim()
      if (next === value.trim() || (required && !next)) return
      void onSave(next)
    }} />
  }
  return <button type="button" className={`inline-text ${className}`.trim()} title={`Edit ${label}`} onClick={() => setEditing(true)}>
    <span className={value ? '' : 'inline-text-empty'}>{value || placeholder}</span>
    <Pencil className="inline-text-icon" aria-hidden="true" />
  </button>
}
