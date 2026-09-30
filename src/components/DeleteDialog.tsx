import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { subtreeIds } from '../domain/map'
import type { GoalMap } from '../domain/types'

export interface DeleteDialogProps {
  map: GoalMap
  goalId: string | null
  busy?: boolean
  error?: string
  onClose: () => void
  onConfirm: () => void
}

function DeleteDialogInner({ map, goalId, busy, error, onClose, onConfirm }: DeleteDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const goal = map.nodes[goalId as string]
  const nested = subtreeIds(map, goal.id).length - 1
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    cancelRef.current?.focus()
    return () => { if (dialog.open) dialog.close() }
  }, [])
  return <dialog className="sheet delete-sheet" ref={ref} onCancel={(event) => { event.preventDefault(); onClose() }} aria-labelledby="delete-title">
    <div className="sheet-head"><div><div className="eyebrow">Remove from the map</div><h2 id="delete-title">Delete goal</h2></div>
      <button className="icon-button" type="button" onClick={onClose} aria-label="Close delete dialog"><X aria-hidden="true" /></button></div>
    <div className="merge-preview" aria-live="polite">
      <strong>{goal.title}</strong>
      <p>This permanently removes the goal{nested > 0 ? ` and ${nested} nested ${nested === 1 ? 'goal' : 'goals'}` : ''} with {nested > 0 ? 'their' : 'its'} labels, milestones, reminders, and notes, takes {nested > 0 ? 'them' : 'it'} out of Active and the Queue, and removes links to {nested > 0 ? 'them' : 'it'} from other goals. It cannot be undone.</p>
      <p>To keep it for later, archive it instead.</p>
    </div>
    {error && <p className="sheet-error" role="alert">{error}</p>}
    <div className="sheet-actions">
      <button className="subtle-button" type="button" ref={cancelRef} onClick={onClose}>Cancel</button>
      <button className="solid-button danger" type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Deleting…' : 'Delete permanently'}</button>
    </div>
  </dialog>
}

export function DeleteDialog(props: DeleteDialogProps) {
  if (!props.goalId || !props.map.nodes[props.goalId]) return null
  return <DeleteDialogInner key={props.goalId} {...props} />
}
