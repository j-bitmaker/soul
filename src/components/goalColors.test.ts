import { describe, expect, it } from 'vitest'
import { GOAL_COLORS } from '../domain/types'
import { GOAL_COLOR_LIST, GOAL_SWATCHES, goalColorVars } from './goalColors'

describe('goal colours', () => {
  it('offers ten named, clearly different colours, one for each colour the data allows', () => {
    expect(GOAL_COLORS).toHaveLength(10)
    expect(Object.keys(GOAL_SWATCHES).sort()).toEqual([...GOAL_COLORS].sort())
    expect(GOAL_COLOR_LIST.map((color) => color.id)).toEqual([...GOAL_COLORS])
    const hexes = GOAL_COLOR_LIST.map((color) => color.hex)
    expect(new Set(hexes).size).toBe(10)
    for (const hex of hexes) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    expect(new Set(GOAL_COLOR_LIST.map((color) => color.name)).size).toBe(10)
  })

  it('gives a goal\'s colour as a CSS variable, and nothing when it has none', () => {
    expect(goalColorVars(undefined)).toEqual({})
    expect((goalColorVars('teal') as Record<string, string>)['--goal']).toBe(GOAL_SWATCHES.teal.hex)
  })
})
