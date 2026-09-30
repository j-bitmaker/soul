import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { GoalNode, Label } from '../domain/types'
import { cleanLabels, LabelFields } from './LabelFields'

export function LabelEditor({ node, busy, error, onClose, onSave }: {
  node: GoalNode
  busy?: boolean
  error?: string
  onClose: () => void
  onSave: (labels: Label[]) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [labels, setLabels] = useState<Label[]>(node.labels ?? [])
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave(cleanLabels(labels))
  }

  return <dialog className="sheet" ref={dialogRef} onCancel={(event) => { event.preventDefault(); onClose() }} aria-labelledby="label-editor-title">
    <div className="sheet-head"><div><div className="eyebrow">{node.title}</div><h2 id="label-editor-title">Edit labels</h2></div>
      <button type="button" className="icon-button" aria-label="Close label editor" onClick={onClose}><X aria-hidden="true" /></button></div>
    <p className="sheet-intro">Keep only what you want to see next to this name.</p>
    <form onSubmit={submit}>
      <LabelFields items={labels} onChange={setLabels} />
      {error && <p className="sheet-error" role="alert">{error}</p>}
      <div className="sheet-actions"><button type="button" className="subtle-button" onClick={onClose}>Cancel</button>
        <button type="submit" className="solid-button" disabled={busy}>{busy ? 'Saving…' : 'Save labels'}</button></div>
    </form>
  </dialog>
}
