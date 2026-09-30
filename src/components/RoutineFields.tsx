import { Plus, Trash2 } from 'lucide-react'
import type { Routine } from '../domain/types'

export function cleanRoutines(items: Routine[]): Routine[] {
  return items.filter((item) => item.title.trim()).map((item) => ({
    id: item.id,
    title: item.title.trim(),
    cadence: item.cadence?.trim() || undefined,
  }))
}

export function RoutineFields({ items, onChange }: {
  items: Routine[]
  onChange: (items: Routine[]) => void
}) {
  return <div className="field full">
    <p className="field-label">Routine</p>
    <div className="dynamic-list">{items.map((item, index) => <div className="dynamic-row routine-edit-row" key={item.id}>
      <input value={item.title} aria-label={`Routine title ${index + 1}`} placeholder="Repeated practice"
        onChange={(event) => onChange(items.map((entry) => entry.id === item.id ? { ...entry, title: event.target.value } : entry))} />
      <input value={item.cadence ?? ''} aria-label={`Routine cadence ${index + 1}`} placeholder="Daily, weekly…"
        onChange={(event) => onChange(items.map((entry) => entry.id === item.id ? { ...entry, cadence: event.target.value } : entry))} />
      <button className="icon-button danger" type="button" aria-label={`Remove routine ${item.title || index + 1}`}
        onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}><Trash2 aria-hidden="true" /></button>
    </div>)}</div>
    <button className="text-button" type="button" onClick={() => onChange([...items, { id: crypto.randomUUID(), title: '' }])}>
      <Plus aria-hidden="true" /> Add routine
    </button>
    <p className="field-hint">A reminder of what continues; no tracking or streaks.</p>
  </div>
}
