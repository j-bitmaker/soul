import { normalizeFrontier, placeEntry, type WhenFull } from './frontier'
import { CLUSTER_IDS, ROOT_ID, type FrontierLane, type GoalMap, type GoalNode, type Label } from './types'

function requireNode(map: GoalMap, id: string): GoalNode {
  const node = map.nodes[id]
  if (!node) throw new Error(`Unknown node: ${id}`)
  return node
}

function requireGoal(map: GoalMap, id: string): GoalNode {
  const node = requireNode(map, id)
  if (id === ROOT_ID || CLUSTER_IDS.includes(id as typeof CLUSTER_IDS[number])) {
    throw new Error('Soul and clusters are permanent')
  }
  return node
}

function replaceNode(map: GoalMap, node: GoalNode): GoalMap {
  return { ...map, nodes: { ...map.nodes, [node.id]: node } }
}

function isWithin(map: GoalMap, id: string, ancestorId: string): boolean {
  let cursor: string | null = id
  while (cursor) {
    if (cursor === ancestorId) return true
    cursor = requireNode(map, cursor).parentId
  }
  return false
}

export function getVisibleChildren(map: GoalMap, parentId: string): GoalNode[] {
  const parent = requireNode(map, parentId)
  if (parent.archived) return []
  return parent.visibleChildIds.slice(0, 5).map((id) => requireNode(map, id)).filter((node) => !node.archived)
}

export function addGoal(map: GoalMap, input: { id: string; title: string; parentId: string }): GoalMap {
  const title = input.title.trim()
  if (!title) throw new Error('Title is required')
  if (!input.id || map.nodes[input.id]) throw new Error('Node ID must be unique')
  const parent = requireNode(map, input.parentId)
  if (parent.id === ROOT_ID || parent.archived) throw new Error('Choose an active cluster or goal')
  const node: GoalNode = {
    id: input.id, title, parentId: parent.id, childrenIds: [], visibleChildIds: [], secondaryIds: [],
  }
  const nextParent = {
    ...parent,
    childrenIds: [...parent.childrenIds, node.id],
    visibleChildIds: parent.visibleChildIds.length < 5 ? [...parent.visibleChildIds, node.id] : parent.visibleChildIds,
  }
  return { ...map, nodes: { ...map.nodes, [parent.id]: nextParent, [node.id]: node } }
}

/**
 * Puts a goal into the Active lane or the Queue at a final position, or removes it (lane null).
 * The first active goal is the Primary. A full Active lane sends its previous last goal to the front of the Queue
 * unless whenFull is 'reject'.
 */
export function placeInFrontier(map: GoalMap, id: string, lane: FrontierLane | null, index?: number,
  whenFull?: WhenFull): GoalMap {
  const node = requireGoal(map, id)
  if (lane && node.archived) throw new Error('Archived goals cannot enter the frontier')
  return { ...map, frontier: placeEntry(map.frontier, id, lane, index, whenFull) }
}

export function queueGoal(map: GoalMap, input: { id: string; title: string; parentId: string }): GoalMap {
  return placeInFrontier(addGoal(map, input), input.id, 'queue')
}

export function moveGoal(map: GoalMap, id: string, parentId: string): GoalMap {
  const node = requireGoal(map, id)
  const destination = requireNode(map, parentId)
  if (destination.id === ROOT_ID || destination.archived) throw new Error('Choose an active destination')
  if (isWithin(map, parentId, id)) throw new Error('Moving this goal would create a cycle')
  if (node.parentId === parentId) return map
  const source = requireNode(map, node.parentId as string)
  const nextSource = { ...source,
    childrenIds: source.childrenIds.filter((childId) => childId !== id),
    visibleChildIds: source.visibleChildIds.filter((childId) => childId !== id) }
  const nextDestination = { ...destination,
    childrenIds: [...destination.childrenIds, id],
    visibleChildIds: destination.visibleChildIds.length < 5 ? [...destination.visibleChildIds, id] : destination.visibleChildIds }
  return { ...map, nodes: { ...map.nodes, [source.id]: nextSource,
    [destination.id]: nextDestination, [id]: { ...node, parentId } } }
}

export function setSecondaryLinks(map: GoalMap, id: string, links: string[]): GoalMap {
  const node = requireGoal(map, id)
  const unique = [...new Set(links)]
  if (unique.includes(id)) throw new Error('A goal cannot link to itself')
  unique.forEach((link) => requireNode(map, link))
  return replaceNode(map, { ...node, secondaryIds: unique })
}

export function setVisibleChildren(map: GoalMap, parentId: string, ids: string[]): GoalMap {
  const parent = requireNode(map, parentId)
  if (ids.length > 5 || new Set(ids).size !== ids.length) throw new Error('Show at most five distinct goals')
  if (ids.some((id) => !parent.childrenIds.includes(id) || requireNode(map, id).archived)) {
    throw new Error('Visible goals must be active direct children')
  }
  return replaceNode(map, { ...parent, visibleChildIds: [...ids] })
}

export function archiveGoal(map: GoalMap, id: string): GoalMap {
  const node = requireGoal(map, id)
  const parent = requireNode(map, node.parentId as string)
  return { ...map,
    nodes: { ...map.nodes, [id]: { ...node, archived: true },
      [parent.id]: { ...parent, visibleChildIds: parent.visibleChildIds.filter((childId) => childId !== id) } },
    frontier: normalizeFrontier(map.frontier.filter((entry) => !isWithin(map, entry.nodeId, id))),
  }
}

export function restoreGoal(map: GoalMap, id: string): GoalMap {
  const node = requireGoal(map, id)
  if (!node.archived) return map
  const parent = requireNode(map, node.parentId as string)
  if (parent.archived) throw new Error('Restore the parent first')
  const visibleChildIds = parent.visibleChildIds.length < 5
    ? [...parent.visibleChildIds, id] : parent.visibleChildIds
  return { ...map, nodes: { ...map.nodes, [id]: { ...node, archived: false },
    [parent.id]: { ...parent, visibleChildIds } } }
}

export function toggleVisibleChild(map: GoalMap, parentId: string, childId: string): GoalMap {
  const parent = requireNode(map, parentId)
  if (!parent.childrenIds.includes(childId)) throw new Error('Goal is not a direct child')
  const shown = parent.visibleChildIds.includes(childId)
  const ids = shown ? parent.visibleChildIds.filter((id) => id !== childId) : [...parent.visibleChildIds, childId]
  return setVisibleChildren(map, parentId, ids)
}

function swap(items: string[], index: number, direction: -1 | 1): string[] {
  const other = index + direction
  if (index < 0 || other < 0 || other >= items.length) return items
  const next = [...items]
  ;[next[index], next[other]] = [next[other], next[index]]
  return next
}

export function reorderGoal(map: GoalMap, id: string, direction: -1 | 1): GoalMap {
  const node = requireGoal(map, id)
  const parent = requireNode(map, node.parentId as string)
  const index = parent.childrenIds.indexOf(id)
  const siblingId = parent.childrenIds[index + direction] ?? ''
  const childrenIds = swap(parent.childrenIds, index, direction)
  const visibleIndex = parent.visibleChildIds.indexOf(id)
  const siblingVisibleIndex = parent.visibleChildIds.indexOf(siblingId)
  const visibleChildIds = visibleIndex >= 0 && siblingVisibleIndex >= 0
    ? parent.visibleChildIds.map((childId) => childId === id ? siblingId : childId === siblingId ? id : childId)
    : parent.visibleChildIds
  return replaceNode(map, { ...parent, childrenIds, visibleChildIds })
}

function mergedNote(source: GoalNode, target: GoalNode): string {
  const sourceDetails = [source.description, source.note, source.current && `Current: ${source.current}`,
    source.target && `Target: ${source.target}`].filter(Boolean).join('\n')
  return [target.note, `Merged from ${source.title}${sourceDetails ? `:\n${sourceDetails}` : ''}`].filter(Boolean).join('\n\n')
}

function mergedLabels(source: GoalNode, target: GoalNode): Label[] {
  const labels = [...(target.labels ?? [])]
  const ids = new Set(labels.map((item) => item.id))
  const texts = new Set(labels.map((item) => item.text))
  for (const item of source.labels ?? []) {
    if (texts.has(item.text)) continue
    let id = item.id
    if (ids.has(id)) {
      const prefix = `${source.id}-${id}`
      id = prefix
      for (let suffix = 2; ids.has(id); suffix += 1) id = `${prefix}-${suffix}`
    }
    labels.push({ ...item, id })
    ids.add(id)
    texts.add(item.text)
  }
  return labels
}

function mergedTarget(source: GoalNode, target: GoalNode): GoalNode {
  const labels = mergedLabels(source, target)
  const milestones = [...(target.milestones ?? []), ...(source.milestones ?? []).map((item) => ({
    ...item, id: `${source.id}-${item.id}`,
  }))]
  return { ...target,
    childrenIds: [...target.childrenIds, ...source.childrenIds],
    visibleChildIds: [...target.visibleChildIds, ...source.visibleChildIds].slice(0, 5),
    secondaryIds: [...new Set([...target.secondaryIds, ...source.secondaryIds])].filter(
      (id) => id !== source.id && id !== target.id),
    current: target.current ?? source.current, target: target.target ?? source.target,
    milestones, labels: labels.length ? labels : undefined,
    reminders: [...new Set([...(target.reminders ?? []), ...(source.reminders ?? [])])],
    note: mergedNote(source, target),
  }
}

export function mergeGoals(map: GoalMap, sourceId: string, targetId: string): GoalMap {
  const source = requireGoal(map, sourceId)
  const target = requireGoal(map, targetId)
  if (sourceId === targetId || isWithin(map, sourceId, targetId) || isWithin(map, targetId, sourceId)) {
    throw new Error('Related goals cannot be merged')
  }
  const sourceParent = requireNode(map, source.parentId as string)
  const nodes = Object.fromEntries(Object.entries(map.nodes).filter(([id]) => id !== sourceId).map(([id, node]) => {
    if (id === targetId) return [id, mergedTarget(source, target)]
    if (id === sourceParent.id) return [id, { ...node,
      childrenIds: node.childrenIds.filter((childId) => childId !== sourceId),
      visibleChildIds: node.visibleChildIds.filter((childId) => childId !== sourceId) }]
    return [id, { ...node,
      parentId: node.parentId === sourceId ? targetId : node.parentId,
      secondaryIds: [...new Set(node.secondaryIds.map((link) => link === sourceId ? targetId : link))]
        .filter((link) => link !== id) }]
  })) as Record<string, GoalNode>
  // The merged goal keeps the earlier place of the two and the higher lane (Active beats Queue).
  const involved = map.frontier.filter((entry) => entry.nodeId === sourceId || entry.nodeId === targetId)
  const firstIndex = map.frontier.findIndex((entry) => entry.nodeId === sourceId || entry.nodeId === targetId)
  const status = involved.some((entry) => entry.status !== 'queued') ? 'active' : 'queued'
  const frontier = normalizeFrontier(map.frontier.flatMap((entry, index) => {
    if (entry.nodeId !== sourceId && entry.nodeId !== targetId) return [entry]
    return index === firstIndex ? [{ nodeId: targetId, status }] : []
  }))
  return { ...map, nodes, frontier }
}
