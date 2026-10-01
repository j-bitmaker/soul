import { useSyncExternalStore, type CSSProperties } from 'react'
import { WARMTH_MAX } from '../domain/types'

/**
 * Warmth is how alive a direction is. The colder it is, the more it needs attention, so the colder, the louder:
 * 0-2 Cold (coral red, the strongest frame, flagged), 3-4 Cooling (orange and amber, a firmer frame),
 * 5 Alive (neutral grey-blue), 6-7 Warm (almost neutral, a little green), 8-10 Very Warm (calm muted green,
 * no frame and no glow). Every colour is dark enough to read as text on white (4.5:1 or better).
 */
export const WARMTH_COLORS = [
  '#b43127', '#b63d2b', '#b8492e',
  '#a75711', '#9c6911',
  '#606f80',
  '#516763', '#49695e',
  '#446a57', '#3c6750', '#366349',
] as const

export type WarmthBand = 'cold' | 'cooling' | 'alive' | 'warm' | 'very-warm'

const WORDS: Record<WarmthBand, string> = {
  cold: 'Cold', cooling: 'Cooling', alive: 'Alive', warm: 'Warm', 'very-warm': 'Very Warm',
}

/** A direction without a value counts as neutral where directions are put in order. */
export const NEUTRAL_WARMTH = 5

/** The breakpoint at which the direction cards stack into one column (the same as in styles.css). */
export const STACKED_QUERY = '(max-width: 900px)'

function whole(value: number): number {
  return Math.max(0, Math.min(WARMTH_MAX, Math.round(value)))
}

export function warmthColor(value: number): string {
  return WARMTH_COLORS[whole(value)]
}

export function warmthBand(value: number): WarmthBand {
  const step = whole(value)
  if (step <= 2) return 'cold'
  if (step <= 4) return 'cooling'
  if (step === 5) return 'alive'
  return step <= 7 ? 'warm' : 'very-warm'
}

export function warmthWord(value: number): string {
  return WORDS[warmthBand(value)]
}

/** The cold directions are the ones asking for attention. */
export function needsAttention(value: number): boolean {
  return warmthBand(value) === 'cold'
}

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as [number, number, number]
}

const WHITE = [255, 255, 255] as const
const LINE = [219, 227, 220] as const
const LINE_HEX = '#dbe3dc'
const QUIET_SHADOW = '0 1px 2px #1f35270a, 0 12px 30px #1f352706'

/** `amount` of the colour over a base colour, as a hex string. */
function mix(hex: string, amount: number, base: readonly [number, number, number]): string {
  const colour = channels(hex)
  return `#${colour.map((part, at) => Math.round(base[at] * (1 - amount) + part * amount).toString(16).padStart(2, '0')).join('')}`
}

/**
 * The look of a direction with a warmth value, as CSS variables: its colour (`--tone`), the tint of its card
 * (`--tone-wash`), its border colour, the thickness of its top band, and its shadow (a frame and a soft glow for
 * the cold ones, a firmer frame for the cooling ones, and nothing but the usual quiet shadow for the rest).
 * Nothing at all for a direction with no value, which keeps its own colour.
 */
export function warmthVars(value: number | undefined): CSSProperties {
  if (value === undefined) return {}
  const step = whole(value)
  const colour = warmthColor(step)
  const [red, green, blue] = channels(colour)
  const rgba = (alpha: number): string => `rgba(${red}, ${green}, ${blue}, ${alpha})`
  const look = {
    cold: { wash: mix(colour, 0.05 + (2 - step) * 0.015, WHITE), line: colour, band: 5,
      shadow: `0 0 0 2px ${rgba(0.9)}, 0 10px 30px ${rgba(0.14 + (2 - step) * 0.03)}, 0 1px 2px #1f35270a` },
    cooling: { wash: mix(colour, 0.035, WHITE), line: mix(colour, 0.55, LINE), band: 4, shadow: `0 0 0 1px ${rgba(0.45)}, ${QUIET_SHADOW}` },
    alive: { wash: mix(colour, 0.025, WHITE), line: LINE_HEX, band: 3, shadow: QUIET_SHADOW },
    warm: { wash: mix(colour, 0.02, WHITE), line: LINE_HEX, band: 3, shadow: QUIET_SHADOW },
    'very-warm': { wash: '#ffffff', line: LINE_HEX, band: 2, shadow: QUIET_SHADOW },
  }[warmthBand(step)]
  return {
    '--tone': colour,
    '--tone-wash': look.wash,
    '--tone-line': look.line,
    '--tone-band': `${look.band}px`,
    '--tone-shadow': look.shadow,
  } as CSSProperties
}

/**
 * Colder first, warmest last (a direction with no value counts as neutral). Stable, so equal values keep their order.
 * Used where the directions are stacked in one column, so the ones that need attention come first.
 */
export function byWarmth<T extends { warmth?: number }>(items: readonly T[]): T[] {
  return items.map((item, at) => ({ item, at }))
    .sort((left, right) => (left.item.warmth ?? NEUTRAL_WARMTH) - (right.item.warmth ?? NEUTRAL_WARMTH) || left.at - right.at)
    .map(({ item }) => item)
}

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const query = window.matchMedia(STACKED_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Are the direction cards stacked in one column right now? (Always false where the browser cannot tell.) */
export function useStacked(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia === 'function' && window.matchMedia(STACKED_QUERY).matches,
    () => false,
  )
}
