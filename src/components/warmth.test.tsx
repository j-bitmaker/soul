import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { byWarmth, STACKED_QUERY, useStacked, warmthColor, warmthVars, warmthWord, WARMTH_COLORS } from './warmth'

const channels = (hex: string): number[] => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))
function luminance(hex: string): number {
  const [red, green, blue] = channels(hex).map((part) => {
    const value = part / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}
const contrastOnWhite = (hex: string): number => 1.05 / (luminance(hex) + 0.05)

afterEach(() => { vi.unstubAllGlobals() })

describe('warmth palette', () => {
  it('has one distinct colour for each value 0-10, and each reads as text on white', () => {
    expect(WARMTH_COLORS).toHaveLength(11)
    expect(new Set(WARMTH_COLORS).size).toBe(11)
    for (const colour of WARMTH_COLORS) expect(contrastOnWhite(colour)).toBeGreaterThanOrEqual(4.5)
  })

  it('runs from a cold blue to a hot red', () => {
    const [coldRed, , coldBlue] = channels(WARMTH_COLORS[0])
    const [hotRed, , hotBlue] = channels(WARMTH_COLORS[10])
    expect(coldBlue).toBeGreaterThan(coldRed)
    expect(hotRed).toBeGreaterThan(hotBlue)
    // the red channel never falls on the way up past the calm middle, and the blue never rises again
    const reds = WARMTH_COLORS.map((colour) => channels(colour)[0])
    expect(reds[10]).toBeGreaterThan(reds[5])
    expect(reds[5]).toBeLessThan(reds[0] + 1)
    expect(channels(WARMTH_COLORS[7])[2]).toBeLessThan(channels(WARMTH_COLORS[2])[2])
  })

  it('rounds and clamps what it is given', () => {
    expect(warmthColor(-4)).toBe(WARMTH_COLORS[0])
    expect(warmthColor(99)).toBe(WARMTH_COLORS[10])
    expect(warmthColor(6.4)).toBe(WARMTH_COLORS[6])
    expect(warmthColor(6.6)).toBe(WARMTH_COLORS[7])
  })

  it('names the bands from Cold to Burning', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(warmthWord)).toEqual(
      ['Cold', 'Cold', 'Cool', 'Cool', 'Steady', 'Steady', 'Warm', 'Warm', 'Hot', 'Hot', 'Burning'])
  })
})

describe('warmthVars', () => {
  it('gives nothing to a direction with no value, so it keeps its own colour', () => {
    expect(warmthVars(undefined)).toEqual({})
  })

  it('gives the palette of the value, with a glow and a wash that grow with the heat', () => {
    const cold = warmthVars(0) as Record<string, string>
    const hot = warmthVars(10) as Record<string, string>
    expect(cold['--tone']).toBe(WARMTH_COLORS[0])
    expect(hot['--tone']).toBe(WARMTH_COLORS[10])
    expect(cold['--heat']).toBe('0.00')
    expect(hot['--heat']).toBe('1.00')
    expect(cold['--tone-glow']).toMatch(/, 0\.00\)$/)
    expect(hot['--tone-glow']).toMatch(/, 0\.36\)$/)
    expect(hot['--tone-glow']).toContain('rgba(202, 28, 22')
    // a hotter wash is further from the paper white than a cold one
    const away = (wash: string): number => channels(wash).reduce((sum, part, at) => sum + Math.abs(part - [255, 254, 250][at]), 0)
    expect(away(hot['--tone-wash'])).toBeGreaterThan(away(cold['--tone-wash']))
    expect(hot['--tone-line']).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('byWarmth', () => {
  it('puts the cooler first and the hottest last, keeping the order of equals', () => {
    const items: { id: string; warmth?: number }[] = [{ id: 'a', warmth: 8 }, { id: 'b', warmth: 2 }, { id: 'c' }, { id: 'd', warmth: 2 }, { id: 'e', warmth: 0 }]
    expect(byWarmth(items).map((item) => item.id)).toEqual(['c', 'e', 'b', 'd', 'a'])
    expect(items[0].id).toBe('a')
    const unrated: { id: string; warmth?: number }[] = [{ id: 'x' }, { id: 'y' }, { id: 'z' }]
    expect(byWarmth(unrated).map((item) => item.id)).toEqual(['x', 'y', 'z'])
  })
})

describe('useStacked', () => {
  it('is false where the browser cannot tell', () => {
    expect(renderHook(() => useStacked()).result.current).toBe(false)
  })

  it('follows the stacked layout as the window changes', () => {
    let listener: () => void = () => undefined
    let matches = true
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      get matches() { return query === STACKED_QUERY && matches },
      addEventListener: (_type: string, callback: () => void) => { listener = callback },
      removeEventListener: vi.fn(),
    })))
    const { result } = renderHook(() => useStacked())
    expect(result.current).toBe(true)
    matches = false
    act(() => listener())
    expect(result.current).toBe(false)
  })
})
