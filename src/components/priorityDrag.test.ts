import { describe, expect, it } from 'vitest'
import { dropTarget, laneDropId, type Lanes } from './priorityDrag'

const lanes: Lanes = { active: ['a', 'b', 'c'], queue: ['x', 'y'] }

describe('dropTarget', () => {
  it('takes the place of the goal it is dropped on within a lane', () => {
    expect(dropTarget(lanes, 'a', 'c')).toEqual({ lane: 'active', index: 2 })
    expect(dropTarget(lanes, 'c', 'a')).toEqual({ lane: 'active', index: 0 })
    expect(dropTarget(lanes, 'y', 'x')).toEqual({ lane: 'queue', index: 0 })
  })

  it('goes in front of the goal it is dropped on in the other lane', () => {
    expect(dropTarget(lanes, 'x', 'a')).toEqual({ lane: 'active', index: 0 })
    expect(dropTarget(lanes, 'x', 'c')).toEqual({ lane: 'active', index: 2 })
    expect(dropTarget(lanes, 'b', 'y')).toEqual({ lane: 'queue', index: 1 })
  })

  it('goes to the end of a lane dropped on its empty area', () => {
    expect(dropTarget(lanes, 'x', laneDropId('active'))).toEqual({ lane: 'active', index: 3 })
    expect(dropTarget(lanes, 'a', laneDropId('queue'))).toEqual({ lane: 'queue', index: 2 })
    expect(dropTarget({ active: [], queue: ['x'] }, 'x', laneDropId('active'))).toEqual({ lane: 'active', index: 0 })
    expect(dropTarget({ active: ['a'], queue: [] }, 'a', laneDropId('queue'))).toEqual({ lane: 'queue', index: 0 })
  })

  it('does nothing when the goal would stay where it is', () => {
    expect(dropTarget(lanes, 'a', 'a')).toBeNull()
    expect(dropTarget(lanes, 'c', laneDropId('active'))).toBeNull()
    expect(dropTarget(lanes, 'y', laneDropId('queue'))).toBeNull()
    expect(dropTarget(lanes, 'a', null)).toBeNull()
    expect(dropTarget(lanes, 'a', 'unknown')).toBeNull()
  })
})
