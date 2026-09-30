import { Plus, Trash2 } from 'lucide-react'
import type { Label } from '../domain/types'

export function cleanLabels(items: Label[]): Label[] {
  return items.filter((item) => item.text.trim()).map((item) => ({ id: item.id, text: item.text.trim() }))
}

export function LabelFields({ items, onChange }: {
  items: Label[]
  onChange: (items: Label[]) => void
}) {
  return <div className="field full">
    <p className="field-label">Labels</p>
    <div className="dynamic-list">{items.map((item, index) => <div className="dynamic-row" key={item.id}>
      <input value={item.text} aria-label={`Label ${index + 1}`} placeholder="A routine, a stage, a reminder…"
        onChange={(event) => onChange(items.map((entry) => entry.id === item.id ? { ...entry, text: event.target.value } : entry))} />
      <button className="icon-button danger" type="button" aria-label={`Remove label ${item.text || index + 1}`}
        onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}><Trash2 aria-hidden="true" /></button>
    </div>)}</div>
    <button className="text-button" type="button" onClick={() => onChange([...items, { id: crypto.randomUUID(), text: '' }])}>
      <Plus aria-hidden="true" /> Add label
    </button>
    <p className="field-hint">Free-form text shown as a small pill. No tracking or streaks.</p>
  </div>
}
