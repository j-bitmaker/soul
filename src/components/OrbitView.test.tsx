import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeedMap } from '../domain/seed'
import { DirectionsSwitch, OrbitView, readDirectionsView, writeDirectionsView } from './OrbitView'

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('directions view choice', () => {
  it('defaults to Cards and remembers Orbit', () => {
    expect(readDirectionsView()).toBe('cards')
    writeDirectionsView('orbit')
    expect(readDirectionsView()).toBe('orbit')
    writeDirectionsView('cards')
    expect(readDirectionsView()).toBe('cards')
  })

  it('treats an unknown stored value as Cards', () => {
    window.localStorage.setItem('soul-directions-view', 'spiral')
    expect(readDirectionsView()).toBe('cards')
  })

  it('carries on when the browser refuses storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readDirectionsView()).toBe('cards')
    expect(() => writeDirectionsView('orbit')).not.toThrow()
  })
})

describe('DirectionsSwitch', () => {
  it('marks the current view and reports the other one', () => {
    const onChange = vi.fn()
    render(<DirectionsSwitch view="cards" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Orbit' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Orbit' }))
    expect(onChange).toHaveBeenCalledWith('orbit')
    fireEvent.click(screen.getByRole('button', { name: 'Cards' }))
    expect(onChange).toHaveBeenLastCalledWith('cards')
  })
})

describe('OrbitView', () => {
  it('shows Soul and the three directions as buttons, in reading order', () => {
    render(<OrbitView map={createSeedMap()} onSelect={vi.fn()} />)
    const nodes = screen.getAllByRole('button')
    expect(nodes.map((node) => node.textContent)).toEqual(['Understand & Express', 'Create & Be Free', 'Self-Mastery'])
    expect(document.querySelector('.orbit-soul')).toHaveTextContent('Soul')
  })

  it('opens the direction that was chosen', () => {
    const onSelect = vi.fn()
    render(<OrbitView map={createSeedMap()} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Create & Be Free' }))
    expect(onSelect).toHaveBeenCalledWith('create')
    fireEvent.click(screen.getByRole('button', { name: 'Self-Mastery' }))
    expect(onSelect).toHaveBeenLastCalledWith('mastery')
  })

  it('draws two-way spokes and clockwise arcs, hidden from assistive technology', () => {
    render(<OrbitView map={createSeedMap()} onSelect={vi.fn()} />)
    const svg = document.querySelector('svg.orbit-arrows') as SVGElement
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg.querySelectorAll('.orbit-spoke')).toHaveLength(3)
    expect(svg.querySelectorAll('.orbit-arc')).toHaveLength(3)
    for (const spoke of svg.querySelectorAll('.orbit-spoke')) {
      expect(spoke).toHaveAttribute('marker-start')
      expect(spoke).toHaveAttribute('marker-end')
    }
    for (const arc of svg.querySelectorAll('.orbit-arc')) {
      expect(arc).not.toHaveAttribute('marker-start')
      expect(arc).toHaveAttribute('marker-end')
    }
    expect(screen.getByText(/Each direction leads to the next/)).toHaveClass('visually-hidden')
  })

  it('lights the lines of the direction being pointed at or focused, and only those', () => {
    render(<OrbitView map={createSeedMap()} onSelect={vi.fn()} />)
    const orbit = document.querySelector('.orbit') as HTMLElement
    const create = screen.getByRole('button', { name: 'Create & Be Free' })
    expect(orbit).not.toHaveAttribute('data-focus')
    expect(document.querySelector('.is-lit, .is-dim')).toBeNull()

    fireEvent.mouseEnter(create)
    expect(orbit).toHaveAttribute('data-focus', '1')
    expect(document.querySelectorAll('.orbit-spoke.is-lit')).toHaveLength(1)
    // Create touches the arc that leaves it and the arc that arrives at it.
    expect(document.querySelectorAll('.orbit-arc.is-lit')).toHaveLength(2)
    expect(document.querySelectorAll('.orbit-spoke.is-dim')).toHaveLength(2)
    expect(document.querySelectorAll('.orbit-arc.is-dim')).toHaveLength(1)

    fireEvent.mouseLeave(create)
    expect(orbit).not.toHaveAttribute('data-focus')
    expect(document.querySelector('.is-lit, .is-dim')).toBeNull()

    fireEvent.focus(create)
    expect(orbit).toHaveAttribute('data-focus', '1')
    fireEvent.blur(create)
    expect(orbit).not.toHaveAttribute('data-focus')
  })

  it('leaves out a direction that is missing from the map', () => {
    const map = createSeedMap()
    delete map.nodes.create
    render(<OrbitView map={map} onSelect={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})
