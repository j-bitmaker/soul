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
    expect(screen.getByText('Warmth').parentElement).toHaveTextContent('7/10 · Warm')
    expect(document.querySelectorAll('.warmth-step.on')).toHaveLength(8)
    expect(document.querySelector('.warmth-step.current')).not.toBeNull()
  })

  it('sets the value on a tap and clears it when the chosen step is tapped again', () => {
    const onChange = vi.fn()
    render(<WarmthMeter title="Self-Mastery" value={4} editable onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: '9, Hot' }))
    expect(onChange).toHaveBeenLastCalledWith(9)
    fireEvent.click(screen.getByRole('radio', { name: '4, Steady' }))
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

describe('WarmthMeter for everyone else', () => {
  it('shows where it stands as a picture with a text alternative, and nothing to press', () => {
    render(<WarmthMeter title="Practical Agency" value={9} editable={false} />)
    expect(screen.getByRole('img', { name: 'Warmth of Practical Agency: 9 of 10, Hot' })).toBeVisible()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.getByText('Warmth').parentElement).toHaveTextContent('9/10 · Hot')
    expect(document.querySelector('.warmth-ends')).toBeNull()
  })

  it('shows nothing at all when no value is set', () => {
    const { container } = render(<WarmthMeter title="Practical Agency" editable={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})
