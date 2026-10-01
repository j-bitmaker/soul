import { describe, expect, it } from 'vitest'
import { createSeedMap } from './seed'
import { activeIds, queuedIds } from './frontier'
import { exportMap } from './validation'
import {
  addGoal,
  archiveGoal,
  deleteGoal,
  getVisibleChildren,
  mergeGoals,
  moveGoal,
  placeInFrontier,
  reorderGoal,
  restoreGoal,
  shiftGoal,
  canShiftGoal,
  setSecondaryLinks,
  setNodeDetails,
  setVisibleChildren,
  subtreeIds,
  toggleVisibleChild,
} from './map'

describe('goal map', () => {
  it('seeds Soul, three fixed clusters, and fifteen provisional goals', () => {
    const map = createSeedMap()
    expect(map.nodes.soul.childrenIds).toEqual(['understand', 'create', 'mastery'])
    expect(Object.keys(map.nodes)).toHaveLength(19)
    expect(map.frontier).toEqual([
      { nodeId: 'professional-autonomy', status: 'active' },
      { nodeId: 'launch-blog', status: 'active' },
      { nodeId: 'english-c1', status: 'active' },
      { nodeId: 'theology-scripture', status: 'queued' },
      { nodeId: 'software-ai', status: 'queued' },
    ])
    expect(map.nodes.understand.labels).toEqual([{ id: 'read-bible', text: 'Read Bible · Daily' }])
  })

  it('adds a title-only goal without exceeding five visible children', () => {
    const map = addGoal(createSeedMap(), { id: 'new-goal', title: 'New goal', parentId: 'understand' })
    expect(map.nodes['new-goal'].title).toBe('New goal')
    expect(map.nodes.understand.childrenIds).toContain('new-goal')
    expect(getVisibleChildren(map, 'understand')).toHaveLength(5)
    expect(getVisibleChildren(map, 'understand').map((node) => node.id)).not.toContain('new-goal')
  })

  it('orders the Active lane, leads with its first goal, and can queue or remove a goal', () => {
    let map = placeInFrontier(createSeedMap(), 'own-products', 'active', 0)
    expect(activeIds(map.frontier)).toEqual(['own-products', 'professional-autonomy', 'launch-blog', 'english-c1'])
    map = placeInFrontier(map, 'own-products', 'queue')
    expect(activeIds(map.frontier)).toEqual(['professional-autonomy', 'launch-blog', 'english-c1'])
    expect(queuedIds(map.frontier)).toEqual(['theology-scripture', 'software-ai', 'own-products'])
    map = placeInFrontier(map, 'english-c1', 'active', 0)
    expect(activeIds(map.frontier)).toEqual(['english-c1', 'professional-autonomy', 'launch-blog'])
    map = placeInFrontier(map, 'theology-scripture', null)
    expect(map.frontier.some((entry) => entry.nodeId === 'theology-scripture')).toBe(false)
    expect(() => exportMap(map)).not.toThrow()
  })

  it('sends the last active goal to the front of the Queue when Active is full', () => {
    let map = placeInFrontier(createSeedMap(), 'own-products', 'active')
    map = placeInFrontier(map, 'attention-focus', 'active')
    expect(activeIds(map.frontier)).toHaveLength(5)
    map = placeInFrontier(map, 'habits-self-control', 'active', 1)
    expect(activeIds(map.frontier)).toEqual(['professional-autonomy', 'habits-self-control', 'launch-blog', 'english-c1', 'own-products'])
    expect(queuedIds(map.frontier)).toEqual(['attention-focus', 'theology-scripture', 'software-ai'])
    const last = placeInFrontier(map, 'cognitive-condition', 'active', 99)
    expect(activeIds(last.frontier)).toContain('cognitive-condition')
    expect(queuedIds(last.frontier)[0]).toBe('own-products')
  })

  it('can refuse a sixth active goal instead of moving one out', () => {
    let map = placeInFrontier(createSeedMap(), 'own-products', 'active')
    map = placeInFrontier(map, 'attention-focus', 'active')
    expect(() => placeInFrontier(map, 'habits-self-control', 'active', undefined, 'reject')).toThrow(/at most 5/i)
    expect(activeIds(placeInFrontier(map, 'launch-blog', 'active', 0, 'reject').frontier)[0]).toBe('launch-blog')
  })

  it('does not let archived goals, clusters, or Soul into the frontier', () => {
    const archived = archiveGoal(createSeedMap(), 'own-products')
    expect(() => placeInFrontier(archived, 'own-products', 'queue')).toThrow(/archived/i)
    expect(() => placeInFrontier(createSeedMap(), 'create', 'active')).toThrow(/permanent/i)
    expect(() => placeInFrontier(createSeedMap(), 'soul', 'queue')).toThrow(/permanent/i)
  })

  it('keeps any sequence of operations valid', () => {
    let seed = 7
    const next = (limit: number): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % limit }
    let map = createSeedMap()
    const ids = Object.keys(map.nodes).filter((id) => !['soul', 'understand', 'create', 'mastery'].includes(id))
    for (let step = 0; step < 300; step += 1) {
      const id = ids[next(ids.length)]
      const other = ids[next(ids.length)]
      try {
        const op = next(8)
        if (op === 0) map = placeInFrontier(map, id, 'active', next(7))
        else if (op === 1) map = placeInFrontier(map, id, 'queue', next(7))
        else if (op === 2) map = placeInFrontier(map, id, null)
        else if (op === 3) map = archiveGoal(map, id)
        else if (op === 4) map = restoreGoal(map, id)
        else if (op === 5) map = deleteGoal(map, id)
        else if (op === 6) map = shiftGoal(map, id, next(2) ? 1 : -1)
        else map = mergeGoals(map, id, other)
      } catch {
        // a refused operation must leave the map untouched and valid
      }
      if (!map.nodes[ids[0]]) ids.shift()
      expect(() => exportMap(map)).not.toThrow()
    }
  })

  it('moves a goal in focus among the goals in focus under its direction, in the order of the lane', () => {
    const map = createSeedMap()
    expect(canShiftGoal(map, 'launch-blog', -1)).toBe(false)
    expect(canShiftGoal(map, 'launch-blog', 1)).toBe(true)
    expect(canShiftGoal(map, 'english-c1', 1)).toBe(false)
    // Professional autonomy belongs to another direction and is not a neighbour
    const up = shiftGoal(map, 'english-c1', -1)
    expect(activeIds(up.frontier)).toEqual(['professional-autonomy', 'english-c1', 'launch-blog'])
    expect(activeIds(shiftGoal(up, 'english-c1', 1).frontier)).toEqual(['professional-autonomy', 'launch-blog', 'english-c1'])
    expect(queuedIds(up.frontier)).toEqual(queuedIds(map.frontier))
    expect(shiftGoal(map, 'launch-blog', -1)).toBe(map)
  })

  it('moves goals that are not in focus among their own kind, skipping goals that stand elsewhere', () => {
    const map = createSeedMap()
    // understand: theology (queued), launch-blog and english-c1 (in focus), then clear speech and philosophy
    expect(canShiftGoal(map, 'clear-speech-writing', -1)).toBe(false)
    const up = shiftGoal(map, 'philosophy-humanities', -1)
    expect(up.nodes.understand.childrenIds).toEqual(
      ['theology-scripture', 'launch-blog', 'english-c1', 'philosophy-humanities', 'clear-speech-writing'])
    expect(shiftGoal(up, 'philosophy-humanities', 1).nodes.understand.childrenIds).toEqual(map.nodes.understand.childrenIds)
    // an in-focus goal between two others does not get in the way
    const spread = { ...map, nodes: { ...map.nodes, understand: { ...map.nodes.understand,
      childrenIds: ['clear-speech-writing', 'launch-blog', 'philosophy-humanities', 'english-c1', 'theology-scripture'] } } }
    expect(shiftGoal(spread, 'philosophy-humanities', -1).nodes.understand.childrenIds).toEqual(
      ['philosophy-humanities', 'clear-speech-writing', 'launch-blog', 'english-c1', 'theology-scripture'])
    expect(activeIds(up.frontier)).toEqual(activeIds(map.frontier))
  })

  it('moves queued goals among the queued goals of their direction and ignores archived ones', () => {
    let map = placeInFrontier(createSeedMap(), 'philosophy-humanities', 'queue')
    expect(queuedIds(map.frontier)).toEqual(['theology-scripture', 'software-ai', 'philosophy-humanities'])
    map = shiftGoal(map, 'philosophy-humanities', -1)
    expect(queuedIds(map.frontier)).toEqual(['philosophy-humanities', 'theology-scripture', 'software-ai'])
    expect(canShiftGoal(map, 'software-ai', -1)).toBe(false)
    const archived = archiveGoal(map, 'theology-scripture')
    expect(canShiftGoal(archived, 'philosophy-humanities', 1)).toBe(false)
  })

  it('refuses to shift Soul and the directions, and leaves the map valid', () => {
    expect(() => shiftGoal(createSeedMap(), 'understand', 1)).toThrow(/permanent/i)
    expect(() => canShiftGoal(createSeedMap(), 'soul', 1)).toThrow(/permanent/i)
    expect(() => exportMap(shiftGoal(createSeedMap(), 'english-c1', -1))).not.toThrow()
  })

  it('sets, changes, and clears the warmth of a direction without touching anything else', () => {
    const base = createSeedMap()
    let map = setNodeDetails(base, 'create', { warmth: 7 })
    expect(map.nodes.create.warmth).toBe(7)
    expect(map.nodes.create.title).toBe(base.nodes.create.title)
    expect(map.nodes.create.description).toBe(base.nodes.create.description)
    expect(map.nodes.create.childrenIds).toEqual(base.nodes.create.childrenIds)
    expect(() => exportMap(map)).not.toThrow()
    map = setNodeDetails(map, 'create', { labels: [{ id: 'one', text: 'Now' }] })
    expect(map.nodes.create.warmth).toBe(7)
    map = setNodeDetails(map, 'create', { warmth: 0 })
    expect(map.nodes.create.warmth).toBe(0)
    expect(setNodeDetails(map, 'create', { warmth: 10 }).nodes.create.warmth).toBe(10)
    map = setNodeDetails(map, 'create', { warmth: null })
    expect('warmth' in map.nodes.create).toBe(false)
    expect(map.nodes.create.labels).toEqual([{ id: 'one', text: 'Now' }])
    expect(base.nodes.create.warmth).toBeUndefined()
  })

  it('refuses warmth anywhere but on a direction, and any value but a whole number from 0 to 10', () => {
    const map = createSeedMap()
    expect(() => setNodeDetails(map, 'launch-blog', { warmth: 5 })).toThrow(/only directions/i)
    expect(() => setNodeDetails(map, 'soul', { warmth: 5 })).toThrow(/permanent/i)
    for (const warmth of [11, -1, 2.5, Number.NaN, Infinity]) {
      expect(() => setNodeDetails(map, 'mastery', { warmth })).toThrow(/whole number from 0 to 10/i)
    }
  })

  it('lets Soul carry labels but nothing else', () => {
    const labels = [{ id: 'one', text: '  Seek first  ' }, { id: 'two', text: 'Daily' }]
    const map = setNodeDetails(createSeedMap(), 'soul', { labels })
    expect(map.nodes.soul.labels).toEqual([{ id: 'one', text: 'Seek first' }, { id: 'two', text: 'Daily' }])
    expect(map.nodes.soul.title).toBe('Soul')
    expect(map.nodes.soul.description).toBe(createSeedMap().nodes.soul.description)
    expect(() => exportMap(map)).not.toThrow()
    expect(setNodeDetails(map, 'soul', { labels: [] }).nodes.soul.labels).toBeUndefined()
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
    expect(activeIds(archiveGoal(createSeedMap(), 'professional-autonomy').frontier)[0]).toBe('launch-blog')
    expect(getVisibleChildren(map, 'understand').map((node) => node.id)).not.toContain('launch-blog')
  })

  it('deletes a goal with everything nested under it and leaves no dangling reference', () => {
    let map = createSeedMap()
    map = addGoal(map, { id: 'child', title: 'Child', parentId: 'launch-blog' })
    map = addGoal(map, { id: 'grandchild', title: 'Grandchild', parentId: 'child' })
    map = archiveGoal(map, 'grandchild')
    map = placeInFrontier(map, 'child', 'queue')
    map = setSecondaryLinks(map, 'english-c1', ['launch-blog', 'child', 'create'])
    map = setSecondaryLinks(map, 'launch-blog', ['child'])
    expect(subtreeIds(map, 'launch-blog')).toEqual(['launch-blog', 'child', 'grandchild'])
    const after = deleteGoal(map, 'launch-blog')
    for (const id of ['launch-blog', 'child', 'grandchild']) expect(after.nodes[id]).toBeUndefined()
    expect(after.nodes.understand.childrenIds).not.toContain('launch-blog')
    expect(after.nodes.understand.visibleChildIds).not.toContain('launch-blog')
    expect(after.nodes['english-c1'].secondaryIds).toEqual(['create'])
    expect(after.frontier.map((entry) => entry.nodeId)).toEqual(['professional-autonomy', 'english-c1', 'theology-scripture', 'software-ai'])
    expect(() => exportMap(after)).not.toThrow()
    expect(map.nodes['launch-blog']).toBeDefined()
  })

  it('promotes the next goal to lead when the Primary goal is deleted, and refuses permanent nodes', () => {
    const after = deleteGoal(createSeedMap(), 'professional-autonomy')
    expect(activeIds(after.frontier)[0]).toBe('launch-blog')
    expect(() => deleteGoal(createSeedMap(), 'create')).toThrow(/permanent/i)
    expect(() => deleteGoal(createSeedMap(), 'soul')).toThrow(/permanent/i)
    expect(() => deleteGoal(createSeedMap(), 'missing')).toThrow(/unknown/i)
  })

  it('changes labels, milestones, and reminders in one step, tidying them and clearing emptied lists', () => {
    const map = setNodeDetails(createSeedMap(), 'english-c1', {
      labels: [{ id: 'a', text: '  Speak  ' }, { id: 'a', text: 'Dupe id' }, { id: 'b', text: '   ' }, { id: 'c', text: 'Read' }],
      milestones: [{ id: 'm', title: ' Novel ', done: true }, { id: '', title: 'No id', done: false }],
      reminders: [' Daily ', 'Daily', '', 'Weekly'],
    })
    expect(map.nodes['english-c1'].labels).toEqual([{ id: 'a', text: 'Speak' }, { id: 'c', text: 'Read' }])
    expect(map.nodes['english-c1'].milestones).toEqual([{ id: 'm', title: 'Novel', done: true }])
    expect(map.nodes['english-c1'].reminders).toEqual(['Daily', 'Weekly'])
    const untouched = setNodeDetails(map, 'english-c1', { labels: [] })
    expect('labels' in untouched.nodes['english-c1']).toBe(false)
    expect(untouched.nodes['english-c1'].reminders).toEqual(['Daily', 'Weekly'])
    expect(() => exportMap(untouched)).not.toThrow()
    expect(() => exportMap(map)).not.toThrow()
  })

  it('edits a goal\'s own text in place: trims, clears blanks, keeps the rest, and protects names', () => {
    let map = setNodeDetails(createSeedMap(), 'english-c1', { title: '  English C2  ', description: ' Talk ', target: '' })
    expect(map.nodes['english-c1']).toMatchObject({ title: 'English C2', description: 'Talk', current: 'B2-ish' })
    expect('target' in map.nodes['english-c1']).toBe(false)
    map = setNodeDetails(map, 'english-c1', { current: '', note: 'Aloud' })
    expect('current' in map.nodes['english-c1']).toBe(false)
    expect(map.nodes['english-c1'].note).toBe('Aloud')
    expect(map.nodes['english-c1'].milestones).toHaveLength(1)
    expect(() => setNodeDetails(map, 'english-c1', { title: '   ' })).toThrow(/title/i)
    expect(() => setNodeDetails(map, 'create', { title: 'Renamed' })).toThrow(/permanent/i)
    expect(() => setNodeDetails(map, 'soul', { title: 'Mind' })).toThrow(/permanent/i)
    expect(() => setNodeDetails(map, 'soul', { description: 'Changed' })).toThrow(/permanent/i)
    expect(() => setNodeDetails(map, 'soul', { milestones: [] })).toThrow(/permanent/i)
    expect(() => setNodeDetails(map, 'missing', { labels: [] })).toThrow(/unknown/i)
    expect(setNodeDetails(map, 'create', { labels: [{ id: 'x', text: 'Focus' }] }).nodes.create.labels).toEqual([{ id: 'x', text: 'Focus' }])
    expect(() => exportMap(map)).not.toThrow()
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

  it('keeps the earlier place and the higher lane when merging frontier goals', () => {
    const activeWins = mergeGoals(createSeedMap(), 'theology-scripture', 'launch-blog')
    expect(activeIds(activeWins.frontier)).toEqual(['professional-autonomy', 'launch-blog', 'english-c1'])
    expect(queuedIds(activeWins.frontier)).toEqual(['software-ai'])
    const promoted = mergeGoals(createSeedMap(), 'english-c1', 'theology-scripture')
    expect(activeIds(promoted.frontier)).toEqual(['professional-autonomy', 'launch-blog', 'theology-scripture'])
    expect(queuedIds(promoted.frontier)).toEqual(['software-ai'])
  })

  it('preserves labels through moves and archives', () => {
    const seed = createSeedMap()
    const withLabel = { ...seed, nodes: { ...seed.nodes,
      'launch-blog': { ...seed.nodes['launch-blog'], labels: [{ id: 'publish', text: 'Write weekly' }] },
    } }
    const moved = moveGoal(withLabel, 'launch-blog', 'create')
    const archived = archiveGoal(moved, 'launch-blog')
    expect(archived.nodes['launch-blog'].labels).toEqual([{ id: 'publish', text: 'Write weekly' }])
  })

  it('merges labels from both goals, skips duplicate text, and gives conflicting source IDs unique names', () => {
    const seed = createSeedMap()
    const source = { ...seed.nodes['launch-blog'], labels: [
      { id: 'daily', text: 'Write daily' },
      { id: 'weekly', text: 'Review weekly' },
      { id: 'same', text: 'Shared' },
    ] }
    const target = { ...seed.nodes['clear-speech-writing'], labels: [
      { id: 'daily', text: 'Speak daily' },
      { id: 'launch-blog-daily', text: 'Listen' },
      { id: 'other', text: 'Shared' },
    ] }
    const map = { ...seed, nodes: { ...seed.nodes, 'launch-blog': source, 'clear-speech-writing': target } }
    const merged = mergeGoals(map, 'launch-blog', 'clear-speech-writing')
    expect(merged.nodes['clear-speech-writing'].labels).toEqual([
      { id: 'daily', text: 'Speak daily' },
      { id: 'launch-blog-daily', text: 'Listen' },
      { id: 'other', text: 'Shared' },
      { id: 'launch-blog-daily-2', text: 'Write daily' },
      { id: 'weekly', text: 'Review weekly' },
    ])
    expect(() => exportMap(merged)).not.toThrow()
  })
})
