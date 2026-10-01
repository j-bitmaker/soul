import { useSyncExternalStore, type CSSProperties } from 'react'
import { WARMTH_MAX } from '../domain/types'

/**
 * Cold to hot, one colour for each whole value 0-10: steel blue, blue, teal, forest green (the calm middle),
 * olive gold, amber, orange, vermilion, red. Every one is dark enough to read as text on white (4.5:1 or better).
 */
export const WARMTH_COLORS = [
  '#547196', '#43709d', '#2f6e93', '#287480', '#2c7264', '#376737',
  '#867316', '#a36912', '#bc5510', '#c33613', '#ca1c16',
] as const

const WORDS = ['Cold', 'Cold', 'Cool', 'Cool', 'Steady', 'Steady', 'Warm', 'Warm', 'Hot', 'Hot', 'Burning'] as const

/** The breakpoint at which the direction cards stack into one column (the same as in styles.css). */
export const STACKED_QUERY = '(max-width: 900px)'

function whole(value: number): number {
  return Math.max(0, Math.min(WARMTH_MAX, Math.round(value)))
}

export function warmthColor(value: number): string {
  return WARMTH_COLORS[whole(value)]
}

export function warmthWord(value: number): string {
  return WORDS[whole(value)]
}

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as [number, number, number]
}

/** `amount` of the colour over a base colour, as a hex string. */
function mix(hex: string, amount: number, base: readonly [number, number, number]): string {
  const colour = channels(hex)
  return `#${colour.map((part, at) => Math.round(base[at] * (1 - amount) + part * amount).toString(16).padStart(2, '0')).join('')}`
}

/**
 * The palette of a direction with a warmth value, as CSS variables: its colour, a tinted wash for the card,
 * a border colour, and a glow that only shows up from the warm values on. Nothing for a direction with no value,
 * which keeps its own colour.
 */
export function warmthVars(value: number | undefined): CSSProperties {
  if (value === undefined) return {}
  const heat = whole(value) / WARMTH_MAX
  const colour = warmthColor(value)
  const [red, green, blue] = channels(colour)
  return {
    '--tone': colour,
    '--tone-wash': mix(colour, 0.02 + heat * 0.07, [255, 254, 250]),
    '--tone-line': mix(colour, 0.28 + heat * 0.2, [219, 227, 220]),
    '--tone-glow': `0 14px 44px rgba(${red}, ${green}, ${blue}, ${(heat * heat * 0.36).toFixed(2)})`,
    '--heat': heat.toFixed(2),
  } as CSSProperties
}

/**
 * Cooler first, hottest last (a direction with no value counts as cold). Stable, so equal values keep their order.
 * Used where the directions are stacked in one column, so the one asking for attention comes last, under the thumb.
 */
export function byWarmth<T extends { warmth?: number }>(items: readonly T[]): T[] {
  return items.map((item, at) => ({ item, at }))
    .sort((left, right) => (left.item.warmth ?? 0) - (right.item.warmth ?? 0) || left.at - right.at)
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
