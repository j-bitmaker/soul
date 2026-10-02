/** Stored lane of a Frontier entry. Order decides priority; the first active entry is the Primary (derived, not stored). */
export type FrontierStatus = 'active' | 'queued'

export type FrontierLane = 'active' | 'queue'

export const MAX_ACTIVE = 5
/** How alive a direction is: a whole number from 0 (cold, needs attention) to this value (very warm). */
export const WARMTH_MAX = 10
/** The colours a goal can be tagged with, by name; the shades themselves live in the UI. */
export const GOAL_COLORS = ['red', 'orange', 'gold', 'green', 'teal', 'blue', 'indigo', 'violet', 'pink', 'slate'] as const
export type GoalColor = typeof GOAL_COLORS[number]

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
  /** Directions only: 0 (cold, needs attention) to 10 (very warm), how alive the direction is. */
  warmth?: number
  /** Goals only: a colour tag chosen from GOAL_COLORS. */
  color?: GoalColor
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
