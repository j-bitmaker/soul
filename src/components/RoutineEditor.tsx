import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { GoalNode, Routine } from '../domain/types'
import { cleanRoutines, RoutineFields } from './RoutineFields'

export function RoutineEditor({ node, busy, error, onClose, onSave }: {
  node: GoalNode
  busy?: boolean
  error?: string
  onClose: () => void
  onSave: (routines: Routine[]) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [routines, setRoutines] = useState<Routine[]>(node.routines ?? [])
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave(cleanRoutines(routines))
  }

  return <dialog className="sheet" ref={dialogRef} onCancel={(event) => { event.preventDefault(); onClose() }} aria-labelledby="routine-editor-title">
    <div className="sheet-head"><div><div className="eyebrow">{node.title}</div><h2 id="routine-editor-title">Edit routine</h2></div>
      <button type="button" className="icon-button" aria-label="Close routine editor" onClick={onClose}><X aria-hidden="true" /></button></div>
    <p className="sheet-intro">Keep only the practices you want to remember.</p>
    <form onSubmit={submit}>
      <RoutineFields items={routines} onChange={setRoutines} />
      {error && <p className="sheet-error" role="alert">{error}</p>}
      <div className="sheet-actions"><button type="button" className="subtle-button" onClick={onClose}>Cancel</button>
        <button type="submit" className="solid-button" disabled={busy}>{busy ? 'Saving…' : 'Save routine'}</button></div>
    </form>
  </dialog>
}
