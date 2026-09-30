import type { FrontierLane, GoalMap, GoalNode, Label } from '../domain/types'
import { CLUSTER_IDS } from '../domain/types'

export const toneById: Record<string, string> = {
  understand: 'expression', create: 'freedom', mastery: 'mastery',
}

export interface LaneGoal { node: GoalNode; cluster?: GoalNode }

export function pathTo(map: GoalMap, id: string): GoalNode[] {
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

export function nearestCluster(map: GoalMap, id: string): GoalNode | undefined {
  return pathTo(map, id).find((node) => CLUSTER_IDS.includes(node.id as typeof CLUSTER_IDS[number]))
}

export function laneOf(map: GoalMap, id: string): FrontierLane | null {
  const entry = map.frontier.find((item) => item.nodeId === id)
  return entry ? (entry.status === 'queued' ? 'queue' : 'active') : null
}

/** The goals behind a list of ids, skipping any that are missing or archived. */
export function goalsFromIds(map: GoalMap, ids: readonly string[]): LaneGoal[] {
  return ids.flatMap((id) => {
    const node = map.nodes[id]
    return node && !node.archived ? [{ node, cluster: nearestCluster(map, node.id) }] : []
  })
}

/** One quiet line of orientation for a goal: where it stands or what comes next. Text only, never a meter. */
export function orientationLine(node: GoalNode): string | undefined {
  if (node.current && node.target) return `${node.current} → ${node.target}`
  const next = node.milestones?.find((item) => !item.done)
  if (next) return `Next: ${next.title}`
  if (node.target) return `Target: ${node.target}`
  if (node.current) return `Now: ${node.current}`
  return node.description
}

/** Free-form labels as small pills. Plain spans so they can also sit inside buttons. */
export function LabelPills({ labels, className = '' }: { labels?: Label[]; className?: string }) {
  if (!labels?.length) return null
  return <span className={`label-list ${className}`.trim()}>{labels.map((label) => <span className="label-pill" key={label.id}>{label.text}</span>)}</span>
}
