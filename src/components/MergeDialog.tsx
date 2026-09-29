import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { GoalMap, GoalNode } from '../domain/types'
import { CLUSTER_IDS, ROOT_ID } from '../domain/types'

export interface MergeDialogProps {
  map: GoalMap
  sourceId: string | null
  busy?: boolean
  error?: string
  onClose: () => void
  onMerge: (targetId: string) => void
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

function possibleTargets(map: GoalMap, sourceId: string): GoalNode[] {
  return Object.values(map.nodes).filter((node) => !node.archived && node.id !== sourceId && node.id !== ROOT_ID &&
    !CLUSTER_IDS.includes(node.id as typeof CLUSTER_IDS[number]) && !isDescendant(map, sourceId, node.id) && !isDescendant(map, node.id, sourceId))
}

function Preview({ source, target }: { source: GoalNode; target: GoalNode }) {
  const sourceDetails = [source.description, source.current, source.target, source.note].filter(Boolean)
  const targetDetails = [target.description, target.current, target.target, target.note].filter(Boolean)
  return <div className="merge-preview" aria-live="polite">
    <strong>{target.title}</strong>
    <p>{source.title} will be folded into this goal. The result keeps both sets of text, milestones, reminders, children, and connections.</p>
    <p className="merge-counts">{sourceDetails.length + targetDetails.length} text fields · {(source.milestones?.length ?? 0) + (target.milestones?.length ?? 0)} milestones · {(source.childrenIds.length + target.childrenIds.length)} child goals</p>
  </div>
}

function MergeDialogInner({ map, sourceId, busy, error, onClose, onMerge }: MergeDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const source = sourceId ? map.nodes[sourceId] : undefined
  const targets = source ? possibleTargets(map, source.id) : []
  const [targetId, setTargetId] = useState('')
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])
  const target = map.nodes[targetId]
  return <dialog className="sheet merge-sheet" ref={ref} onCancel={(event) => { event.preventDefault(); onClose() }} aria-labelledby="merge-title">
    <div className="sheet-head"><div><div className="eyebrow">Reshape the map</div><h2 id="merge-title">Merge goals</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close merge dialog"><X aria-hidden="true" /></button></div>
    {source && <><p className="sheet-intro">Choose which goal will remain. Review the combined content before merging.</p>
      <div className="field"><label htmlFor="merge-source">From</label><input id="merge-source" value={source.title} readOnly /></div>
      <div className="field"><label htmlFor="merge-target">Into</label><select id="merge-target" value={targetId} onChange={(event) => setTargetId(event.target.value)}>
        <option value="">Choose a goal…</option>{targets.map((node) => <option value={node.id} key={node.id}>{node.title}</option>)}
      </select></div>
      {target && <Preview source={source} target={target} />}
      {!targets.length && <p className="empty-note">There is no other goal to merge into yet.</p>}
      {error && <p className="sheet-error" role="alert">{error}</p>}
      <div className="sheet-actions"><button className="subtle-button" type="button" onClick={onClose}>Cancel</button><button className="solid-button" type="button" disabled={!target || busy} onClick={() => onMerge(targetId)}>{busy ? 'Merging…' : 'Merge goals'}</button></div>
    </>}
  </dialog>
}

export function MergeDialog(props: MergeDialogProps) {
  if (!props.sourceId || !props.map.nodes[props.sourceId]) return null
  return <MergeDialogInner key={props.sourceId} {...props} />
}
