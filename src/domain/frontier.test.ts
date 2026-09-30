import { describe, expect, it } from 'vitest'
import { activeIds, fromLegacyOrder, normalizeFrontier, placeEntry, queuedIds } from './frontier'

const entries = [
  { nodeId: 'b', status: 'queued' }, { nodeId: 'a', status: 'active' }, { nodeId: 'c', status: 'active' },
]

describe('frontier lanes', () => {
  it('puts the Active lane before the Queue and keeps each lane in order', () => {
    expect(normalizeFrontier(entries)).toEqual([
      { nodeId: 'a', status: 'active' }, { nodeId: 'c', status: 'active' }, { nodeId: 'b', status: 'queued' },
    ])
    expect(activeIds(entries)).toEqual(['a', 'c'])
    expect(queuedIds(entries)).toEqual(['b'])
  })

  it('turns old statuses into an order, stably', () => {
    expect(fromLegacyOrder([
      { nodeId: 'm', status: 'maintain' }, { nodeId: 'x', status: 'active' }, { nodeId: 'y', status: 'active' },
      { nodeId: 'p', status: 'primary' }, { nodeId: 'q', status: 'queued' },
    ]).map((entry) => `${entry.nodeId}:${entry.status}`)).toEqual(['p:active', 'x:active', 'y:active', 'm:active', 'q:queued'])
  })

  it('places at a final index, clamps it, and removes on null', () => {
    const base = normalizeFrontier(entries)
    expect(activeIds(placeEntry(base, 'z', 'active', 1))).toEqual(['a', 'z', 'c'])
    expect(activeIds(placeEntry(base, 'c', 'active', 0))).toEqual(['c', 'a'])
    expect(queuedIds(placeEntry(base, 'z', 'queue', -5))).toEqual(['z', 'b'])
    expect(queuedIds(placeEntry(base, 'z', 'queue', 99))).toEqual(['b', 'z'])
    expect(placeEntry(base, 'a', null).map((entry) => entry.nodeId)).toEqual(['c', 'b'])
  })
})
