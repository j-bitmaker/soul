import type { CSSProperties } from 'react'
import { GOAL_COLORS, type GoalColor } from '../domain/types'

/**
 * Ten calm, clearly different shades for tagging goals. They are picked to tell apart at a glance as a small dot
 * on a white card, in this order: warm to cool, then violet, pink, and a neutral slate.
 */
export const GOAL_SWATCHES: Record<GoalColor, { name: string; hex: string }> = {
  red: { name: 'Red', hex: '#cf4338' },
  orange: { name: 'Orange', hex: '#e07b1f' },
  gold: { name: 'Gold', hex: '#c99a14' },
  green: { name: 'Green', hex: '#3f9a58' },
  teal: { name: 'Teal', hex: '#1f9a98' },
  blue: { name: 'Blue', hex: '#2f80c8' },
  indigo: { name: 'Indigo', hex: '#4f61cf' },
  violet: { name: 'Violet', hex: '#8f5ccc' },
  pink: { name: 'Pink', hex: '#cf5a8a' },
  slate: { name: 'Slate', hex: '#6f7b88' },
}

export const GOAL_COLOR_LIST = GOAL_COLORS.map((id) => ({ id, ...GOAL_SWATCHES[id] }))

/** `--goal`, the colour of a goal's tag, as a CSS variable (nothing for a goal with no colour). */
export function goalColorVars(color: GoalColor | undefined): CSSProperties {
  return color === undefined ? {} : ({ '--goal': GOAL_SWATCHES[color].hex } as CSSProperties)
}
