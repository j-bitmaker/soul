import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WarmthMeter } from './WarmthMeter'

describe('WarmthMeter for the owner', () => {
  it('offers eleven steps from 0 to 10 and says what is set', () => {
    render(<WarmthMeter title="Practical Agency" value={7} editable />)
    const group = screen.getByRole('group', { name: /Warmth of Practical Agency, 0 to 10/ })
    const steps = screen.getAllByRole('radio')
    expect(group).toBeVisible()
    expect(steps).toHaveLength(11)
    expect(steps.map((step) => (step as HTMLInputElement).value)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
    expect(screen.getByRole('radio', { name: '7, Warm' })).toBeChecked()
    expect(document.querySelector('.warmth-head')).toHaveTextContent('Warmth7/10 · Warm')
    expect(document.querySelector('.warmth-flag')).toBeNull()
    expect(document.querySelectorAll('.warmth-step.on')).toHaveLength(8)
    expect(document.querySelector('.warmth-step.current')).not.toBeNull()
  })

  it('sets the value on a tap and clears it when the chosen step is tapped again', () => {
    const onChange = vi.fn()
    render(<WarmthMeter title="Self-Mastery" value={4} editable onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: '9, Very Warm' }))
    expect(onChange).toHaveBeenLastCalledWith(9)
    fireEvent.click(screen.getByRole('radio', { name: '4, Cooling' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('invites a first value when none is set, and can set 0', () => {
    const onChange = vi.fn()
    render(<WarmthMeter title="Self-Mastery" editable onChange={onChange} />)
    expect(screen.getByText('Not set')).toBeVisible()
    expect(document.querySelectorAll('.warmth-step.on')).toHaveLength(0)
    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0)
    fireEvent.click(screen.getByRole('radio', { name: '0, Cold' }))
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('cannot be changed while a save is running', () => {
    const onChange = vi.fn()
    render(<WarmthMeter title="Self-Mastery" value={3} editable disabled onChange={onChange} />)
    for (const step of screen.getAllByRole('radio')) expect(step).toBeDisabled()
    expect(screen.getByRole('group')).toBeDisabled()
  })
})

describe('WarmthMeter and attention', () => {
  it('flags the cold values as needing attention, for the owner and for everyone else, and no others', () => {
    for (const value of [0, 1, 2]) {
      const rendered = render(<WarmthMeter title="Self-Mastery" value={value} editable={false} />)
      expect(document.querySelector('.warmth-flag')).toHaveTextContent('Needs attention')
      expect(screen.getByRole('img', { name: `Warmth of Self-Mastery: ${value} of 10, Cold, needs attention` })).toBeVisible()
      rendered.unmount()
    }
    for (const value of [3, 5, 8, 10]) {
      const rendered = render(<WarmthMeter title="Self-Mastery" value={value} editable />)
      expect(document.querySelector('.warmth-flag')).toBeNull()
      rendered.unmount()
    }
    render(<WarmthMeter title="Self-Mastery" value={1} editable />)
    expect(document.querySelector('.warmth-flag')).toHaveTextContent('Needs attention')
    expect(screen.getByText('Cold', { selector: '.warmth-ends span' })).toBeVisible()
    expect(screen.getByText('Very warm')).toBeVisible()
  })

  it('fills the steps up to the value and leaves the rest as a faint scale', () => {
    render(<WarmthMeter title="Self-Mastery" value={3} editable />)
    const steps = [...document.querySelectorAll('.warmth-step')]
    expect(steps.map((step) => step.classList.contains('on'))).toEqual([true, true, true, true, ...Array(7).fill(false)])
    expect(steps.filter((step) => step.classList.contains('current'))).toHaveLength(1)
    expect((steps[10] as HTMLElement).style.getPropertyValue('--step')).toBe('#366349')
  })
})

describe('WarmthMeter for everyone else', () => {
  it('shows where it stands as a picture with a text alternative, and nothing to press', () => {
    render(<WarmthMeter title="Practical Agency" value={9} editable={false} />)
    expect(screen.getByRole('img', { name: 'Warmth of Practical Agency: 9 of 10, Very Warm' })).toBeVisible()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(document.querySelector('.warmth-head')).toHaveTextContent('Warmth9/10 · Very Warm')
    expect(document.querySelector('.warmth-ends')).toBeNull()
    expect(document.querySelector('.warmth-flag')).toBeNull()
  })

  it('shows nothing at all when no value is set', () => {
    const { container } = render(<WarmthMeter title="Practical Agency" editable={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})
