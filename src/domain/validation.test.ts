import { describe, expect, it } from 'vitest'
import { createSeedMap } from './seed'
import { exportMap, parseMap } from './validation'

describe('map import and export', () => {
  it('round trips the complete human-readable map', () => {
    const map = createSeedMap()
    expect(parseMap(exportMap(map))).toEqual(map)
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
