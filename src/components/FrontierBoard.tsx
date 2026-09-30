import { createContext, useContext, useState, type FormEvent, type ReactNode } from 'react'
import {
  closestCenter, DndContext, DragOverlay, KeyboardSensor, MouseSensor, pointerWithin, TouchSensor,
  useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection,
} from '@dnd-kit/core'
import { ArrowDown, ArrowRight, ArrowUp, ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react'
import { activeIds, placeEntry, queuedIds } from '../domain/frontier'
import type { FrontierLane, GoalMap } from '../domain/types'
import { CLUSTER_IDS } from '../domain/types'
import { goalsFromIds, LabelPills, orientationLine, toneById, type LaneGoal } from './goalView'
import { dropTarget, laneDropId, type Lanes } from './priorityDrag'

export interface FrontierBoardProps {
  map: GoalMap
  editMode: boolean
  canEdit: boolean
  busy?: boolean
  onSelect: (id: string) => void
  onPlace: (id: string, lane: FrontierLane | null, index?: number, whenFull?: 'bump' | 'reject') => Promise<boolean> | void
  onAddToQueue: (title: string, parentId: string) => Promise<boolean>
  onDelete: (id: string) => void
}

const DragState = createContext({ enabled: false, busy: false })

function DraggableSlot({ id, title, tone, className, children }: {
  id: string; title: string; tone?: string; className: string; children: (handle: ReactNode) => ReactNode
}) {
  const { busy } = useContext(DragState)
  const drag = useDraggable({ id, disabled: busy })
  const drop = useDroppable({ id })
  /* eslint-disable react-hooks/refs -- dnd-kit hands out callback refs, listeners, and flags; no ref object is read during render */
  const handle = <button type="button" className="drag-handle" ref={drag.setActivatorNodeRef} {...drag.listeners} {...drag.attributes}
    aria-label={`Drag ${title}`} disabled={busy}><GripVertical aria-hidden="true" /></button>
  const state = `${drag.isDragging ? ' is-dragging' : ''}${drop.isOver && !drag.isDragging ? ' is-over' : ''}`
  /* eslint-enable react-hooks/refs */
  return <div ref={(element) => { drag.setNodeRef(element); drop.setNodeRef(element) }} data-tone={tone}
    className={`${className} drag-slot${state}`}>
    {children(handle)}
  </div>
}

/** A goal's box in a lane: draggable for the owner, plain for everyone else. */
function GoalSlot(props: { id: string; title: string; tone?: string; className: string; children: (handle: ReactNode) => ReactNode }) {
  const { enabled } = useContext(DragState)
  return enabled
    ? <DraggableSlot {...props} />
    : <div className={props.className}>{props.children(null)}</div>
}

function DroppableLane({ lane, className, labelledBy, children }: { lane: FrontierLane; className: string; labelledBy?: string; children: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: laneDropId(lane) })
  return <div ref={setNodeRef} className={`${className}${isOver ? ' is-over-lane' : ''}`}
    role={labelledBy ? 'group' : undefined} aria-labelledby={labelledBy}>{children}</div>
}

function Lane(props: { lane: FrontierLane; className: string; labelledBy?: string; children: ReactNode }) {
  const { enabled } = useContext(DragState)
  return enabled
    ? <DroppableLane {...props} />
    : <div className={props.className} role={props.labelledBy ? 'group' : undefined} aria-labelledby={props.labelledBy}>{props.children}</div>
}

function LaneMoves({ props, id, lane, index, count }: { props: FrontierBoardProps; id: string; lane: FrontierLane; index: number; count: number }) {
  const title = props.map.nodes[id].title
  const where = lane === 'active' ? 'Active' : 'the Queue'
  return <div className="edit-row" aria-label={`Order of ${title}`}>
    <button className="icon-button" title="Move up" aria-label={`Move ${title} up in ${where}`}
      disabled={index === 0 || props.busy} onClick={() => props.onPlace(id, lane, index - 1)}><ArrowUp aria-hidden="true" /></button>
    <button className="icon-button" title="Move down" aria-label={`Move ${title} down in ${where}`}
      disabled={index === count - 1 || props.busy} onClick={() => props.onPlace(id, lane, index + 1)}><ArrowDown aria-hidden="true" /></button>
    <button className="icon-button danger" title="Delete" aria-label={`Delete ${title}`}
      disabled={props.busy} onClick={() => props.onDelete(id)}><Trash2 aria-hidden="true" /></button>
  </div>
}

function FrontierLead({ props, goal, count }: { props: FrontierBoardProps; goal: LaneGoal; count: number }) {
  const { node, cluster } = goal
  const detail = orientationLine(node)
  return <GoalSlot id={node.id} title={node.title} tone={toneById[cluster?.id ?? '']} className="frontier-lead-wrap">
    {(handle) => <>
      {handle}
      <button className="frontier-lead" data-tone={toneById[cluster?.id ?? '']} onClick={() => props.onSelect(node.id)}>
        <span className="frontier-lead-top">
          <span className="frontier-context"><span className="alive-dot" aria-hidden="true" />{cluster?.title ?? 'Soul'}</span>
          <ArrowRight className="frontier-lead-arrow" aria-hidden="true" />
        </span>
        <span className="frontier-lead-title"><span className="visually-hidden">Lead focus: </span>{node.title}</span>
        {detail && <span className="frontier-lead-detail">{detail}</span>}
        <LabelPills labels={node.labels} />
      </button>
      {props.editMode && <LaneMoves props={props} id={node.id} lane="active" index={0} count={count} />}
    </>}
  </GoalSlot>
}

function FrontierRow({ props, goal, lane, index, count }: { props: FrontierBoardProps; goal: LaneGoal; lane: FrontierLane; index: number; count: number }) {
  const { node, cluster } = goal
  const detail = orientationLine(node)
  return <GoalSlot id={node.id} title={node.title} tone={toneById[cluster?.id ?? '']} className="frontier-row">
    {(handle) => <>
      {handle}
      <button className="frontier-open" data-tone={toneById[cluster?.id ?? '']} onClick={() => props.onSelect(node.id)}>
        <span className="frontier-main">
          <span className="frontier-title">{node.title}</span>
          <span className="frontier-context"><span className="alive-dot" aria-hidden="true" />{cluster?.title ?? 'Soul'}</span>
          {detail && <span className="frontier-detail">{detail}</span>}
          <LabelPills labels={node.labels} />
        </span>
        <ChevronRight className="frontier-chevron" aria-hidden="true" />
      </button>
      {props.editMode && <LaneMoves props={props} id={node.id} lane={lane} index={index} count={count} />}
    </>}
  </GoalSlot>
}

function QueueAdd({ props }: { props: FrontierBoardProps }) {
  const [title, setTitle] = useState('')
  const [parentId, setParentId] = useState<string>(CLUSTER_IDS[0])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = title.trim()
    if (!text) return
    if (await props.onAddToQueue(text, parentId)) setTitle('')
  }
  return <form className="queue-add" onSubmit={(event) => { void submit(event) }}>
    <label className="visually-hidden" htmlFor="queue-add-title">Add to the queue</label>
    <input id="queue-add-title" value={title} placeholder="Add to the queue…" onChange={(event) => setTitle(event.target.value)} />
    <label className="visually-hidden" htmlFor="queue-add-direction">Direction</label>
    <select id="queue-add-direction" value={parentId} onChange={(event) => setParentId(event.target.value)}>
      {CLUSTER_IDS.map((id) => <option key={id} value={id}>{props.map.nodes[id]?.title ?? id}</option>)}
    </select>
    <button className="subtle-button" disabled={props.busy || !title.trim()}><Plus aria-hidden="true" /> Add</button>
  </form>
}

function Queue({ props, goals }: { props: FrontierBoardProps; goals: LaneGoal[] }) {
  if (!goals.length && !props.canEdit) return null
  return <Lane lane="queue" className="queue-section" labelledBy="queue-title">
    <div className="queue-heading"><h3 id="queue-title">Queue</h3><p>Next in line, not active yet</p></div>
    {goals.length > 0
      ? <div className="frontier-list">
        {goals.map((goal, index) => <FrontierRow key={goal.node.id} props={props} goal={goal} lane="queue" index={index} count={goals.length} />)}
      </div>
      : <p className="lane-hint">Drag a goal here to queue it</p>}
    {props.editMode && <QueueAdd props={props} />}
  </Lane>
}

const pickCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  const pool = hits.length ? hits : closestCenter(args)
  const goal = pool.find((hit) => !String(hit.id).startsWith('lane:'))
  return goal ? [goal] : pool.slice(0, 1)
}

function DragBoard({ lanes, busy, describe, onDrop, children }: {
  lanes: Lanes
  busy: boolean
  describe: (id: string) => { title: string; tone?: string }
  onDrop: (id: string, lane: FrontierLane, index: number) => void
  children: ReactNode
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )
  const [dragging, setDragging] = useState<string | null>(null)
  const name = (id: string | number): string => {
    const text = String(id)
    return text === laneDropId('active') ? 'Active' : text === laneDropId('queue') ? 'the Queue' : describe(text).title
  }
  const preview = dragging ? describe(dragging) : null
  return <DndContext id="frontier-board" sensors={sensors} collisionDetection={pickCollision}
    onDragStart={(event) => setDragging(String(event.active.id))}
    onDragCancel={() => setDragging(null)}
    onDragEnd={(event) => {
      setDragging(null)
      const target = dropTarget(lanes, String(event.active.id), event.over ? String(event.over.id) : null)
      if (target) onDrop(String(event.active.id), target.lane, target.index)
    }}
    accessibility={{
      screenReaderInstructions: { draggable: 'To move this goal, press space or enter, use the arrow keys, then press space again to drop. Press escape to cancel.' },
      announcements: {
        onDragStart: ({ active }) => `Picked up ${name(active.id)}.`,
        onDragOver: ({ active, over }) => (over ? `${name(active.id)} is over ${name(over.id)}.` : undefined),
        onDragEnd: ({ active, over }) => (over ? `Dropped ${name(active.id)} on ${name(over.id)}.` : `${name(active.id)} was dropped.`),
        onDragCancel: ({ active }) => `Moving ${name(active.id)} was cancelled.`,
      },
    }}>
    <DragState.Provider value={{ enabled: true, busy }}>{children}</DragState.Provider>
    <DragOverlay>{preview ? <div className="drag-preview" data-tone={preview.tone}><span className="alive-dot" aria-hidden="true" />{preview.title}</div> : null}</DragOverlay>
  </DndContext>
}

/** Active Frontier (lead card and rows) and the Queue. The owner can drag goals within and between them. */
export function Frontier({ props }: { props: FrontierBoardProps }) {
  const [pending, setPending] = useState<Lanes | null>(null)
  const lanes: Lanes = pending ?? { active: activeIds(props.map.frontier), queue: queuedIds(props.map.frontier) }
  const active = goalsFromIds(props.map, lanes.active)
  const queue = goalsFromIds(props.map, lanes.queue)
  if (!active.length && !queue.length && !props.canEdit) return null
  const [lead, ...rest] = active

  async function drop(id: string, lane: FrontierLane, index: number): Promise<void> {
    const next = placeEntry(props.map.frontier, id, lane, index, 'bump')
    setPending({ active: activeIds(next), queue: queuedIds(next) })
    try {
      await props.onPlace(id, lane, index, 'bump')
    } finally {
      setPending(null)
    }
  }

  const body = <>
    <div className="section-heading"><h2 id="frontier-title">Active Frontier</h2><p>What deserves attention now</p></div>
    <Lane lane="active" className={`frontier-layout${lead && rest.length ? ' has-lead' : ''}`}>
      {!lead && <p className="empty-note">No current focus. Add a goal when one needs your attention.</p>}
      {lead && <FrontierLead props={props} goal={lead} count={active.length} />}
      {rest.length > 0 && <div className="frontier-list">
        {rest.map((goal, index) => <FrontierRow key={goal.node.id} props={props} goal={goal} lane="active" index={index + 1} count={active.length} />)}
      </div>}
    </Lane>
    <Queue props={props} goals={queue} />
  </>
  return <section className="frontier-section" aria-labelledby="frontier-title">
    {props.canEdit
      ? <DragBoard lanes={lanes} busy={Boolean(props.busy)} onDrop={(id, lane, index) => { void drop(id, lane, index) }}
        describe={(id) => ({ title: props.map.nodes[id]?.title ?? id, tone: toneById[goalsFromIds(props.map, [id])[0]?.cluster?.id ?? ''] })}>{body}</DragBoard>
      : body}
  </section>
}
