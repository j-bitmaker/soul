/** Stored lane of a Frontier entry. Order decides priority; the first active entry is the Primary (derived, not stored). */
export type FrontierStatus = 'active' | 'queued'

export type FrontierLane = 'active' | 'queue'

export const MAX_ACTIVE = 5

export interface Milestone {
  id: string
  title: string
  done: boolean
}

/** A free-form note on a goal, shown as a small pill. */
export interface Label {
  id: string
  text: string
}

export interface GoalNode {
  id: string
  title: string
  parentId: string | null
  childrenIds: string[]
  visibleChildIds: string[]
  secondaryIds: string[]
  description?: string
  current?: string
  target?: string
  milestones?: Milestone[]
  labels?: Label[]
  reminders?: string[]
  note?: string
  archived?: boolean
}

export interface FrontierEntry {
  nodeId: string
  status: FrontierStatus
}

export interface GoalMap {
  schemaVersion: 1
  revision: number
  nodes: Record<string, GoalNode>
  frontier: FrontierEntry[]
}

export const ROOT_ID = 'soul'
export const CLUSTER_IDS = ['understand', 'create', 'mastery'] as const
