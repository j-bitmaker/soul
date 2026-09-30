import { fromLegacyOrder } from './frontier'
import type { GoalMap } from './types'
import { CLUSTER_IDS, MAX_ACTIVE, ROOT_ID } from './types'

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid map object')
  return value as Record<string, unknown>
}

function knownFields(value: Record<string, unknown>, allowed: readonly string[]): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key))
  if (unknown) throw new Error(`Unrecognized field: ${unknown}`)
}

function strings(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Invalid ${name}`)
  }
  if (new Set(value).size !== value.length) throw new Error(`Duplicate ${name}`)
  return value
}

function optionalText(value: unknown, name: string): void {
  if (value !== undefined && typeof value !== 'string') throw new Error(`Invalid ${name}`)
}

function validateNode(id: string, value: unknown, ids: Set<string>): void {
  const node = object(value)
  knownFields(node, ['id', 'title', 'parentId', 'childrenIds', 'visibleChildIds', 'secondaryIds',
    'description', 'current', 'target', 'milestones', 'labels', 'reminders', 'note', 'archived'])
  if (node.id !== id || typeof node.title !== 'string' || !node.title.trim()) {
    throw new Error(`Invalid node ${id}`)
  }
  if (node.parentId !== null && typeof node.parentId !== 'string') throw new Error(`Invalid parent of ${id}`)
  const children = strings(node.childrenIds, 'children references')
  const visible = strings(node.visibleChildIds, 'visible references')
  const secondary = strings(node.secondaryIds, 'secondary references')
  if (visible.length > 5 || visible.some((child) => !children.includes(child))) {
    throw new Error(`Invalid visible references for ${id}`)
  }
  if ([...children, ...secondary, node.parentId].some((ref) => ref && !ids.has(ref as string))) {
    throw new Error(`Missing node reference from ${id}`)
  }
  if (secondary.includes(id)) throw new Error(`Self reference from ${id}`)
  for (const field of ['description', 'current', 'target', 'note']) optionalText(node[field], field)
  if (node.archived !== undefined && typeof node.archived !== 'boolean') throw new Error(`Invalid archived flag for ${id}`)
  if (node.reminders !== undefined) strings(node.reminders, 'reminders')
  if (node.milestones !== undefined) validateMilestones(node.milestones)
  if (node.labels !== undefined) validateLabels(node.labels)
}

function validateLabels(value: unknown): void {
  if (!Array.isArray(value)) throw new Error('Invalid labels')
  const ids = new Set<string>()
  for (const item of value) {
    const label = object(item)
    knownFields(label, ['id', 'text'])
    if (typeof label.id !== 'string' || !label.id.trim() ||
      typeof label.text !== 'string' || !label.text.trim() || ids.has(label.id)) {
      throw new Error('Invalid label')
    }
    ids.add(label.id)
  }
}

function validateMilestones(value: unknown): void {
  if (!Array.isArray(value)) throw new Error('Invalid milestones')
  const ids = new Set<string>()
  for (const item of value) {
    const milestone = object(item)
    knownFields(milestone, ['id', 'title', 'done'])
    if (typeof milestone.id !== 'string' || typeof milestone.title !== 'string' ||
      typeof milestone.done !== 'boolean' || !milestone.title.trim() || ids.has(milestone.id)) {
      throw new Error('Invalid milestone')
    }
    ids.add(milestone.id)
  }
}

function validateTree(nodes: Record<string, unknown>): void {
  for (const [id, value] of Object.entries(nodes)) {
    const node = object(value)
    for (const childId of node.childrenIds as string[]) {
      if (object(nodes[childId]).parentId !== id) throw new Error(`Inconsistent parent reference for ${childId}`)
    }
    if (id !== ROOT_ID) {
      const parent = object(nodes[node.parentId as string])
      if (!(parent.childrenIds as string[]).includes(id)) throw new Error(`Missing parent reference for ${id}`)
    }
    const visited = new Set<string>()
    let cursor: string | null = id
    while (cursor) {
      if (visited.has(cursor)) throw new Error('Placement cycle')
      visited.add(cursor)
      cursor = object(nodes[cursor]).parentId as string | null
    }
  }
}

function validateFrontier(value: unknown, nodes: Record<string, unknown>): void {
  if (!Array.isArray(value)) throw new Error('Invalid frontier')
  const seen = new Set<string>()
  let activeCount = 0
  for (const entry of value) {
    const item = object(entry)
    knownFields(item, ['nodeId', 'status'])
    if (typeof item.nodeId !== 'string' || !nodes[item.nodeId] ||
      !['active', 'queued'].includes(item.status as string) || seen.has(item.nodeId)) {
      throw new Error('Invalid frontier entry')
    }
    if ([ROOT_ID, ...CLUSTER_IDS].includes(item.nodeId)) throw new Error('Invalid frontier goal')
    if (object(nodes[item.nodeId]).archived) throw new Error('Archived frontier goal')
    if (item.status === 'active') activeCount += 1
    seen.add(item.nodeId)
  }
  if (activeCount > MAX_ACTIVE) throw new Error('Invalid frontier size')
}

export function validateMap(value: unknown): asserts value is GoalMap {
  const map = object(value)
  knownFields(map, ['schemaVersion', 'revision', 'nodes', 'frontier'])
  if (map.schemaVersion !== 1) throw new Error('Unsupported map version')
  if (!Number.isInteger(map.revision) || (map.revision as number) < 0) throw new Error('Invalid revision')
  const nodes = object(map.nodes)
  const ids = new Set(Object.keys(nodes))
  if (!ids.has(ROOT_ID) || CLUSTER_IDS.some((id) => !ids.has(id))) throw new Error('Missing Soul or cluster')
  for (const [id, node] of Object.entries(nodes)) validateNode(id, node, ids)
  if (object(nodes[ROOT_ID]).parentId !== null ||
    JSON.stringify(object(nodes[ROOT_ID]).childrenIds) !== JSON.stringify(CLUSTER_IDS)) {
    throw new Error('Soul must contain the three permanent clusters')
  }
  if (CLUSTER_IDS.some((id) => object(nodes[id]).parentId !== ROOT_ID)) throw new Error('Invalid cluster placement')
  validateTree(nodes)
  validateFrontier(map.frontier, nodes)
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Old routines become labels: "title · cadence". Malformed input is left alone so validation rejects it. */
function migrateNode(node: unknown): unknown {
  if (!isPlain(node) || !Array.isArray(node.routines)) return node
  const { routines, ...rest } = node
  const labels: { id: string; text: string }[] = Array.isArray(rest.labels) ? [...rest.labels] : []
  const ids = new Set(labels.map((label) => (isPlain(label) ? label.id : undefined)))
  for (const routine of routines) {
    if (!isPlain(routine) || typeof routine.id !== 'string' || typeof routine.title !== 'string' ||
      !routine.title.trim() || !routine.id.trim() ||
      (routine.cadence !== undefined && typeof routine.cadence !== 'string')) return node
    let id = routine.id
    for (let suffix = 2; ids.has(id); suffix += 1) id = `${routine.id}-${suffix}`
    ids.add(id)
    const cadence = typeof routine.cadence === 'string' ? routine.cadence.trim() : ''
    labels.push({ id, text: cadence ? `${routine.title.trim()} · ${cadence}` : routine.title.trim() })
  }
  return labels.length ? { ...rest, labels } : rest
}

const FRONTIER_STATUSES = ['primary', 'active', 'maintain', 'queued']

function migrateFrontier(frontier: unknown[]): unknown[] {
  const tidy = frontier.every((entry) => isPlain(entry) && typeof entry.nodeId === 'string' &&
    FRONTIER_STATUSES.includes(entry.status as string) && Object.keys(entry).length === 2)
  return tidy ? fromLegacyOrder(frontier as { nodeId: string; status: string }[]) : frontier
}

/**
 * Brings older maps to the current shape without losing anything: routines become labels and the
 * old Primary/Active/Maintain statuses become an order (the first active goal is the Primary). Pure and idempotent.
 */
export function migrateMap(value: unknown): unknown {
  if (!isPlain(value)) return value
  const map = { ...value }
  if (isPlain(map.nodes)) {
    map.nodes = Object.fromEntries(Object.entries(map.nodes).map(([id, node]) => [id, migrateNode(node)]))
  }
  if (Array.isArray(map.frontier)) map.frontier = migrateFrontier(map.frontier)
  return map
}

export function parseStoredMap(value: unknown): GoalMap {
  const migrated = migrateMap(value)
  validateMap(migrated)
  return migrated
}

export function exportMap(map: GoalMap): string {
  validateMap(map)
  return `${JSON.stringify(map, null, 2)}\n`
}

export function parseMap(json: string): GoalMap {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON')
  }
  return parseStoredMap(value)
}
