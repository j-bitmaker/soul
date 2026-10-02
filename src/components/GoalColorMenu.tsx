import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { GoalColor } from '../domain/types'
import { GOAL_COLOR_LIST, GOAL_SWATCHES, goalColorVars } from './goalColors'

/**
 * A goal's colour tag: a small dot (a quiet dashed ring until a colour is chosen) that opens a palette of ten
 * colours. One tap on the dot, one tap on a colour, and it is saved. Tapping the chosen colour again, or "No color",
 * clears it. The palette is plain buttons (not a drag or a slider), so scrolling is never in the way, and it works
 * with the arrow keys, Enter, and Escape.
 */
export function GoalColorMenu({ title, value, disabled, className = '', onChange }: {
  title: string
  value?: GoalColor
  disabled?: boolean
  className?: string
  onChange: (color: GoalColor | null) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const palette = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    const swatches = palette.current?.querySelectorAll<HTMLButtonElement>('.color-swatch')
    ;(palette.current?.querySelector<HTMLButtonElement>('.color-swatch[aria-pressed="true"]') ?? swatches?.[0])?.focus()
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      trigger.current?.focus()
      return
    }
    const step = { ArrowRight: 1, ArrowDown: 5, ArrowLeft: -1, ArrowUp: -5 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    const items = [...(palette.current?.querySelectorAll<HTMLButtonElement>('.color-swatch') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    items[Math.max(0, Math.min(items.length - 1, at + step))]?.focus()
  }

  function choose(color: GoalColor | null): void {
    setOpen(false)
    onChange(color)
  }

  return <span className={`color-menu ${className}`.trim()} ref={root}>
    <button ref={trigger} type="button" className="color-trigger" aria-haspopup="true" aria-expanded={open}
      aria-label={`Color of ${title}`} title={value ? `Color: ${GOAL_SWATCHES[value].name}` : 'Choose a color'}
      disabled={disabled} onClick={() => setOpen(!open)} onKeyDown={onKeyDown}>
      <span className="goal-dot" data-empty={value === undefined ? '' : undefined} style={goalColorVars(value)} aria-hidden="true" />
    </button>
    {open && <div className="color-popover" role="group" aria-label={`Color of ${title}`} ref={palette}>
      <div className="color-grid">
        {GOAL_COLOR_LIST.map((color) => <button key={color.id} type="button" className="color-swatch" aria-label={color.name} title={color.name}
          aria-pressed={color.id === value} style={goalColorVars(color.id)} onKeyDown={onKeyDown}
          onClick={() => choose(color.id === value ? null : color.id)} />)}
      </div>
      <button type="button" className="color-clear" disabled={value === undefined} onKeyDown={onKeyDown} onClick={() => choose(null)}>No color</button>
    </div>}
  </span>
}
