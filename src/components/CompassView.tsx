import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, ChevronRight, Compass, Download, Ellipsis, Eye, EyeOff, LogIn, LogOut, Pencil, Plus, Upload, X } from 'lucide-react'
import type { FrontierStatus, GoalMap, GoalNode } from '../domain/types'
import { CLUSTER_IDS, ROOT_ID } from '../domain/types'

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
  onOpenRoutineEditor: (id: string) => void
  onSetFrontier: (id: string, status: FrontierStatus | null) => void
  onReorder: (id: string, direction: -1 | 1) => void
  onToggleVisible: (parentId: string, childId: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onOpenMerge: (id: string) => void
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

function statusFor(map: GoalMap, id: string): FrontierStatus | null {
  return map.frontier.find((entry) => entry.nodeId === id)?.status ?? null
}

const statusRank: Record<FrontierStatus, number> = { primary: 0, active: 1, maintain: 2 }

function priorityRank(status: FrontierStatus | null): number {
  return status ? statusRank[status] : 3
}

function priorityChildren(map: GoalMap, id: string): GoalNode[] {
  return activeChildren(map, id).sort((left, right) =>
    priorityRank(statusFor(map, left.id)) - priorityRank(statusFor(map, right.id)))
}

function priorityFrontier(map: GoalMap): GoalMap['frontier'] {
  return [...map.frontier].sort((left, right) =>
    priorityRank(left.status) - priorityRank(right.status))
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

function RoutineList({ node, compact = false }: { node: GoalNode; compact?: boolean }) {
  if (!node.routines?.length) return null
  return <section className={compact ? 'cluster-routines' : 'content-section routine-section'} aria-label={`Routine for ${node.title}`}>
    {compact ? <h4>Routine</h4> : <h2>Routine</h2>}
    <ul className="routine-list">{node.routines.map((routine) => <li key={routine.id}>
      <span>{routine.title}</span>{routine.cadence && <span className="routine-cadence">{routine.cadence}</span>}
    </li>)}</ul>
  </section>
}

function ClusterCard({ node, map, onSelect }: { node: GoalNode; map: GoalMap; onSelect: (id: string) => void }) {
  const goals = priorityChildren(map, node.id)
  return <article className="cluster-card" data-tone={toneById[node.id]}>
    <h3 className="cluster-title"><button className="cluster-open" onClick={() => onSelect(node.id)}>
      <span>{node.title}</span><ArrowRight className="cluster-arrow" aria-hidden="true" />
    </button></h3>
    {goals.length ? <ul className="cluster-goals" aria-label={`Goals in ${node.title}`}>{goals.map((goal) =>
      <li key={goal.id}><button className="cluster-goal" onClick={() => onSelect(goal.id)}>
        <span>{goal.title}</span>{statusFor(map, goal.id) && <span className="frontier-status" data-status={statusFor(map, goal.id)}>{statusFor(map, goal.id)}</span>}
      </button></li>)}</ul> : <p className="cluster-empty">No goals yet</p>}
    <RoutineList node={node} compact />
  </article>
}

function Frontier({ props }: { props: CompassViewProps }) {
  return <section className="frontier-section" aria-labelledby="frontier-title">
    <div className="section-heading"><h2 id="frontier-title">Active Frontier</h2><p>What deserves attention now</p></div>
    <div className="frontier-list">
      {priorityFrontier(props.map).map((entry, index) => {
        const node = props.map.nodes[entry.nodeId]
        if (!node || node.archived) return null
        return <div className="frontier-row" key={entry.nodeId}>
          <button className="frontier-open" onClick={() => props.onSelect(node.id)}>
            <span className="frontier-index">0{index + 1}</span>
            <span className="frontier-main"><span className="frontier-title">{node.title}</span><span className="frontier-context">{nearestCluster(props.map, node.id)?.title ?? 'Soul'}</span></span>
            <span className="frontier-status" data-status={entry.status}>{entry.status}</span>
            <ChevronRight className="frontier-chevron" aria-hidden="true" />
          </button>
        </div>
      })}
      {!props.map.frontier.length && <p className="empty-note">No current focus. Add a goal when one needs your attention.</p>}
    </div>
  </section>
}

function Overview({ props }: { props: CompassViewProps }) {
  return <main className="page" id="main-content">
    <section className="orientation" aria-labelledby="soul-title">
      <div className="eyebrow">A mental compass</div>
      <h1 className="soul-title" id="soul-title">Soul</h1>
      <p className="soul-subtitle">The orientation above every goal.</p>
      <div className="axis" aria-hidden="true" />
    </section>
    <section aria-labelledby="directions-title">
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
  return <section className="content-section" aria-labelledby="goals-title">
    <h2 id="goals-title">{node.id === ROOT_ID ? 'Directions' : 'Goals in view'}</h2>
    <div className={`goal-list${props.editMode ? ' editing' : ''}`}>{shown.map((child, index) => <div className="frontier-row" key={child.id}>
      <button className="goal-row" onClick={() => props.onSelect(child.id)}>
        <span className="goal-row-main"><span className="goal-row-title">{child.title}</span><span className="goal-row-detail">{child.description || child.current || 'Open goal'}</span></span>
        {statusFor(props.map, child.id) && <span className="frontier-status" data-status={statusFor(props.map, child.id)}>{statusFor(props.map, child.id)}</span>}
        <ArrowRight aria-hidden="true" />
      </button>
      {props.editMode && <EditRow props={props} parent={node} node={child} index={currentPage * 5 + index} total={children.length} />}
    </div>)}</div>
    {!children.length && <p className="empty-note">Nothing here yet. A single meaningful goal is enough.</p>}
    {!props.editMode && children.length > node.visibleChildIds.length && <div className="list-footer"><button className="text-button" onClick={() => { setShowAll(!showAll); setPage(0) }}>{showAll ? 'Show less' : `All goals (${children.length})`} <ArrowRight aria-hidden="true" /></button></div>}
    {allMode && <PageControls page={currentPage} total={totalPages} label="goal" onPage={setPage} />}
    {props.editMode && archived.length > 0 && <div className="archived-section"><h3>Archived</h3>{archived.slice(currentArchivedPage * 5, currentArchivedPage * 5 + 5).map((child) => <div className="archived-row" key={child.id}><span>{child.title}</span><button className="text-button" onClick={() => props.onRestore(child.id)}>Restore</button></div>)}<PageControls page={currentArchivedPage} total={totalArchivedPages} label="archived" onPage={setArchivedPage} /></div>}
    {props.editMode && <div className="list-footer"><button className="text-button" onClick={() => props.onOpenEditor()}><Plus aria-hidden="true" /> Add goal</button></div>}
  </section>
}

function Annotations({ node }: { node: GoalNode }) {
  const hasProgress = Boolean(node.current || node.target || node.milestones?.length)
  const hasOther = Boolean(node.reminders?.length || node.note)
  const nextMilestoneIndex = node.milestones?.findIndex((item) => !item.done) ?? -1
  if (!hasProgress && !hasOther && !node.routines?.length) return null
  return <aside aria-label="Goal details">
    <RoutineList node={node} />
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
  const currentStatus = statusFor(props.map, node.id)
  const isProtected = node.id === ROOT_ID || CLUSTER_IDS.includes(node.id as typeof CLUSTER_IDS[number])
  return <main className="page" id="main-content">
    <Breadcrumb map={props.map} node={node} onSelect={props.onSelect} />
    <div className="focus-header">
      <div className="focus-kicker" data-tone={toneById[cluster?.id ?? 'understand']}><span className="alive-dot" /><span className="eyebrow">{isProtected ? 'Direction' : 'Goal in focus'}</span></div>
      <h1 className="detail-title">{node.title}</h1>
      {node.description && <p className="detail-description">{node.description}</p>}
      <div className="focus-meta">{currentStatus && <span className="frontier-status" data-status={currentStatus}>{currentStatus}</span>}{cluster && !isProtected && <button className="relation-chip" onClick={() => props.onSelect(cluster.id)}>{cluster.title}</button>}{secondary.map((item) => <button className="relation-chip secondary" onClick={() => props.onSelect(item.id)} key={item.id}>Also {item.title}</button>)}</div>
      {props.editMode && <div className="focus-actions">
        {isProtected && node.id !== ROOT_ID && <button className="subtle-button" onClick={() => props.onOpenRoutineEditor(node.id)}><Pencil aria-hidden="true" /> Edit routine</button>}
        {!isProtected && <button className="subtle-button" onClick={() => props.onOpenEditor(node.id)}><Pencil aria-hidden="true" /> Edit goal</button>}
        <button className="subtle-button" onClick={() => props.onOpenEditor()}><Plus aria-hidden="true" /> Add within</button>
        {!isProtected && <select aria-label="Frontier status" value={currentStatus ?? ''} onChange={(event) => props.onSetFrontier(node.id, event.target.value as FrontierStatus || null)}>
          <option value="">Outside frontier</option><option value="primary">Primary</option><option value="active">Active</option><option value="maintain">Maintain</option>
        </select>}
        {!isProtected && <button className="subtle-button" onClick={() => props.onOpenMerge(node.id)}>Merge</button>}
        {!isProtected && <button className="subtle-button danger" onClick={() => props.onArchive(node.id)}>Archive</button>}
      </div>}
    </div>
    <div className="focus-layout"><ChildList key={node.id} props={props} node={node} /><Annotations node={node} /></div>
  </main>
}

export function CompassView(props: CompassViewProps) {
  const node = props.selectedId ? props.map.nodes[props.selectedId] : undefined
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a><Header {...props} />
    {node && !node.archived ? <Focus props={props} node={node} /> : <Overview props={props} />}
  </div>
}
