import { describe, expect, it } from 'vitest'
import { needsAttention, warmthBand, warmthColor, warmthVars, warmthWord, WARMTH_COLORS } from './warmth'

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

  it('gives the cooling ones a firmer frame than the very warm, but a lighter one than the cold', () => {
    const cooling = vars(4)
    expect(cooling['--tone-band']).toBe('4px')
    expect(cooling['--tone-shadow']).toMatch(/^0 0 0 1px rgba\(156, 105, 17, 0\.45\), 0 1px 2px/)
    expect(cooling['--tone-line']).not.toBe(WARMTH_COLORS[4])
    expect(cooling['--tone-line']).not.toBe('#dbe3dc') // a touch of the colour in the border
    expect(vars(0)['--tone-shadow']).toMatch(/^0 0 0 2px rgba\(/) // the cold frame is thicker
  })

  it('gives the cooling, alive, and warm ones the same firmer frame, each in its own colour, with no glow', () => {
    const ring = (value: number): string => (vars(value)['--tone-shadow'].match(/^0 0 0 1px (rgba\([^)]+\))/) ?? [])[1]
    for (const value of [3, 4, 5, 6, 7]) {
      const [red, green, blue] = channels(WARMTH_COLORS[value])
      expect(ring(value)).toBe(`rgba(${red}, ${green}, ${blue}, 0.45)`) // a thin ring in the value's own colour
      expect(vars(value)['--tone-band']).toBe('4px')
      expect(vars(value)['--tone-line']).not.toBe('#dbe3dc') // the border takes on the colour
      expect(vars(value)['--tone-line']).not.toBe(WARMTH_COLORS[value]) // but softly
      expect(vars(value)['--tone-shadow']).not.toContain('30px rgba') // no glow
      expect(vars(value)['--tone-shadow']).toContain('0 12px 30px #1f352706') // only the usual quiet shadow
    }
    // the same recipe: the border is the colour 55 % of the way from the pale line
    const alive = channels(vars(5)['--tone-line'] as string)
    const pale = channels('#dbe3dc')
    const tone = channels(WARMTH_COLORS[5])
    alive.forEach((part, at) => expect(Math.abs(part - Math.round(pale[at] * 0.45 + tone[at] * 0.55))).toBeLessThanOrEqual(1))
    // the very light tints stay very light
    for (const value of [5, 6, 7]) expect(channels(vars(value)['--tone-wash']).every((part) => part >= 240)).toBe(true)
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
    expect(bands).toEqual([5, 5, 5, 4, 4, 4, 4, 4, 2, 2, 2])
    expect(bands).toEqual([...bands].sort((left, right) => right - left))
  })
})
