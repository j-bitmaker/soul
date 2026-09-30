import { describe, expect, it } from 'vitest'
import { createSeedMap } from './seed'
import { exportMap, migrateMap, parseMap } from './validation'

function legacyMap(): Record<string, unknown> {
  const map = createSeedMap()
  const { labels, ...understand } = map.nodes.understand
  void labels
  return { ...map,
    nodes: { ...map.nodes, understand: { ...understand, routines: [
      { id: 'read-bible', title: 'Read Bible', cadence: 'Daily' }, { id: 'pray', title: 'Pray' },
    ] } },
    frontier: [
      { nodeId: 'launch-blog', status: 'active' },
      { nodeId: 'english-c1', status: 'maintain' },
      { nodeId: 'professional-autonomy', status: 'primary' },
      { nodeId: 'software-ai', status: 'queued' },
    ],
  }
}

describe('map import and export', () => {
  it('round trips the complete human-readable map', () => {
    const map = createSeedMap()
    expect(parseMap(exportMap(map))).toEqual(map)
  })

  it('accepts maps without labels and preserves labels in JSON', () => {
    const map = createSeedMap()
    const { labels, ...plain } = map.nodes.understand
    void labels
    const without = { ...map, nodes: { ...map.nodes, understand: plain } }
    expect(parseMap(JSON.stringify(without)).nodes.understand.labels).toBeUndefined()
    expect(parseMap(exportMap(map)).nodes.understand.labels).toEqual([{ id: 'read-bible', text: 'Read Bible · Daily' }])
  })

  it('rejects malformed labels and duplicate IDs within a node', () => {
    const map = createSeedMap()
    for (const labels of [
      'Read Bible',
      [{ id: 'one', text: '   ' }],
      [{ id: '', text: 'Read' }],
      [{ id: 'one', text: 1 }],
      [{ id: 'one', text: 'Read', unknown: true }],
      [{ id: 'one', text: 'Read' }, { id: 'one', text: 'Pray' }],
    ]) {
      const broken = { ...map, nodes: { ...map.nodes,
        understand: { ...map.nodes.understand, labels },
      } }
      expect(() => parseMap(JSON.stringify(broken))).toThrow(/label|field/i)
    }
  })

  it('migrates legacy routines into labels and old statuses into an order without losing anything', () => {
    const migrated = parseMap(JSON.stringify(legacyMap()))
    expect(migrated.nodes.understand.labels).toEqual([
      { id: 'read-bible', text: 'Read Bible · Daily' },
      { id: 'pray', text: 'Pray' },
    ])
    expect('routines' in migrated.nodes.understand).toBe(false)
    expect(migrated.frontier).toEqual([
      { nodeId: 'professional-autonomy', status: 'active' },
      { nodeId: 'launch-blog', status: 'active' },
      { nodeId: 'english-c1', status: 'active' },
      { nodeId: 'software-ai', status: 'queued' },
    ])
  })

  it('migrates idempotently and keeps existing labels first', () => {
    const once = migrateMap(legacyMap())
    expect(migrateMap(once)).toEqual(once)
    const both = legacyMap() as { nodes: Record<string, Record<string, unknown>> }
    both.nodes.understand.labels = [{ id: 'read-bible', text: 'Existing' }]
    const merged = parseMap(JSON.stringify(both)).nodes.understand.labels
    expect(merged).toEqual([
      { id: 'read-bible', text: 'Existing' },
      { id: 'read-bible-2', text: 'Read Bible · Daily' },
      { id: 'pray', text: 'Pray' },
    ])
  })

  it('leaves malformed legacy routines and frontier entries alone so they are rejected', () => {
    const broken = legacyMap() as { nodes: Record<string, Record<string, unknown>> }
    broken.nodes.understand.routines = [{ id: 'one', title: '   ' }]
    expect(() => parseMap(JSON.stringify(broken))).toThrow(/field|routines/i)
    const odd = { ...legacyMap(), frontier: [{ nodeId: 'launch-blog', status: 'urgent' }] }
    expect(() => parseMap(JSON.stringify(odd))).toThrow(/frontier/i)
    expect(migrateMap('nonsense')).toBe('nonsense')
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

  it('rejects more than five active goals and duplicate entries, but allows a long queue', () => {
    const map = createSeedMap()
    const active = ['professional-autonomy', 'launch-blog', 'english-c1', 'own-products', 'attention-focus', 'habits-self-control']
    expect(() => parseMap(JSON.stringify({ ...map, frontier: active.map((nodeId) => ({ nodeId, status: 'active' })) }))).toThrow(/frontier/i)
    expect(() => parseMap(JSON.stringify({ ...map, frontier: [
      { nodeId: 'launch-blog', status: 'active' }, { nodeId: 'launch-blog', status: 'queued' },
    ] }))).toThrow(/frontier/i)
    const queued = active.concat(['software-ai', 'theology-scripture']).map((nodeId) => ({ nodeId, status: 'queued' }))
    expect(parseMap(JSON.stringify({ ...map, frontier: queued })).frontier).toHaveLength(8)
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
