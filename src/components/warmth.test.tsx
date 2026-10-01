import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  byWarmth, needsAttention, STACKED_QUERY, useStacked, warmthBand, warmthColor, warmthVars, warmthWord, WARMTH_COLORS,
} from './warmth'

const channels = (hex: string): number[] => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))
function luminance(hex: string): number {
  const [red, green, blue] = channels(hex).map((part) => {
    const value = part / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}
const contrastOnWhite = (hex: string): number => 1.05 / (luminance(hex) + 0.05)
const vars = (value: number): Record<string, string> => warmthVars(value) as Record<string, string>

afterEach(() => { vi.unstubAllGlobals() })

describe('warmth palette', () => {
  it('has one distinct colour for each value 0-10, and each reads as text on white', () => {
    expect(WARMTH_COLORS).toHaveLength(11)
    expect(new Set(WARMTH_COLORS).size).toBe(11)
    for (const colour of WARMTH_COLORS) expect(contrastOnWhite(colour)).toBeGreaterThanOrEqual(4.5)
  })

  it('is coral red when cold, orange and amber when cooling, grey-blue when alive, and a calm green when warm', () => {
    for (const value of [0, 1, 2]) {
      const [red, green, blue] = channels(warmthColor(value))
      expect(red).toBeGreaterThan(green + 90)
      expect(red).toBeGreaterThan(blue + 90)
    }
    for (const value of [3, 4]) {
      const [red, green, blue] = channels(warmthColor(value))
      expect(red).toBeGreaterThan(green)
      expect(green).toBeGreaterThan(blue + 40) // orange and amber
    }
    const [red, , blue] = channels(warmthColor(5))
    expect(blue).toBeGreaterThan(red) // neutral grey-blue
    for (const value of [6, 7, 8, 9, 10]) {
      const [r, g, b] = channels(warmthColor(value))
      expect(g).toBeGreaterThan(r) // a little green, never saturated
      expect(g).toBeGreaterThanOrEqual(b - 12)
      expect(g - r).toBeLessThan(60)
    }
  })

  it('rounds and clamps what it is given', () => {
    expect(warmthColor(-4)).toBe(WARMTH_COLORS[0])
    expect(warmthColor(99)).toBe(WARMTH_COLORS[10])
    expect(warmthColor(6.4)).toBe(WARMTH_COLORS[6])
    expect(warmthColor(6.6)).toBe(WARMTH_COLORS[7])
  })

  it('splits the values into Cold 0-2, Cooling 3-4, Alive 5, Warm 6-7, and Very Warm 8-10', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(warmthBand)).toEqual(
      ['cold', 'cold', 'cold', 'cooling', 'cooling', 'alive', 'warm', 'warm', 'very-warm', 'very-warm', 'very-warm'])
    expect([0, 2, 3, 4, 5, 6, 7, 8, 10].map(warmthWord)).toEqual(
      ['Cold', 'Cold', 'Cooling', 'Cooling', 'Alive', 'Warm', 'Warm', 'Very Warm', 'Very Warm'])
  })

  it('flags only the cold values as needing attention', () => {
    expect([0, 1, 2, 3, 5, 8, 10].map(needsAttention)).toEqual([true, true, true, false, false, false, false])
  })
})

describe('warmthVars', () => {
  it('gives nothing to a direction with no value, so it keeps its own colour', () => {
    expect(warmthVars(undefined)).toEqual({})
  })

  it('makes the coldest the loudest: the strongest frame, a band, a glow, and the most colour in the tint', () => {
    const coldest = vars(0)
    const cold = vars(2)
    expect(coldest['--tone']).toBe(WARMTH_COLORS[0])
    expect(coldest['--tone-line']).toBe(WARMTH_COLORS[0])
    expect(coldest['--tone-band']).toBe('5px')
    expect(coldest['--tone-shadow']).toMatch(/^0 0 0 2px rgba\(180, 49, 39, 0\.9\), 0 10px 30px rgba\(180, 49, 39, 0\.2\d?\), 0 1px 2px/)
    expect(cold['--tone-shadow']).toMatch(/^0 0 0 2px rgba\(184, 73, 46, 0\.9\), 0 10px 30px rgba\(184, 73, 46, 0\.14\)/)
    const away = (wash: string): number => channels(wash).reduce((sum, part) => sum + (255 - part), 0)
    expect(away(coldest['--tone-wash'])).toBeGreaterThan(away(cold['--tone-wash']))
  })

  it('gives the cooling ones a firmer frame than the rest, but a lighter one than the cold', () => {
    const cooling = vars(4)
    expect(cooling['--tone-band']).toBe('4px')
    expect(cooling['--tone-shadow']).toMatch(/^0 0 0 1px rgba\(156, 105, 17, 0\.45\), 0 1px 2px/)
    expect(cooling['--tone-line']).not.toBe(WARMTH_COLORS[4])
    expect(cooling['--tone-line']).not.toBe('#dbe3dc') // a touch of the colour in the border
  })

  it('leaves the alive and warm ones quiet: the usual border and shadow, and a very light tint', () => {
    for (const value of [5, 6, 7]) {
      expect(vars(value)['--tone-line']).toBe('#dbe3dc')
      expect(vars(value)['--tone-band']).toBe('3px')
      expect(vars(value)['--tone-shadow']).not.toMatch(/0 0 0 \dpx/)
      expect(vars(value)['--tone-shadow']).not.toContain('rgba')
    }
  })

  it('gives the very warm ones no frame and no glow at all, and no tint', () => {
    for (const value of [8, 9, 10]) {
      expect(vars(value)['--tone-wash']).toBe('#ffffff')
      expect(vars(value)['--tone-line']).toBe('#dbe3dc')
      expect(vars(value)['--tone-band']).toBe('2px')
      expect(vars(value)['--tone-shadow']).toBe('0 1px 2px #1f35270a, 0 12px 30px #1f352706')
      expect(vars(value)['--tone']).toBe(WARMTH_COLORS[value])
    }
  })

  it('grows quieter with every step up: the band never thickens as the value rises', () => {
    const bands = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => parseInt(vars(value)['--tone-band'], 10))
    expect(bands).toEqual([...bands].sort((left, right) => right - left))
  })
})

describe('byWarmth', () => {
  it('puts the colder first and the warmest last, keeping the order of equals; no value counts as neutral', () => {
    const items: { id: string; warmth?: number }[] = [{ id: 'a', warmth: 8 }, { id: 'b', warmth: 2 }, { id: 'c' }, { id: 'd', warmth: 2 }, { id: 'e', warmth: 0 }]
    expect(byWarmth(items).map((item) => item.id)).toEqual(['e', 'b', 'd', 'c', 'a'])
    expect(items[0].id).toBe('a')
    const unrated: { id: string; warmth?: number }[] = [{ id: 'x' }, { id: 'y' }, { id: 'z' }]
    expect(byWarmth(unrated).map((item) => item.id)).toEqual(['x', 'y', 'z'])
    const mixed: { id: string; warmth?: number }[] = [{ id: 'x', warmth: 6 }, { id: 'y' }, { id: 'z', warmth: 4 }]
    expect(byWarmth(mixed).map((item) => item.id)).toEqual(['z', 'y', 'x'])
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
