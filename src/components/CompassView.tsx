import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronRight, Compass, Download, Ellipsis, LogIn, LogOut, Pencil, Trash2, Upload, X } from 'lucide-react'
import type { FrontierLane, GoalMap, GoalNode } from '../domain/types'
import { CLUSTER_IDS, MAX_ACTIVE, ROOT_ID } from '../domain/types'
import type { NodeDetails } from '../domain/map'
import { Frontier } from './FrontierBoard'
import { LabelPills, laneOf, nearestCluster, pathTo, toneById } from './goalView'
import { EditableLabels, InlineAdd, InlineText } from './InlineEdit'

export interface CompassViewProps {
  map: GoalMap
  selectedId: string | null
  editMode: boolean
  canEdit: boolean
  authEnabled?: boolean
  busy?: boolean
  onSelect: (id: string | null) => void
  onToggleEdit: () => void
  onOpenEditor: (id?: string) => void
  onEditNode: (id: string, details: NodeDetails) => Promise<boolean> | void
  onAddGoal: (parentId: string, title: string) => Promise<boolean>
  onPlace: (id: string, lane: FrontierLane | null, index?: number, whenFull?: 'bump' | 'reject') => Promise<boolean> | void
  onAddToQueue: (title: string, parentId: string) => Promise<boolean>
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onOpenMerge: (id: string) => void
  onDelete: (id: string) => void
  onExport: () => void
  onImport: (file: File) => void
  onSignIn: () => void
  onSignOut: () => void
}

function activeChildren(map: GoalMap, id: string): GoalNode[] {
  const parent = map.nodes[id]
  return (parent?.childrenIds ?? [])
    .map((childId) => map.nodes[childId])
    .filter((node): node is GoalNode => Boolean(node && !node.archived))
}

/** Direct goals in automatic order: Active (in its order), then the rest in place, then the Queue (in its order). */
function priorityChildren(map: GoalMap, id: string): GoalNode[] {
  const rank = (goalId: string): number => {
    const index = map.frontier.findIndex((entry) => entry.nodeId === goalId)
    if (index < 0) return map.frontier.length
    return map.frontier[index].status === 'queued' ? map.frontier.length * 2 + index : index
  }
  return activeChildren(map, id).sort((left, right) => rank(left.id) - rank(right.id))
}

function Header(props: CompassViewProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])
  return <header className="app-header">
    <button className="brand-button" onClick={() => props.onSelect(null)} aria-label="Soul, return to overview">
      <Compass className="brand-mark" aria-hidden="true" /> Soul
    </button>
    <div className="header-controls">
      {props.canEdit && <button className={`header-action${props.editMode ? ' is-active' : ''}`} onClick={props.onToggleEdit} aria-label={props.editMode ? 'Done' : 'Edit'} aria-pressed={props.editMode}>
        {props.editMode ? <X aria-hidden="true" /> : <Pencil aria-hidden="true" />}
        <span>{props.editMode ? 'Done' : 'Edit'}</span>
      </button>}
      <button className="header-action" onClick={() => setMenuOpen(!menuOpen)} aria-label="More options" aria-expanded={menuOpen}>
        <Ellipsis aria-hidden="true" />
      </button>
      {menuOpen && <div className="utility-menu">
        <button onClick={() => { props.onExport(); setMenuOpen(false) }}><Download size={14} aria-hidden="true" /> Export JSON</button>
        {props.canEdit && <button onClick={() => importRef.current?.click()}><Upload size={14} aria-hidden="true" /> Import JSON</button>}
        {props.authEnabled !== false && <button onClick={() => { if (props.canEdit) props.onSignOut(); else props.onSignIn(); setMenuOpen(false) }}>
          {props.canEdit ? <LogOut size={14} aria-hidden="true" /> : <LogIn size={14} aria-hidden="true" />}
          {props.canEdit ? 'Sign out' : 'Owner sign in'}
        </button>}
      </div>}
      <input ref={importRef} hidden type="file" accept="application/json,.json" aria-label="Import map JSON" onChange={(event) => {
        const file = event.currentTarget.files?.[0]
        if (file) props.onImport(file)
        event.currentTarget.value = ''
        setMenuOpen(false)
      }} />
    </div>
  </header>
}

function ClusterCard({ node, map, onSelect }: { node: GoalNode; map: GoalMap; onSelect: (id: string) => void }) {
  const goals = priorityChildren(map, node.id)
  return <article className="cluster-card" data-tone={toneById[node.id]}>
    <h3 className="cluster-title"><button className="cluster-open" onClick={() => onSelect(node.id)}>
      <span>{node.title}</span><ArrowRight className="cluster-arrow" aria-hidden="true" />
    </button></h3>
    {node.description && <p className="cluster-description">{node.description}</p>}
    {goals.length ? <ul className="cluster-goals" aria-label={`Goals in ${node.title}`}>{goals.map((goal) =>
      <li key={goal.id}><button className="cluster-goal" onClick={() => onSelect(goal.id)}>
        <span>{goal.title}</span>{laneOf(map, goal.id) && <span className="lane-mark" data-lane={laneOf(map, goal.id)}><span className="visually-hidden">{laneOf(map, goal.id) === 'active' ? 'In focus' : 'Queued'}</span></span>}
      </button></li>)}</ul> : <p className="cluster-empty">No goals yet</p>}
    {node.labels?.length ? <LabelPills labels={node.labels} className="cluster-labels" /> : null}
  </article>
}

/** Three rays from one point in the direction colours: the compass, drawn quietly. */
function CompassMark() {
  return <svg className="compass-mark" viewBox="0 0 72 28" aria-hidden="true" focusable="false">
    <path className="ray ray-understand" d="M36 4 L9 24" />
    <path className="ray ray-create" d="M36 4 V24" />
    <path className="ray ray-mastery" d="M36 4 L63 24" />
    <circle className="origin" cx="36" cy="3" r="3" />
  </svg>
}

function Overview({ props }: { props: CompassViewProps }) {
  const soul = props.map.nodes[ROOT_ID]
  return <main className="page" id="main-content">
    <section className="orientation" aria-labelledby="soul-title">
      <div className="eyebrow">A mental compass</div>
      <h1 className="soul-title" id="soul-title">Soul</h1>
      <p className="soul-subtitle">{soul?.description || 'The orientation above every goal.'}</p>
      <CompassMark />
    </section>
    <section className="directions-section" aria-labelledby="directions-title">
      <div className="section-heading"><h2 id="directions-title">Three directions</h2><p>Distinct, alive, and connected</p></div>
      <div className="cluster-grid">{CLUSTER_IDS.map((id) => {
        const node = props.map.nodes[id]
        return node && <ClusterCard key={id} node={node} map={props.map} onSelect={props.onSelect} />
      })}</div>
    </section>
    <Frontier props={props} />
    <p className="footer-note">See clearly. Choose one thing. Begin.</p>
  </main>
}

function Breadcrumb({ map, node, onSelect }: { map: GoalMap; node: GoalNode; onSelect: (id: string | null) => void }) {
  const path = pathTo(map, node.id)
  return <nav className="breadcrumb" aria-label="Location in map">
    {path.map((item, index) => <span key={item.id}>
      {index > 0 && <ChevronRight aria-hidden="true" />}
      {index === path.length - 1 ? <span aria-current="page">{item.title}</span> : <button onClick={() => onSelect(item.id === ROOT_ID ? null : item.id)}>{item.title}</button>}
    </span>)}
  </nav>
}

function GoalRow({ props, child }: { props: CompassViewProps; child: GoalNode }) {
  const lane = laneOf(props.map, child.id)
  return <div className="frontier-row">
    <button className="goal-row" onClick={() => props.onSelect(child.id)}>
      <span className="goal-row-main"><span className="goal-row-title">{child.title}</span>{(child.description || child.current) && <span className="goal-row-detail">{child.description || child.current}</span>}<LabelPills labels={child.labels} /></span>
      {lane === 'active' && <span className="lane-mark" data-lane="active"><span className="visually-hidden">In focus</span></span>}
      <ArrowRight aria-hidden="true" />
    </button>
  </div>
}

/** All goals of a page in one scrolling list: Active and the rest first, the Queue below them, the Archive last. */
function ChildList({ props, node }: { props: CompassViewProps; node: GoalNode }) {
  const owner = props.canEdit
  const children = priorityChildren(props.map, node.id)
  const main = children.filter((child) => laneOf(props.map, child.id) !== 'queue')
  const queued = children.filter((child) => laneOf(props.map, child.id) === 'queue')
  const archived = node.childrenIds.map((id) => props.map.nodes[id]).filter((child): child is GoalNode => Boolean(child?.archived))
  if (!children.length && !owner) return null
  return <section className="content-section" aria-labelledby="goals-title" data-tone={toneById[nearestCluster(props.map, node.id)?.id ?? '']}>
    <h2 id="goals-title">{node.id === ROOT_ID ? 'Directions' : 'Goals'}</h2>
    {main.length > 0 && <div className="goal-list">{main.map((child) => <GoalRow key={child.id} props={props} child={child} />)}</div>}
    {!children.length && <p className="empty-note">Nothing here yet. A single meaningful goal is enough.</p>}
    {owner && <InlineAdd label="New goal" action="Add goal" placeholder="Add a goal…" disabled={props.busy} onAdd={(title) => props.onAddGoal(node.id, title)} />}
    {queued.length > 0 && <div className="goal-queue"><h3>Queue</h3><div className="goal-list">{queued.map((child) => <GoalRow key={child.id} props={props} child={child} />)}</div></div>}
    {owner && archived.length > 0 && <div className="archived-section"><h3>Archive</h3>{archived.map((child) => <div className="archived-row" key={child.id}><span>{child.title}</span><span className="archived-actions"><button className="text-button" aria-label={`Restore ${child.title}`} onClick={() => props.onRestore(child.id)}>Restore</button><button className="text-button danger" aria-label={`Delete ${child.title}`} onClick={() => props.onDelete(child.id)}>Delete</button></span></div>)}</div>}
  </section>
}

function Annotations({ props, node }: { props: CompassViewProps; node: GoalNode }) {
  const editable = props.canEdit && node.id !== ROOT_ID && !CLUSTER_IDS.includes(node.id as typeof CLUSTER_IDS[number])
  const milestones = node.milestones ?? []
  const reminders = node.reminders ?? []
  const hasProgress = Boolean(node.current || node.target || milestones.length)
  const hasOther = Boolean(reminders.length || node.note)
  const nextMilestoneIndex = milestones.findIndex((item) => !item.done)
  if (!editable && !hasProgress && !hasOther) return null
  const edit = (details: NodeDetails) => props.onEditNode(node.id, details)
  return <aside aria-label="Goal details">
    {(hasProgress || editable) && <section className="content-section"><h2>Progress</h2><div className="annotation-grid">
      {(node.current || editable) && <div className="annotation-block"><p className="annotation-label">Current</p><p className="annotation-value">{editable
        ? <InlineText editable multiline label="current state" placeholder="Where things stand" value={node.current ?? ''} onSave={(current) => edit({ current })} />
        : node.current}</p></div>}
      {(milestones.length > 0 || editable) && <div className="annotation-block"><p className="annotation-label">Milestones</p>
        {milestones.length > 0 && <ol className={`milestone-list${editable ? ' editable' : ''}`}>{milestones.map((milestone, index) => <li className={milestone.done ? 'done' : index === nextMilestoneIndex ? 'current' : ''} key={milestone.id}>
          {editable
            ? <>
              <button type="button" className="milestone-toggle" aria-pressed={milestone.done} disabled={props.busy}
                aria-label={`${milestone.title}: mark ${milestone.done ? 'not done' : 'done'}`}
                onClick={() => edit({ milestones: milestones.map((item) => item.id === milestone.id ? { ...item, done: !item.done } : item) })} />
              <span className="row-text">{milestone.title}</span>
              <button type="button" className="row-remove" disabled={props.busy} aria-label={`Remove milestone ${milestone.title}`}
                onClick={() => edit({ milestones: milestones.filter((item) => item.id !== milestone.id) })}><X aria-hidden="true" /></button>
            </>
            : milestone.title}
        </li>)}</ol>}
        {editable && <InlineAdd label="New milestone" action="Add milestone" placeholder="Add a milestone…" disabled={props.busy}
          onAdd={(title) => edit({ milestones: [...milestones, { id: crypto.randomUUID(), title, done: false }] })} />}
      </div>}
      {(node.target || editable) && <div className="annotation-block"><p className="annotation-label">Target</p><p className="annotation-value">{editable
        ? <InlineText editable multiline label="target" placeholder="The desired state" value={node.target ?? ''} onSave={(target) => edit({ target })} />
        : node.target}</p></div>}
    </div></section>}
    {(hasOther || editable) && <section className="content-section"><h2>Remember</h2>
      {reminders.length > 0 && <ul className={`reminder-list${editable ? ' editable' : ''}`}>{reminders.map((reminder, index) => <li key={`${index}-${reminder}`}>
        {editable
          ? <><span className="row-text">{reminder}</span>
            <button type="button" className="row-remove" disabled={props.busy} aria-label={`Remove reminder ${reminder}`}
              onClick={() => edit({ reminders: reminders.filter((_, at) => at !== index) })}><X aria-hidden="true" /></button></>
          : reminder}
      </li>)}</ul>}
      {editable && <InlineAdd label="New reminder" action="Add reminder" placeholder="Add a reminder…" disabled={props.busy}
        onAdd={(text) => edit({ reminders: [...reminders, text] })} />}
      {(node.note || editable) && <blockquote className="note-quote">{editable
        ? <InlineText editable multiline label="note" placeholder="A thought worth keeping (the map is public)" value={node.note ?? ''} onSave={(note) => edit({ note })} />
        : node.note}</blockquote>}
    </section>}
  </aside>
}

function Focus({ props, node }: { props: CompassViewProps; node: GoalNode }) {
  const cluster = nearestCluster(props.map, node.id)
  const secondary = node.secondaryIds.map((id) => props.map.nodes[id]).filter((item): item is GoalNode => Boolean(item && !item.archived))
  const lane = laneOf(props.map, node.id)
  const activeFull = props.map.frontier.filter((entry) => entry.status !== 'queued').length >= MAX_ACTIVE
  const isProtected = node.id === ROOT_ID || CLUSTER_IDS.includes(node.id as typeof CLUSTER_IDS[number])
  const isLeaf = activeChildren(props.map, node.id).length === 0
  const ownGoal = props.canEdit && !isProtected
  return <main className="page" id="main-content">
    <Breadcrumb map={props.map} node={node} onSelect={props.onSelect} />
    <div className="focus-header">
      <div className="focus-kicker" data-tone={toneById[cluster?.id ?? 'understand']}><span className="alive-dot" /><span className="eyebrow">{isProtected ? 'Direction' : 'Goal in focus'}</span></div>
      <h1 className="detail-title">{ownGoal
        ? <InlineText editable required label="name" placeholder="Name" value={node.title} onSave={(title) => props.onEditNode(node.id, { title })} />
        : node.title}</h1>
      {(node.description || ownGoal) && <p className="detail-description">{ownGoal
        ? <InlineText editable multiline label="meaning" placeholder="Add a meaning: why this matters" value={node.description ?? ''} onSave={(description) => props.onEditNode(node.id, { description })} />
        : node.description}</p>}
      <div className="focus-meta">{props.canEdit && node.id !== ROOT_ID
        ? <EditableLabels labels={node.labels ?? []} disabled={props.busy} onChange={(labels) => props.onEditNode(node.id, { labels })} />
        : <LabelPills labels={node.labels} />}{cluster && !isProtected && <button className="relation-chip" onClick={() => props.onSelect(cluster.id)}>{cluster.title}</button>}{secondary.map((item) => <button className="relation-chip secondary" onClick={() => props.onSelect(item.id)} key={item.id}>Also {item.title}</button>)}</div>
      {props.editMode && <div className="focus-actions">
        {!isProtected && <button className="subtle-button" onClick={() => props.onOpenEditor(node.id)}><Pencil aria-hidden="true" /> Edit goal</button>}
        {!isProtected && <select aria-label="Priority" value={lane ?? ''} onChange={(event) => props.onPlace(node.id, (event.target.value || null) as FrontierLane | null)}>
          <option value="">Not prioritised</option><option value="queue">Queue</option>
          <option value="active" disabled={activeFull && lane !== 'active'}>{activeFull && lane !== 'active' ? 'Active (full)' : 'Active'}</option>
        </select>}
        {!isProtected && <button className="subtle-button" onClick={() => props.onOpenMerge(node.id)}>Merge</button>}
        {!isProtected && <button className="subtle-button danger" onClick={() => props.onArchive(node.id)}>Archive</button>}
        {!isProtected && <button className="subtle-button danger" onClick={() => props.onDelete(node.id)}><Trash2 aria-hidden="true" /> Delete</button>}
      </div>}
    </div>
    <div className={`focus-layout${isLeaf && !props.canEdit ? ' leaf' : ''}`}><ChildList key={node.id} props={props} node={node} /><Annotations props={props} node={node} /></div>
  </main>
}

export function CompassView(props: CompassViewProps) {
  const node = props.selectedId ? props.map.nodes[props.selectedId] : undefined
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a><Header {...props} />
    {node && !node.archived ? <Focus props={props} node={node} /> : <Overview props={props} />}
  </div>
}
