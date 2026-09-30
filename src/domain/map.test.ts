import { describe, expect, it } from 'vitest'
import { createSeedMap } from './seed'
import { exportMap } from './validation'
import {
  addGoal,
  archiveGoal,
  getVisibleChildren,
  mergeGoals,
  moveGoal,
  reorderGoal,
  restoreGoal,
  setFrontierStatus,
  setSecondaryLinks,
  setVisibleChildren,
  toggleVisibleChild,
} from './map'

describe('goal map', () => {
  it('seeds Soul, three fixed clusters, and fifteen provisional goals', () => {
    const map = createSeedMap()
    expect(map.nodes.soul.childrenIds).toEqual(['understand', 'create', 'mastery'])
    expect(Object.keys(map.nodes)).toHaveLength(19)
    expect(map.frontier).toEqual([
      { nodeId: 'professional-autonomy', status: 'primary' },
      { nodeId: 'launch-blog', status: 'active' },
      { nodeId: 'english-c1', status: 'maintain' },
    ])
    expect(map.nodes.understand.routines).toEqual([
      { id: 'read-bible', title: 'Read Bible', cadence: 'Daily' },
    ])
  })

  it('adds a title-only goal without exceeding five visible children', () => {
    const map = addGoal(createSeedMap(), { id: 'new-goal', title: 'New goal', parentId: 'understand' })
    expect(map.nodes['new-goal'].title).toBe('New goal')
    expect(map.nodes.understand.childrenIds).toContain('new-goal')
    expect(getVisibleChildren(map, 'understand')).toHaveLength(5)
    expect(getVisibleChildren(map, 'understand').map((node) => node.id)).not.toContain('new-goal')
  })

  it('keeps one Primary and caps the frontier at five', () => {
    let map = setFrontierStatus(createSeedMap(), 'software-ai', 'primary')
    expect(map.frontier.filter((entry) => entry.status === 'primary')).toEqual([
      { nodeId: 'software-ai', status: 'primary' },
    ])
    map = setFrontierStatus(map, 'own-products', 'active')
    expect(map.frontier).toHaveLength(5)
    expect(() => setFrontierStatus(map, 'attention-focus', 'active')).toThrow(/five/i)
  })

  it('allows secondary links while rejecting placement cycles', () => {
    let map = setSecondaryLinks(createSeedMap(), 'english-c1', ['create'])
    expect(map.nodes['english-c1'].secondaryIds).toEqual(['create'])
    map = addGoal(map, { id: 'child', title: 'Child', parentId: 'english-c1' })
    expect(() => moveGoal(map, 'english-c1', 'child')).toThrow(/cycle/i)
  })

  it('reorders and changes the visible set without changing placement', () => {
    let map = addGoal(createSeedMap(), { id: 'new-goal', title: 'New goal', parentId: 'understand' })
    map = setVisibleChildren(map, 'understand', ['launch-blog', 'english-c1'])
    map = reorderGoal(map, 'launch-blog', 1)
    expect(getVisibleChildren(map, 'understand').map((node) => node.id)).toEqual(['english-c1', 'launch-blog'])
    expect(map.nodes['new-goal'].parentId).toBe('understand')
  })

  it('does not jump past a visible goal when moving across a hidden sibling', () => {
    let map = createSeedMap()
    const first = map.nodes.understand.childrenIds[0]
    const hidden = map.nodes.understand.childrenIds[1]
    const third = map.nodes.understand.childrenIds[2]
    map = setVisibleChildren(map, 'understand', [first, third])
    map = reorderGoal(map, third, -1)
    expect(map.nodes.understand.childrenIds.slice(0, 3)).toEqual([first, third, hidden])
    expect(map.nodes.understand.visibleChildIds).toEqual([first, third])
  })

  it('preserves a custom visible order when a hidden sibling moves', () => {
    let map = createSeedMap()
    const [first, hidden, third] = map.nodes.understand.childrenIds
    map = setVisibleChildren(map, 'understand', [third, first])
    map = reorderGoal(map, hidden, -1)
    expect(map.nodes.understand.visibleChildIds).toEqual([third, first])
  })

  it('archives a goal out of normal view and frontier', () => {
    const map = archiveGoal(createSeedMap(), 'launch-blog')
    expect(map.nodes['launch-blog'].archived).toBe(true)
    expect(map.frontier.some((entry) => entry.nodeId === 'launch-blog')).toBe(false)
    expect(getVisibleChildren(map, 'understand').map((node) => node.id)).not.toContain('launch-blog')
  })

  it('restores an archived goal and controls whether it is in view', () => {
    let map = archiveGoal(createSeedMap(), 'launch-blog')
    map = restoreGoal(map, 'launch-blog')
    expect(map.nodes['launch-blog'].archived).toBe(false)
    expect(getVisibleChildren(map, 'understand').map((node) => node.id)).toContain('launch-blog')
    map = toggleVisibleChild(map, 'understand', 'launch-blog')
    expect(getVisibleChildren(map, 'understand').map((node) => node.id)).not.toContain('launch-blog')
  })

  it('merges children, links, reminders, and notes without dangling references', () => {
    let map = createSeedMap()
    map = addGoal(map, { id: 'blog-child', title: 'First article', parentId: 'launch-blog' })
    map = setSecondaryLinks(map, 'english-c1', ['launch-blog'])
    map = mergeGoals(map, 'launch-blog', 'clear-speech-writing')
    expect(map.nodes['launch-blog']).toBeUndefined()
    expect(map.nodes['blog-child'].parentId).toBe('clear-speech-writing')
    expect(map.nodes['english-c1'].secondaryIds).toContain('clear-speech-writing')
    expect(map.nodes['clear-speech-writing'].note).toContain('Launch Blog')
    expect(map.frontier.some((entry) => entry.nodeId === 'launch-blog')).toBe(false)
  })

  it('preserves routines through moves and archives', () => {
    const seed = createSeedMap()
    const withRoutine = { ...seed, nodes: { ...seed.nodes,
      'launch-blog': { ...seed.nodes['launch-blog'], routines: [{ id: 'publish', title: 'Write', cadence: 'Weekly' }] },
    } }
    const moved = moveGoal(withRoutine, 'launch-blog', 'create')
    const archived = archiveGoal(moved, 'launch-blog')
    expect(archived.nodes['launch-blog'].routines).toEqual([{ id: 'publish', title: 'Write', cadence: 'Weekly' }])
  })

  it('merges routines from both goals and gives conflicting source IDs unique names', () => {
    const seed = createSeedMap()
    const source = { ...seed.nodes['launch-blog'], routines: [
      { id: 'daily', title: 'Write', cadence: 'Daily' },
      { id: 'weekly', title: 'Review', cadence: 'Weekly' },
    ] }
    const target = { ...seed.nodes['clear-speech-writing'], routines: [
      { id: 'daily', title: 'Speak', cadence: 'Daily' },
      { id: 'launch-blog-daily', title: 'Listen' },
    ] }
    const map = { ...seed, nodes: { ...seed.nodes, 'launch-blog': source, 'clear-speech-writing': target } }
    const merged = mergeGoals(map, 'launch-blog', 'clear-speech-writing')
    expect(merged.nodes['clear-speech-writing'].routines).toEqual([
      { id: 'daily', title: 'Speak', cadence: 'Daily' },
      { id: 'launch-blog-daily', title: 'Listen' },
      { id: 'launch-blog-daily-2', title: 'Write', cadence: 'Daily' },
      { id: 'weekly', title: 'Review', cadence: 'Weekly' },
    ])
    expect(() => exportMap(merged)).not.toThrow()
  })
})
