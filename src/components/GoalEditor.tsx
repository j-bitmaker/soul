import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import type { GoalMap, GoalNode, Label, Milestone } from '../domain/types'
import { ROOT_ID } from '../domain/types'
import { cleanLabels, LabelFields } from './LabelFields'

export interface GoalEditorValues {
  title: string
  parentId: string
  secondaryIds: string[]
  description: string
  current: string
  target: string
  milestones: Milestone[]
  labels: Label[]
  reminders: string[]
  note: string
}

export interface GoalEditorProps {
  map: GoalMap
  node?: GoalNode
  parentId: string
  open: boolean
  busy?: boolean
  error?: string
  onClose: () => void
  onSave: (values: GoalEditorValues) => void
}

function initialValues(node: GoalNode | undefined, parentId: string): GoalEditorValues {
  return {
    title: node?.title ?? '', parentId: node?.parentId ?? (parentId === ROOT_ID ? 'understand' : parentId),
    secondaryIds: node?.secondaryIds ?? [], description: node?.description ?? '',
    current: node?.current ?? '', target: node?.target ?? '',
    milestones: node?.milestones ?? [], labels: node?.labels ?? [], reminders: node?.reminders ?? [], note: node?.note ?? '',
  }
}

function isDescendant(map: GoalMap, ancestorId: string, candidateId: string): boolean {
  let parentId = map.nodes[candidateId]?.parentId
  const seen = new Set<string>()
  while (parentId && !seen.has(parentId)) {
    if (parentId === ancestorId) return true
    seen.add(parentId)
    parentId = map.nodes[parentId]?.parentId
  }
  return false
}

function availableParents(map: GoalMap, node?: GoalNode): GoalNode[] {
  return Object.values(map.nodes).filter((item) =>
    !item.archived && item.id !== ROOT_ID && item.id !== node?.id && (!node || !isDescendant(map, node.id, item.id)))
}

function MilestoneFields({ items, onChange }: { items: Milestone[]; onChange: (items: Milestone[]) => void }) {
  return <div className="field full"><p className="field-label">Milestones</p>
    <div className="dynamic-list">{items.map((item) => <div className="dynamic-row" key={item.id}>
      <input type="checkbox" checked={item.done} aria-label={`Completed: ${item.title || 'milestone'}`} onChange={(event) => onChange(items.map((entry) => entry.id === item.id ? { ...entry, done: event.target.checked } : entry))} />
      <input value={item.title} aria-label="Milestone title" placeholder="A meaningful step" onChange={(event) => onChange(items.map((entry) => entry.id === item.id ? { ...entry, title: event.target.value } : entry))} />
      <button className="icon-button danger" type="button" aria-label={`Remove ${item.title || 'milestone'}`} onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}><Trash2 aria-hidden="true" /></button>
    </div>)}</div>
    <button className="text-button" type="button" onClick={() => onChange([...items, { id: crypto.randomUUID(), title: '', done: false }])}><Plus aria-hidden="true" /> Add milestone</button>
  </div>
}

function RelationFields({ map, node, values, onChange }: { map: GoalMap; node?: GoalNode; values: GoalEditorValues; onChange: (values: GoalEditorValues) => void }) {
  const nodes = Object.values(map.nodes).filter((item) => !item.archived && item.id !== ROOT_ID && item.id !== node?.id && item.id !== values.parentId)
  const options = nodes.filter((item) => !values.secondaryIds.includes(item.id))
  return <>
    <div className="field"><label htmlFor="goal-parent">Place under</label><select id="goal-parent" value={values.parentId} onChange={(event) => onChange({ ...values, parentId: event.target.value, secondaryIds: values.secondaryIds.filter((id) => id !== event.target.value) })}>
      {availableParents(map, node).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
    </select></div>
    <div className="field"><label htmlFor="goal-link">Also supports</label><select id="goal-link" value="" onChange={(event) => { if (event.target.value) onChange({ ...values, secondaryIds: [...values.secondaryIds, event.target.value] }) }}>
      <option value="">Add a connection…</option>{options.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
    </select></div>
    {values.secondaryIds.length > 0 && <div className="field full"><div className="selected-relations">{values.secondaryIds.map((id) => <button className="relation-chip secondary" type="button" key={id} onClick={() => onChange({ ...values, secondaryIds: values.secondaryIds.filter((item) => item !== id) })} aria-label={`Remove link to ${map.nodes[id]?.title ?? id}`}>
      {map.nodes[id]?.title ?? id} <X size={12} aria-hidden="true" />
    </button>)}</div></div>}
  </>
}

function useModal() {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])
  return ref
}

function GoalEditorInner({ map, node, parentId, busy, error, onClose, onSave }: Omit<GoalEditorProps, 'open'>) {
  const dialogRef = useModal()
  const [values, setValues] = useState(() => initialValues(node, parentId))
  const [remindersText, setRemindersText] = useState(() => (node?.reminders ?? []).join('\n'))
  const [localError, setLocalError] = useState('')
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = values.title.trim()
    if (!title) { setLocalError('Give this goal a name.'); return }
    setLocalError('')
    onSave({ ...values, title, description: values.description.trim(), current: values.current.trim(), target: values.target.trim(), note: values.note.trim(), milestones: values.milestones.filter((item) => item.title.trim()).map((item) => ({ ...item, title: item.title.trim() })), labels: cleanLabels(values.labels), reminders: remindersText.split('\n').map((item) => item.trim()).filter(Boolean) })
  }
  return <dialog className="sheet" ref={dialogRef} onCancel={(event) => { event.preventDefault(); onClose() }} aria-labelledby="editor-title">
    <div className="sheet-head"><div><div className="eyebrow">Shape the map</div><h2 id="editor-title">{node ? 'Edit goal' : 'New goal'}</h2></div><button type="button" className="icon-button" aria-label="Close editor" onClick={onClose}><X aria-hidden="true" /></button></div>
    <p className="sheet-intro">Only a name is required. Add detail when it helps you see the direction.</p>
    <form onSubmit={submit}>
      <div className="field-grid">
        <div className="field full"><label htmlFor="goal-title">Name</label><input id="goal-title" required value={values.title} onChange={(event) => { setValues({ ...values, title: event.target.value }); setLocalError('') }} placeholder="What matters?" /></div>
        <RelationFields map={map} node={node} values={values} onChange={setValues} />
        <div className="field full"><label htmlFor="goal-description">Meaning</label><textarea id="goal-description" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} placeholder="Why this matters, in a sentence or two" /></div>
        <div className="field"><label htmlFor="goal-current">Current</label><textarea id="goal-current" value={values.current} onChange={(event) => setValues({ ...values, current: event.target.value })} placeholder="Where things stand" /></div>
        <div className="field"><label htmlFor="goal-target">Target</label><textarea id="goal-target" value={values.target} onChange={(event) => setValues({ ...values, target: event.target.value })} placeholder="The desired state" /></div>
        <MilestoneFields items={values.milestones} onChange={(milestones) => setValues({ ...values, milestones })} />
        <LabelFields items={values.labels} onChange={(labels) => setValues({ ...values, labels })} />
        <div className="field full"><label htmlFor="goal-reminders">Reminders</label><textarea id="goal-reminders" value={remindersText} onChange={(event) => setRemindersText(event.target.value)} placeholder="One useful next action per line" /><p className="field-hint">One per line. These are notes, not permanent branches.</p></div>
        <div className="field full"><label htmlFor="goal-note">Note</label><textarea id="goal-note" value={values.note} onChange={(event) => setValues({ ...values, note: event.target.value })} placeholder="A thought worth keeping" /><p className="field-hint">This map is publicly readable, including this note.</p></div>
      </div>
      {(localError || error) && <p className="sheet-error" role="alert">{localError || error}</p>}
      <div className="sheet-actions"><button type="button" className="subtle-button" onClick={onClose}>Cancel</button><button type="submit" className="solid-button" disabled={busy}>{busy ? 'Saving…' : 'Save goal'}</button></div>
    </form>
  </dialog>
}

export function GoalEditor(props: GoalEditorProps) {
  if (!props.open) return null
  return <GoalEditorInner key={props.node?.id ?? `new-${props.parentId}`} {...props} />
}
