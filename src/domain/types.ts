export type FrontierStatus = 'primary' | 'active' | 'maintain'

export interface Milestone {
  id: string
  title: string
  done: boolean
}

export interface Routine {
  id: string
  title: string
  cadence?: string
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
  routines?: Routine[]
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
