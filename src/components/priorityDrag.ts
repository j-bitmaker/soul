import type { FrontierLane } from '../domain/types'

export interface Lanes { active: string[]; queue: string[] }

export const laneDropId = (lane: FrontierLane): string => `lane:${lane}`

function laneFromDropId(id: string): FrontierLane | null {
  return id === laneDropId('active') ? 'active' : id === laneDropId('queue') ? 'queue' : null
}

/**
 * Where a dragged goal lands: its lane and final position in that lane.
 * Over a goal it takes that goal's place (moving within a lane) or goes in front of it (coming from
 * the other lane); over an empty part of a lane it goes to the end. Returns null for a no-op.
 */
export function dropTarget(lanes: Lanes, activeId: string, overId: string | null): { lane: FrontierLane; index: number } | null {
  if (!overId || overId === activeId) return null
  const overLane = laneFromDropId(overId)
  let lane: FrontierLane
  let index: number
  if (overLane) {
    lane = overLane
    index = lanes[lane].filter((id) => id !== activeId).length
  } else if (lanes.active.includes(overId)) {
    lane = 'active'
    index = lanes.active.indexOf(overId)
  } else if (lanes.queue.includes(overId)) {
    lane = 'queue'
    index = lanes.queue.indexOf(overId)
  } else {
    return null
  }
  if (lanes[lane].indexOf(activeId) === index) return null
  return { lane, index }
}
