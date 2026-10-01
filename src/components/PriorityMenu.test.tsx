import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PriorityMenu } from './PriorityMenu'

function menu(overrides: Partial<Parameters<typeof PriorityMenu>[0]> = {}) {
  const onChoose = vi.fn()
  const view = render(<PriorityMenu title="Launch Blog" lane={null} canUp canDown full={false} limit={5} onChoose={onChoose} {...overrides} />)
  return { onChoose, ...view }
}

describe('PriorityMenu', () => {
  it('opens on the marker, puts focus on the first available item, and closes after a choice', () => {
    const { onChoose } = menu()
    const marker = screen.getByRole('button', { name: 'Priority of Launch Blog' })
    expect(marker).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(marker)
    expect(marker).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: /Put in focus/ })).toHaveFocus()
    fireEvent.click(screen.getByRole('menuitem', { name: /Move down/ }))
    expect(onChoose).toHaveBeenCalledWith('down')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('offers the right first item for the goal\'s standing and marks the dot', () => {
    const { rerender } = menu({ lane: 'active' })
    expect(screen.getByRole('button', { name: 'Priority of Launch Blog' }).querySelector('.lane-mark')).toHaveAttribute('data-lane', 'active')
    fireEvent.click(screen.getByRole('button', { name: 'Priority of Launch Blog' }))
    expect(screen.getByRole('menuitem', { name: /Take out of focus/ })).toBeVisible()
    expect(screen.queryByRole('menuitem', { name: /Put in focus/ })).not.toBeInTheDocument()
    rerender(<PriorityMenu title="Launch Blog" lane={null} canUp canDown full={false} limit={5} onChoose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Priority of Launch Blog' }).querySelector('.lane-mark')).not.toHaveAttribute('data-lane')
  })

  it('moves between items with the arrow keys, skipping disabled ones, and wraps around', () => {
    menu({ canUp: false })
    fireEvent.click(screen.getByRole('button', { name: 'Priority of Launch Blog' }))
    const menuEl = screen.getByRole('menu')
    expect(screen.getByRole('menuitem', { name: /Put in focus/ })).toHaveFocus()
    fireEvent.keyDown(menuEl, { key: 'ArrowDown' })
    expect(screen.getByRole('menuitem', { name: /Move down/ })).toHaveFocus() // Move up is disabled
    fireEvent.keyDown(menuEl, { key: 'ArrowDown' })
    expect(screen.getByRole('menuitem', { name: /Move to the Queue/ })).toHaveFocus()
    fireEvent.keyDown(menuEl, { key: 'ArrowDown' })
    expect(screen.getByRole('menuitem', { name: /Put in focus/ })).toHaveFocus()
    fireEvent.keyDown(menuEl, { key: 'ArrowUp' })
    expect(screen.getByRole('menuitem', { name: /Move to the Queue/ })).toHaveFocus()
  })

  it('closes with Escape and returns to the marker, and closes when you press elsewhere', () => {
    menu()
    const marker = screen.getByRole('button', { name: 'Priority of Launch Blog' })
    fireEvent.click(marker)
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(marker).toHaveFocus()
    fireEvent.click(marker)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    fireEvent.click(marker)
    fireEvent.pointerDown(screen.getByRole('menuitem', { name: /Move down/ }))
    expect(screen.getByRole('menu')).toBeVisible()
    fireEvent.keyDown(marker, { key: 'Escape' })
    fireEvent.click(marker)
    fireEvent.click(marker)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('refuses focus when it is full and cannot be used while a save is running', () => {
    const { rerender } = menu({ full: true })
    fireEvent.click(screen.getByRole('button', { name: 'Priority of Launch Blog' }))
    expect(screen.getByRole('menuitem', { name: /Put in focus/ })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: /Put in focus/ })).toHaveTextContent('Focus holds 5 at most')
    rerender(<PriorityMenu title="Launch Blog" lane={null} canUp canDown full={false} limit={5} disabled onChoose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Priority of Launch Blog' })).toBeDisabled()
  })
})
