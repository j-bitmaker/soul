import { useState } from 'react'
import { Compass } from 'lucide-react'
import type { GoalMap, GoalNode } from '../domain/types'
import { CLUSTER_IDS, WARMTH_MAX } from '../domain/types'
import { toneById } from './goalView'
import { ORBIT, orbitLayout, type OrbitLink } from './orbitGeometry'
import { needsAttention, warmthColor, warmthVars, warmthWord } from './warmth'
import { WarmthMeter } from './WarmthMeter'

export type DirectionsView = 'cards' | 'orbit'

const STORAGE_KEY = 'soul-directions-view'

export function readDirectionsView(): DirectionsView {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'orbit' ? 'orbit' : 'cards'
  } catch {
    return 'cards'
  }
}

export function writeDirectionsView(view: DirectionsView): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, view)
  } catch {
    // the choice simply is not remembered
  }
}

/** Cards or Orbit: how the three directions are shown. */
export function DirectionsSwitch({ view, onChange }: { view: DirectionsView; onChange: (view: DirectionsView) => void }) {
  return <div className="segmented" role="group" aria-label="How to show the directions">
    {(['cards', 'orbit'] as const).map((option) => <button key={option} type="button" aria-pressed={view === option} onClick={() => onChange(option)}>
      {option === 'cards' ? 'Cards' : 'Orbit'}
    </button>)}
  </div>
}

const LAYOUT = orbitLayout()
/** The directions' own colours, used until a direction has a warmth value. */
const OWN_COLOURS = ['var(--forest)', 'var(--rust)', 'var(--gold)'] as const
const percent = (value: number, total: number): string => `${((value / total) * 100).toFixed(3)}%`

function Arrowheads({ colours }: { colours: readonly string[] }) {
  return <>
    <marker id="orbit-arrow-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M1 1 L9 5 L1 9" className="orbit-head orbit-head-muted" />
    </marker>
    {colours.map((colour, index) => <marker key={index} id={`orbit-arrow-${index}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
      <path d="M1 1 L9 5 L1 9" className="orbit-head" style={{ stroke: colour }} />
    </marker>)}
    {LAYOUT.arcs.map((arc, index) => <linearGradient key={index} id={`orbit-arc-${index}`} gradientUnits="userSpaceOnUse"
      x1={arc.start.x} y1={arc.start.y} x2={arc.end.x} y2={arc.end.y}>
      <stop offset="0" style={{ stopColor: colours[arc.ends[0]] }} />
      <stop offset="1" style={{ stopColor: colours[arc.ends[1]] }} />
    </linearGradient>)}
  </>
}

function lit(link: OrbitLink, focus: number | null): string {
  if (focus === null) return ''
  return link.ends.includes(focus) ? ' is-lit' : ' is-dim'
}

/**
 * The directions on a ring around Soul. Soul is joined to each direction by a two-way line, and each
 * direction leads to the next by a curved arrow (Understand, Create, Self-Mastery, and back). Focusing
 * or pointing at a direction lights its own lines. The diagram is decoration: the nodes are real buttons.
 */
export function OrbitView({ map, onSelect, canEdit = false, busy, onWarmth }: {
  map: GoalMap
  onSelect: (id: string) => void
  canEdit?: boolean
  busy?: boolean
  /** Sets (or clears, with null) a direction's warmth. */
  onWarmth?: (id: string, warmth: number | null) => void
}) {
  const [focus, setFocus] = useState<number | null>(null)
  const directions = CLUSTER_IDS.map((id) => map.nodes[id]).filter((node): node is GoalNode => Boolean(node))
  const colours = CLUSTER_IDS.map((id, index) => {
    const warmth = map.nodes[id]?.warmth
    return warmth === undefined ? OWN_COLOURS[index] : warmthColor(warmth)
  })
  const showPanel = canEdit || directions.some((node) => node.warmth !== undefined)
  return <><div className="orbit" data-focus={focus ?? undefined}>
    <svg className="orbit-arrows" viewBox={`0 0 ${ORBIT.width} ${ORBIT.height}`} aria-hidden="true" focusable="false">
      <defs><Arrowheads colours={colours} /></defs>
      <circle className="orbit-ring" cx={ORBIT.cx} cy={ORBIT.cy} r={ORBIT.radius} />
      {LAYOUT.spokes.map((spoke, index) => <path key={`spoke-${index}`} d={spoke.d} markerStart="url(#orbit-arrow-muted)" markerEnd="url(#orbit-arrow-muted)"
        className={`orbit-link orbit-spoke${lit(spoke, focus)}`} />)}
      {LAYOUT.arcs.map((arc, index) => <path key={`arc-${index}`} d={arc.d} stroke={`url(#orbit-arc-${index})`} markerEnd={`url(#orbit-arrow-${arc.ends[1]})`}
        className={`orbit-link orbit-arc${lit(arc, focus)}`} />)}
    </svg>
    <div className="orbit-soul" style={{ left: percent(ORBIT.cx, ORBIT.width), top: percent(ORBIT.cy, ORBIT.height), width: percent(ORBIT.soulRadius * 2, ORBIT.width) }}>
      <Compass aria-hidden="true" /><span>Soul</span>
    </div>
    {CLUSTER_IDS.map((id, index) => {
      const node = map.nodes[id]
      const at = LAYOUT.nodes[index]
      return node && <button key={id} type="button" className="orbit-node" data-tone={toneById[id]} data-warm={node.warmth === undefined ? undefined : ''} onClick={() => onSelect(id)}
        aria-describedby={node.warmth === undefined ? undefined : `orbit-warmth-${id}`}
        style={{ left: percent(at.x, ORBIT.width), top: percent(at.y, ORBIT.height), width: percent(ORBIT.nodeWidth, ORBIT.width), height: percent(ORBIT.nodeHeight, ORBIT.height), ...warmthVars(node.warmth) }}
        onMouseEnter={() => setFocus(index)} onMouseLeave={() => setFocus(null)} onFocus={() => setFocus(index)} onBlur={() => setFocus(null)}>
        <span>{node.title}</span>
        {node.warmth !== undefined && <span className="orbit-heat" aria-hidden="true">{node.warmth}</span>}
      </button>
    })}
    {directions.map((node) => node.warmth !== undefined &&
      <span key={node.id} id={`orbit-warmth-${node.id}`} className="visually-hidden">Warmth {node.warmth} of {WARMTH_MAX}, {warmthWord(node.warmth)}{needsAttention(node.warmth) ? ', needs attention' : ''}</span>)}
    <p className="visually-hidden">Soul holds the three directions. Each direction leads to the next: Understand, Create, Self-Mastery, and back again.</p>
  </div>
  {showPanel && <div className="orbit-warmth">
    {directions.map((node) => <div className="orbit-warmth-row" key={node.id} data-warm={node.warmth === undefined ? undefined : ''} style={warmthVars(node.warmth)}>
      <p className="orbit-warmth-title">{node.title}</p>
      <WarmthMeter title={node.title} value={node.warmth} editable={canEdit} disabled={busy} onChange={(warmth) => onWarmth?.(node.id, warmth)} />
    </div>)}
  </div>}
  </>
}
