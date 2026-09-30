import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, ChevronRight, Compass, Download, Ellipsis, Eye, EyeOff, LogIn, LogOut, Pencil, Plus, Tag, Trash2, Upload, X } from 'lucide-react'
import type { FrontierLane, GoalMap, GoalNode, Label } from '../domain/types'
import { CLUSTER_IDS, MAX_ACTIVE, ROOT_ID } from '../domain/types'

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
  onOpenLabelEditor: (id: string) => void
  onPlace: (id: string, lane: FrontierLane | null, index?: number) => void
  onAddToQueue: (title: string, parentId: string) => Promise<boolean>
  onReorder: (id: string, direction: -1 | 1) => void
  onToggleVisible: (parentId: string, childId: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onOpenMerge: (id: string) => void
  onDelete: (id: string) => void
  onExport: () => void
  onImport: (file: File) => void
  onSignIn: () => void
  onSignOut: () => void
}

const toneById: Record<string, string> = {
  understand: 'expression', create: 'freedom', mastery: 'mastery',
}

function activeChildren(map: GoalMap, id: string): GoalNode[] {
  const parent = map.nodes[id]
  return (parent?.childrenIds ?? [])
    .map((childId) => map.nodes[childId])
    .filter((node): node is GoalNode => Boolean(node && !node.archived))
}

function laneOf(map: GoalMap, id: string): FrontierLane | null {
  const entry = map.frontier.find((item) => item.nodeId === id)
  return entry ? (entry.status === 'queued' ? 'queue' : 'active') : null
}

/** Direct goals in priority order: Active, then Queue (both in their own order), then the rest in place. */
function priorityChildren(map: GoalMap, id: string): GoalNode[] {
  const order = new Map(map.frontier.map((entry, index) => [entry.nodeId, index]))
  return activeChildren(map, id).sort((left, right) =>
    (order.get(left.id) ?? map.frontier.length) - (order.get(right.id) ?? map.frontier.length))
}

interface LaneGoal { node: GoalNode; cluster?: GoalNode }

function laneGoals(map: GoalMap, lane: FrontierLane): LaneGoal[] {
  return map.frontier.filter((entry) => (entry.status === 'queued') === (lane === 'queue')).flatMap((entry) => {
    const node = map.nodes[entry.nodeId]
    return node && !node.archived ? [{ node, cluster: nearestCluster(map, node.id) }] : []
  })
}

function pathTo(map: GoalMap, id: string): GoalNode[] {
  const path: GoalNode[] = []
  const seen = new Set<string>()
  let cursor: GoalNode | undefined = map.nodes[id]
  while (cursor && !seen.has(cursor.id)) {
    path.unshift(cursor)
    seen.add(cursor.id)
    cursor = cursor.parentId ? map.nodes[cursor.parentId] : undefined
  }
  return path
}

function nearestCluster(map: GoalMap, id: string): GoalNode | undefined {
  return pathTo(map, id).find((node) => CLUSTER_IDS.includes(node.id as typeof CLUSTER_IDS[number]))
}

/** One quiet line of orientation for a goal: where it stands or what comes next. Text only, never a meter. */
function orientationLine(node: GoalNode): string | undefined {
  if (node.current && node.target) return `${node.current} → ${node.target}`
  const next = node.milestones?.find((item) => !item.done)
  if (next) return `Next: ${next.title}`
  if (node.target) return `Target: ${node.target}`
  if (node.current) return `Now: ${node.current}`
  return node.description
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

/** Free-form labels as small pills. Plain spans so they can also sit inside buttons. */
function LabelPills({ labels, className = '' }: { labels?: Label[]; className?: string }) {
  if (!labels?.length) return null
  return <span className={`label-list ${className}`.trim()}>{labels.map((label) => <span className="label-pill" key={label.id}>{label.text}</span>)}</span>
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

function LaneMoves({ props, id, lane, index, count }: { props: CompassViewProps; id: string; lane: FrontierLane; index: number; count: number }) {
  return <div className="edit-row" aria-label={`Order of ${props.map.nodes[id].title}`}>
    <button className="icon-button" title="Move up" aria-label={`Move ${props.map.nodes[id].title} up in ${lane === 'active' ? 'Active' : 'the Queue'}`}
      disabled={index === 0 || props.busy} onClick={() => props.onPlace(id, lane, index - 1)}><ArrowUp aria-hidden="true" /></button>
    <button className="icon-button" title="Move down" aria-label={`Move ${props.map.nodes[id].title} down in ${lane === 'active' ? 'Active' : 'the Queue'}`}
      disabled={index === count - 1 || props.busy} onClick={() => props.onPlace(id, lane, index + 1)}><ArrowDown aria-hidden="true" /></button>
    <button className="icon-button danger" title="Delete" aria-label={`Delete ${props.map.nodes[id].title}`}
      disabled={props.busy} onClick={() => props.onDelete(id)}><Trash2 aria-hidden="true" /></button>
  </div>
}

function FrontierLead({ props, goal, count }: { props: CompassViewProps; goal: LaneGoal; count: number }) {
  const { node, cluster } = goal
  const detail = orientationLine(node)
  return <div className="frontier-lead-wrap">
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
  </div>
}

function FrontierRow({ props, goal, lane, index, count }: { props: CompassViewProps; goal: LaneGoal; lane: FrontierLane; index: number; count: number }) {
  const { node, cluster } = goal
  const detail = orientationLine(node)
  return <div className="frontier-row">
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
  </div>
}

function QueueAdd({ props }: { props: CompassViewProps }) {
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

function Queue({ props, goals }: { props: CompassViewProps; goals: LaneGoal[] }) {
  if (!goals.length && !props.editMode) return null
  return <div className="queue-section" role="group" aria-labelledby="queue-title">
    <div className="queue-heading"><h3 id="queue-title">Queue</h3><p>Next in line, not active yet</p></div>
    {goals.length > 0 && <div className="frontier-list">
      {goals.map((goal, index) => <FrontierRow key={goal.node.id} props={props} goal={goal} lane="queue" index={index} count={goals.length} />)}
    </div>}
    {props.editMode && <QueueAdd props={props} />}
  </div>
}

function Frontier({ props }: { props: CompassViewProps }) {
  const active = laneGoals(props.map, 'active')
  const queue = laneGoals(props.map, 'queue')
  if (!active.length && !queue.length && !props.canEdit) return null
  const [lead, ...rest] = active
  return <section className="frontier-section" aria-labelledby="frontier-title">
    <div className="section-heading"><h2 id="frontier-title">Active Frontier</h2><p>What deserves attention now</p></div>
    {!active.length && <p className="empty-note">No current focus. Add a goal when one needs your attention.</p>}
    <div className={`frontier-layout${lead && rest.length ? ' has-lead' : ''}`}>
      {lead && <FrontierLead props={props} goal={lead} count={active.length} />}
      {rest.length > 0 && <div className="frontier-list">
        {rest.map((goal, index) => <FrontierRow key={goal.node.id} props={props} goal={goal} lane="active" index={index + 1} count={active.length} />)}
      </div>}
    </div>
    <Queue props={props} goals={queue} />
  </section>
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
    {props.editMode && <div className="edit-toolbar"><p>Add a goal under any direction.</p><button className="subtle-button" onClick={() => props.onOpenEditor()}><Plus aria-hidden="true" /> New goal</button></div>}
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

function EditRow({ props, parent, node, index, total }: { props: CompassViewProps; parent: GoalNode; node: GoalNode; index: number; total: number }) {
  const visible = parent.visibleChildIds.includes(node.id)
  const full = parent.visibleChildIds.length >= 5
  return <div className="edit-row" aria-label={`Edit ${node.title}`}>
    <button className="icon-button" title={visible ? 'Hide from view' : 'Show in view'} aria-label={`${visible ? 'Hide' : 'Show'} ${node.title} ${visible ? 'from' : 'in'} view`} aria-pressed={visible} disabled={props.busy || (!visible && full)} onClick={() => props.onToggleVisible(parent.id, node.id)}>{visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</button>
    <button className="icon-button" title="Move up" aria-label={`Move ${node.title} up`} disabled={index === 0 || props.busy} onClick={() => props.onReorder(node.id, -1)}><ArrowUp aria-hidden="true" /></button>
    <button className="icon-button" title="Move down" aria-label={`Move ${node.title} down`} disabled={index === total - 1 || props.busy} onClick={() => props.onReorder(node.id, 1)}><ArrowDown aria-hidden="true" /></button>
  </div>
}

function PageControls({ page, total, label, onPage }: { page: number; total: number; label: string; onPage: (page: number) => void }) {
  if (total < 2) return null
  const prefix = label === 'goal' ? '' : `${label} `
  return <nav className="pagination" aria-label={`${label} pages`}>
    <button className="subtle-button" aria-label={`Previous ${prefix}page`} disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</button>
    <span aria-live="polite">Page {page + 1} of {total}</span>
    <button className="subtle-button" aria-label={`Next ${prefix}page`} disabled={page === total - 1} onClick={() => onPage(page + 1)}>Next</button>
  </nav>
}

function ChildList({ props, node }: { props: CompassViewProps; node: GoalNode }) {
  const children = activeChildren(props.map, node.id)
  const archived = node.childrenIds.map((id) => props.map.nodes[id]).filter((child): child is GoalNode => Boolean(child?.archived))
  const [showAll, setShowAll] = useState(false)
  const [page, setPage] = useState(0)
  const [archivedPage, setArchivedPage] = useState(0)
  const allMode = props.editMode || showAll
  const totalPages = Math.max(1, Math.ceil(children.length / 5))
  const currentPage = Math.min(page, totalPages - 1)
  const totalArchivedPages = Math.max(1, Math.ceil(archived.length / 5))
  const currentArchivedPage = Math.min(archivedPage, totalArchivedPages - 1)
  const shown = allMode ? children.slice(currentPage * 5, currentPage * 5 + 5) : node.visibleChildIds.map((id) => props.map.nodes[id]).filter((child): child is GoalNode => Boolean(child && !child.archived)).slice(0, 5)
  if (!children.length && !props.editMode) return null
  return <section className="content-section" aria-labelledby="goals-title">
    <h2 id="goals-title">{node.id === ROOT_ID ? 'Directions' : 'Goals in view'}</h2>
    <div className={`goal-list${props.editMode ? ' editing' : ''}`}>{shown.map((child, index) => <div className="frontier-row" key={child.id}>
      <button className="goal-row" onClick={() => props.onSelect(child.id)}>
        <span className="goal-row-main"><span className="goal-row-title">{child.title}</span>{(child.description || child.current) && <span className="goal-row-detail">{child.description || child.current}</span>}<LabelPills labels={child.labels} /></span>
        <ArrowRight aria-hidden="true" />
      </button>
      {props.editMode && <EditRow props={props} parent={node} node={child} index={currentPage * 5 + index} total={children.length} />}
    </div>)}</div>
    {!children.length && <p className="empty-note">Nothing here yet. A single meaningful goal is enough.</p>}
    {!props.editMode && children.length > node.visibleChildIds.length && <div className="list-footer"><button className="text-button" onClick={() => { setShowAll(!showAll); setPage(0) }}>{showAll ? 'Show less' : `All goals (${children.length})`} <ArrowRight aria-hidden="true" /></button></div>}
    {allMode && <PageControls page={currentPage} total={totalPages} label="goal" onPage={setPage} />}
    {props.editMode && archived.length > 0 && <div className="archived-section"><h3>Archived</h3>{archived.slice(currentArchivedPage * 5, currentArchivedPage * 5 + 5).map((child) => <div className="archived-row" key={child.id}><span>{child.title}</span><span className="archived-actions"><button className="text-button" onClick={() => props.onRestore(child.id)}>Restore</button><button className="text-button danger" aria-label={`Delete ${child.title}`} onClick={() => props.onDelete(child.id)}>Delete</button></span></div>)}<PageControls page={currentArchivedPage} total={totalArchivedPages} label="archived" onPage={setArchivedPage} /></div>}
    {props.editMode && <div className="list-footer"><button className="text-button" onClick={() => props.onOpenEditor()}><Plus aria-hidden="true" /> Add goal</button></div>}
  </section>
}

function Annotations({ node }: { node: GoalNode }) {
  const hasProgress = Boolean(node.current || node.target || node.milestones?.length)
  const hasOther = Boolean(node.reminders?.length || node.note)
  const nextMilestoneIndex = node.milestones?.findIndex((item) => !item.done) ?? -1
  if (!hasProgress && !hasOther) return null
  return <aside aria-label="Goal details">
    {hasProgress && <section className="content-section"><h2>Progress</h2><div className="annotation-grid">
      {node.current && <div className="annotation-block"><p className="annotation-label">Current</p><p className="annotation-value">{node.current}</p></div>}
      {node.milestones?.length ? <div className="annotation-block"><p className="annotation-label">Milestones</p><ol className="milestone-list">{node.milestones.map((milestone, index) => <li className={milestone.done ? 'done' : index === nextMilestoneIndex ? 'current' : ''} key={milestone.id}>{milestone.title}</li>)}</ol></div> : null}
      {node.target && <div className="annotation-block"><p className="annotation-label">Target</p><p className="annotation-value">{node.target}</p></div>}
    </div></section>}
    {hasOther && <section className="content-section"><h2>Remember</h2>
      {node.reminders?.length ? <ul className="reminder-list">{node.reminders.map((reminder, index) => <li key={`${index}-${reminder}`}>{reminder}</li>)}</ul> : null}
      {node.note && <blockquote className="note-quote">{node.note}</blockquote>}
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
  return <main className="page" id="main-content">
    <Breadcrumb map={props.map} node={node} onSelect={props.onSelect} />
    <div className="focus-header">
      <div className="focus-kicker" data-tone={toneById[cluster?.id ?? 'understand']}><span className="alive-dot" /><span className="eyebrow">{isProtected ? 'Direction' : 'Goal in focus'}</span></div>
      <h1 className="detail-title">{node.title}</h1>
      {node.description && <p className="detail-description">{node.description}</p>}
      <div className="focus-meta"><LabelPills labels={node.labels} />{cluster && !isProtected && <button className="relation-chip" onClick={() => props.onSelect(cluster.id)}>{cluster.title}</button>}{secondary.map((item) => <button className="relation-chip secondary" onClick={() => props.onSelect(item.id)} key={item.id}>Also {item.title}</button>)}</div>
      {props.editMode && <div className="focus-actions">
        {node.id !== ROOT_ID && <button className="subtle-button" onClick={() => props.onOpenLabelEditor(node.id)}><Tag aria-hidden="true" /> Edit labels</button>}
        {!isProtected && <button className="subtle-button" onClick={() => props.onOpenEditor(node.id)}><Pencil aria-hidden="true" /> Edit goal</button>}
        <button className="subtle-button" onClick={() => props.onOpenEditor()}><Plus aria-hidden="true" /> Add within</button>
        {!isProtected && <select aria-label="Priority" value={lane ?? ''} onChange={(event) => props.onPlace(node.id, (event.target.value || null) as FrontierLane | null)}>
          <option value="">Not prioritised</option><option value="queue">Queue</option>
          <option value="active" disabled={activeFull && lane !== 'active'}>{activeFull && lane !== 'active' ? 'Active (full)' : 'Active'}</option>
        </select>}
        {!isProtected && <button className="subtle-button" onClick={() => props.onOpenMerge(node.id)}>Merge</button>}
        {!isProtected && <button className="subtle-button danger" onClick={() => props.onArchive(node.id)}>Archive</button>}
        {!isProtected && <button className="subtle-button danger" onClick={() => props.onDelete(node.id)}><Trash2 aria-hidden="true" /> Delete</button>}
      </div>}
    </div>
    <div className={`focus-layout${isLeaf && !props.editMode ? ' leaf' : ''}`}><ChildList key={node.id} props={props} node={node} /><Annotations node={node} /></div>
  </main>
}

export function CompassView(props: CompassViewProps) {
  const node = props.selectedId ? props.map.nodes[props.selectedId] : undefined
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a><Header {...props} />
    {node && !node.archived ? <Focus props={props} node={node} /> : <Overview props={props} />}
  </div>
}
