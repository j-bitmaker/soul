import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeedMap } from '../domain/seed'
import { DirectionsSwitch, OrbitView, readDirectionsView, writeDirectionsView } from './OrbitView'
import { warmthColor } from './warmth'

/** jsdom hands colours back as rgb(); compare in that form. */
const hex = (colour: string): string => {
  const [red, green, blue] = [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16))
  return `rgb(${red}, ${green}, ${blue})`
}

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
    expect(nodes.map((node) => node.textContent)).toEqual(['Understand & Express', 'Practical Agency', 'Self-Mastery'])
    expect(document.querySelector('.orbit-soul')).toHaveTextContent('Soul')
  })

  it('opens the direction that was chosen', () => {
    const onSelect = vi.fn()
    render(<OrbitView map={createSeedMap()} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Practical Agency' }))
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
    const create = screen.getByRole('button', { name: 'Practical Agency' })
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

describe('OrbitView and warmth', () => {
  const warm = () => {
    const map = createSeedMap()
    map.nodes.understand.warmth = 2
    map.nodes.create.warmth = 9
    return map
  }

  it('colours a direction by its warmth, shows the value on it, and describes it without changing its name', () => {
    render(<OrbitView map={warm()} onSelect={vi.fn()} />)
    const hot = screen.getByRole('button', { name: 'Practical Agency' })
    expect(hot).toHaveAttribute('data-warm')
    expect(hot.style.getPropertyValue('--tone')).toBe(warmthColor(9))
    expect(hot.querySelector('.orbit-heat')).toHaveTextContent('9')
    expect(hot).toHaveAccessibleDescription('Warmth 9 of 10, Hot')
    const plain = screen.getByRole('button', { name: 'Self-Mastery' })
    expect(plain).not.toHaveAttribute('data-warm')
    expect(plain.querySelector('.orbit-heat')).toBeNull()
    expect(plain).not.toHaveAttribute('aria-describedby')
  })

  it('draws the arrows in the directions\' warmth colours, and in their own colours until there is a value', () => {
    render(<OrbitView map={warm()} onSelect={vi.fn()} />)
    const stops = [...document.querySelectorAll<SVGStopElement>('linearGradient stop')].map((stop) => stop.style.stopColor)
    // understand -> create, create -> mastery, mastery -> understand
    expect(stops).toEqual([hex(warmthColor(2)), hex(warmthColor(9)), hex(warmthColor(9)), 'var(--gold)', 'var(--gold)', hex(warmthColor(2))])
    const heads = [...document.querySelectorAll<SVGPathElement>('marker:not(#orbit-arrow-muted) .orbit-head')].map((head) => head.style.stroke)
    expect(heads).toEqual([hex(warmthColor(2)), hex(warmthColor(9)), 'var(--gold)'])
    for (const arc of document.querySelectorAll('.orbit-arc')) expect(arc.getAttribute('marker-end')).toMatch(/^url\(#orbit-arrow-[012]\)$/)
  })

  it('lists every direction\'s warmth under the diagram, and lets the owner set it there', () => {
    const onWarmth = vi.fn()
    const rendered = render(<OrbitView map={warm()} onSelect={vi.fn()} canEdit onWarmth={onWarmth} />)
    const panel = document.querySelector('.orbit-warmth') as HTMLElement
    expect(panel.querySelectorAll('.orbit-warmth-row')).toHaveLength(3)
    const row = (title: string) => within([...panel.querySelectorAll<HTMLElement>('.orbit-warmth-row')].find((item) => item.textContent?.startsWith(title)) as HTMLElement)
    expect(row('Practical Agency').getByRole('radio', { name: '9, Hot' })).toBeChecked()
    fireEvent.click(row('Self-Mastery').getByRole('radio', { name: '5, Steady' }))
    expect(onWarmth).toHaveBeenLastCalledWith('mastery', 5)
    fireEvent.click(row('Practical Agency').getByRole('radio', { name: '9, Hot' }))
    expect(onWarmth).toHaveBeenLastCalledWith('create', null)
    // the panel is all there is to the owner's controls: the diagram itself still has its three buttons
    expect(screen.getAllByRole('button')).toHaveLength(3)
    rendered.rerender(<OrbitView map={warm()} onSelect={vi.fn()} />)
    expect(within(panel).queryAllByRole('radio')).toHaveLength(0)
    expect(within(panel).getByRole('img', { name: 'Warmth of Practical Agency: 9 of 10, Hot' })).toBeVisible()
    expect(within(panel).queryByRole('img', { name: /Self-Mastery/ })).not.toBeInTheDocument()
  })

  it('shows visitors no panel when no direction has a value, and the owner an empty one to fill', () => {
    const rendered = render(<OrbitView map={createSeedMap()} onSelect={vi.fn()} />)
    expect(document.querySelector('.orbit-warmth')).toBeNull()
    rendered.rerender(<OrbitView map={createSeedMap()} onSelect={vi.fn()} canEdit />)
    expect(document.querySelectorAll('.orbit-warmth .warmth-name')).toHaveLength(3)
  })

  it('lists the panel cooler first in one column', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    render(<OrbitView map={warm()} onSelect={vi.fn()} canEdit />)
    expect([...document.querySelectorAll('.orbit-warmth-title')].map((title) => title.textContent))
      .toEqual(['Self-Mastery', 'Understand & Express', 'Practical Agency'])
    vi.unstubAllGlobals()
  })
})
})
