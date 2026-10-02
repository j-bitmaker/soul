import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GoalColorMenu } from './GoalColorMenu'
import { GOAL_SWATCHES } from './goalColors'

function menu(overrides: Partial<Parameters<typeof GoalColorMenu>[0]> = {}) {
  const onChange = vi.fn()
  const view = render(<GoalColorMenu title="Launch Blog" onChange={onChange} {...overrides} />)
  return { onChange, ...view }
}
const trigger = () => screen.getByRole('button', { name: 'Color of Launch Blog' })

describe('GoalColorMenu', () => {
  it('shows a quiet empty dot until a colour is chosen, and the colour afterwards', () => {
    const { rerender } = menu()
    expect(trigger().querySelector('.goal-dot')).toHaveAttribute('data-empty')
    expect(trigger()).toHaveAttribute('title', 'Choose a color')
    rerender(<GoalColorMenu title="Launch Blog" value="teal" onChange={vi.fn()} />)
    expect(trigger().querySelector('.goal-dot')).not.toHaveAttribute('data-empty')
    expect((trigger().querySelector('.goal-dot') as HTMLElement).style.getPropertyValue('--goal')).toBe(GOAL_SWATCHES.teal.hex)
    expect(trigger()).toHaveAttribute('title', 'Color: Teal')
  })

  it('opens a palette of ten colours on one tap, and saves a colour with the next', () => {
    const { onChange } = menu()
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger())
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('group', { name: 'Color of Launch Blog' })).toBeVisible()
    expect(screen.getAllByRole('button', { pressed: false }).filter((button) => button.classList.contains('color-swatch'))).toHaveLength(10)
    fireEvent.click(screen.getByRole('button', { name: 'Violet' }))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('violet')
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })

  it('marks the chosen colour, starts on it, and clears it when it is tapped again or with "No color"', () => {
    const { onChange } = menu({ value: 'green' })
    fireEvent.click(trigger())
    expect(screen.getByRole('button', { name: 'Green' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Green' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Blue' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Green' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('button', { name: 'No color' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('has nothing to clear when no colour is set', () => {
    menu()
    fireEvent.click(trigger())
    expect(screen.getByRole('button', { name: 'No color' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Red' })).toHaveFocus()
  })

  it('moves between colours with the arrow keys in the grid, and stops at the ends', () => {
    menu()
    fireEvent.click(trigger())
    const press = (key: string) => fireEvent.keyDown(document.activeElement as HTMLElement, { key })
    press('ArrowRight')
    expect(screen.getByRole('button', { name: 'Orange' })).toHaveFocus()
    press('ArrowDown') // five to a row
    expect(screen.getByRole('button', { name: 'Indigo' })).toHaveFocus()
    press('ArrowLeft')
    expect(screen.getByRole('button', { name: 'Blue' })).toHaveFocus()
    press('ArrowUp')
    expect(screen.getByRole('button', { name: 'Red' })).toHaveFocus()
    for (let step = 0; step < 3; step += 1) press('ArrowLeft') // stops at the first
    expect(screen.getByRole('button', { name: 'Red' })).toHaveFocus()
    press('ArrowDown'); press('ArrowDown'); press('ArrowDown') // and at the last
    expect(screen.getByRole('button', { name: 'Slate' })).toHaveFocus()
    press('a') // other keys do nothing
    expect(screen.getByRole('button', { name: 'Slate' })).toHaveFocus()
  })

  it('closes with Escape and returns to the dot, and closes when you press elsewhere', () => {
    menu()
    fireEvent.click(trigger())
    fireEvent.keyDown(screen.getByRole('button', { name: 'Red' }), { key: 'Escape' })
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
    fireEvent.click(trigger())
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    fireEvent.click(trigger())
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Blue' }))
    expect(screen.getByRole('group')).toBeVisible()
    fireEvent.click(trigger())
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })

  it('cannot be opened while a save is running', () => {
    const { onChange } = menu({ disabled: true })
    expect(trigger()).toBeDisabled()
    fireEvent.click(trigger())
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
