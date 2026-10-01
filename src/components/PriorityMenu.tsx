import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowDown, ArrowUp, Crosshair, ListEnd } from 'lucide-react'
import type { FrontierLane } from '../domain/types'

export type PriorityChoice = 'focus' | 'unfocus' | 'up' | 'down' | 'queue'

/**
 * The marker on a goal's row, made into the owner's priority control: the dot (filled when the goal is in focus,
 * a quiet ring when it is not) opens a small menu to put the goal in or out of focus, move it up or down among
 * goals of the same standing, or send it to the Queue.
 */
export function PriorityMenu({ title, lane, canUp, canDown, full, limit, disabled, onChoose }: {
  title: string
  lane: FrontierLane | null
  canUp: boolean
  canDown: boolean
  /** Focus is full, so this goal cannot enter it. */
  full: boolean
  limit: number
  disabled?: boolean
  onChoose: (choice: PriorityChoice) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const inFocus = lane === 'active'

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  function onKeyDown(event: KeyboardEvent): void {
    if (!open) return
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      trigger.current?.focus()
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
      const at = items.indexOf(document.activeElement as HTMLButtonElement)
      items[(at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
    }
  }

  function choose(choice: PriorityChoice): void {
    setOpen(false)
    onChoose(choice)
  }

  return <span className="priority" ref={root}>
    <button ref={trigger} type="button" className="priority-marker" aria-haspopup="menu" aria-expanded={open}
      aria-label={`Priority of ${title}`} title="Priority" disabled={disabled} onClick={() => setOpen(!open)} onKeyDown={onKeyDown}>
      <span className="lane-mark" data-lane={inFocus ? 'active' : undefined} aria-hidden="true" />
    </button>
    {open && <div className="priority-menu" role="menu" tabIndex={-1} aria-label={`Priority of ${title}`} ref={menu} onKeyDown={onKeyDown}>
      {inFocus
        ? <button type="button" role="menuitem" onClick={() => choose('unfocus')}><Crosshair aria-hidden="true" />Take out of focus</button>
        : <button type="button" role="menuitem" disabled={full} onClick={() => choose('focus')}>
          <Crosshair aria-hidden="true" />Put in focus{full && <span className="priority-hint">Focus holds {limit} at most</span>}
        </button>}
      <button type="button" role="menuitem" disabled={!canUp} onClick={() => choose('up')}><ArrowUp aria-hidden="true" />Move up</button>
      <button type="button" role="menuitem" disabled={!canDown} onClick={() => choose('down')}><ArrowDown aria-hidden="true" />Move down</button>
      <button type="button" role="menuitem" onClick={() => choose('queue')}>
        <ListEnd aria-hidden="true" />Move to the Queue<span className="priority-hint">Waits on its direction’s page</span>
      </button>
    </div>}
  </span>
}
