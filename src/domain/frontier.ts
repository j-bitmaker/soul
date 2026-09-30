import { MAX_ACTIVE, type FrontierEntry, type FrontierLane } from './types'

type Loose = { nodeId: string; status: string }

function build(active: string[], queue: string[]): FrontierEntry[] {
  return [
    ...active.map((nodeId): FrontierEntry => ({ nodeId, status: 'active' })),
    ...queue.map((nodeId): FrontierEntry => ({ nodeId, status: 'queued' })),
  ]
}

export function activeIds(frontier: readonly Loose[]): string[] {
  return frontier.filter((entry) => entry.status !== 'queued').map((entry) => entry.nodeId)
}

export function queuedIds(frontier: readonly Loose[]): string[] {
  return frontier.filter((entry) => entry.status === 'queued').map((entry) => entry.nodeId)
}

/** Keeps the given order and puts the Active lane before the Queue. Legacy statuses count as active. */
export function normalizeFrontier(frontier: readonly Loose[]): FrontierEntry[] {
  return build(activeIds(frontier), queuedIds(frontier))
}

const LEGACY_RANK: Record<string, number> = { primary: 0, active: 1, maintain: 2 }

/** Old maps ranked Active entries by status; turn that ranking into an order. */
export function fromLegacyOrder(frontier: readonly Loose[]): FrontierEntry[] {
  const active = frontier.filter((entry) => entry.status !== 'queued')
    .sort((left, right) => (LEGACY_RANK[left.status] ?? 3) - (LEGACY_RANK[right.status] ?? 3))
  return build(active.map((entry) => entry.nodeId), queuedIds(frontier))
}

export type WhenFull = 'bump' | 'reject'

/**
 * Puts a goal into a lane at a final position, or removes it (lane null).
 * A full Active lane either pushes its previous last goal to the front of the Queue ('bump')
 * or refuses the move ('reject').
 */
export function placeEntry(frontier: readonly Loose[], id: string, lane: FrontierLane | null, index?: number,
  whenFull: WhenFull = 'bump'): FrontierEntry[] {
  const rest = frontier.filter((entry) => entry.nodeId !== id)
  const active = activeIds(rest)
  const queue = queuedIds(rest)
  if (lane === 'active' && whenFull === 'reject' && active.length >= MAX_ACTIVE) {
    throw new Error(`Active holds at most ${MAX_ACTIVE} goals`)
  }
  if (lane === 'active') {
    const at = Math.max(0, Math.min(index ?? active.length, active.length, MAX_ACTIVE - 1))
    active.splice(at, 0, id)
    if (active.length > MAX_ACTIVE) queue.unshift(active.pop() as string)
  } else if (lane === 'queue') {
    queue.splice(Math.max(0, Math.min(index ?? queue.length, queue.length)), 0, id)
  }
  return build(active, queue)
}
