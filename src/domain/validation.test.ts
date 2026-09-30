import { describe, expect, it } from 'vitest'
import { createSeedMap } from './seed'
import { exportMap, parseMap } from './validation'

describe('map import and export', () => {
  it('round trips the complete human-readable map', () => {
    const map = createSeedMap()
    expect(parseMap(exportMap(map))).toEqual(map)
  })

  it('accepts older maps without routines and preserves routines in JSON', () => {
    const map = createSeedMap()
    const legacy = { ...map, nodes: { ...map.nodes,
      understand: { ...map.nodes.understand, routines: undefined },
    } }
    expect(parseMap(JSON.stringify(legacy)).nodes.understand.routines).toBeUndefined()
    expect(parseMap(exportMap(map)).nodes.understand.routines).toEqual([
      { id: 'read-bible', title: 'Read Bible', cadence: 'Daily' },
    ])
  })

  it('rejects malformed routines and duplicate IDs within a node', () => {
    const map = createSeedMap()
    for (const routines of [
      'Read Bible',
      [{ id: 'one', title: '   ' }],
      [{ id: '', title: 'Read' }],
      [{ id: 'one', title: 'Read', cadence: 1 }],
      [{ id: 'one', title: 'Read', unknown: true }],
      [{ id: 'one', title: 'Read' }, { id: 'one', title: 'Pray' }],
    ]) {
      const broken = { ...map, nodes: { ...map.nodes,
        understand: { ...map.nodes.understand, routines },
      } }
      expect(() => parseMap(JSON.stringify(broken))).toThrow(/routine|field/i)
    }
  })

  it('rejects invalid JSON and unknown schema versions', () => {
    expect(() => parseMap('{')).toThrow(/JSON/i)
    const map = { ...createSeedMap(), schemaVersion: 2 }
    expect(() => parseMap(JSON.stringify(map))).toThrow(/version/i)
  })

  it('rejects dangling children and secondary links', () => {
    const map = createSeedMap()
    const broken = {
      ...map,
      nodes: {
        ...map.nodes,
        understand: { ...map.nodes.understand, childrenIds: ['missing'] },
      },
    }
    expect(() => parseMap(JSON.stringify(broken))).toThrow(/reference/i)
  })

  it('rejects an oversized frontier and duplicate Primary entries', () => {
    const map = createSeedMap()
    const broken = {
      ...map,
      frontier: [
        ...map.frontier,
        { nodeId: 'software-ai', status: 'primary' },
        { nodeId: 'own-products', status: 'active' },
        { nodeId: 'attention-focus', status: 'active' },
      ],
    }
    expect(() => parseMap(JSON.stringify(broken))).toThrow(/frontier/i)
  })

  it('rejects unrecognized fields before a map can be published', () => {
    const map = createSeedMap()
    expect(() => parseMap(JSON.stringify({ ...map, privateMemo: 'hidden' }))).toThrow(/field/i)
    expect(() => parseMap(JSON.stringify({ ...map, nodes: {
      ...map.nodes, 'launch-blog': { ...map.nodes['launch-blog'], privateMemo: 'hidden' },
    } }))).toThrow(/field/i)
    expect(() => parseMap(JSON.stringify({ ...map, frontier: [
      { ...map.frontier[0], privateMemo: 'hidden' }, ...map.frontier.slice(1),
    ] }))).toThrow(/field/i)
    expect(() => parseMap(JSON.stringify({ ...map, nodes: {
      ...map.nodes, 'launch-blog': { ...map.nodes['launch-blog'], milestones: [
        { id: 'm1', title: 'Write', done: false, privateMemo: 'hidden' },
      ] },
    } }))).toThrow(/field/i)
  })
})
