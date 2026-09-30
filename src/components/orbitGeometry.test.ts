import { describe, expect, it } from 'vitest'
import { insideNode, ORBIT, orbitLayout, type Point } from './orbitGeometry'

const centre: Point = { x: ORBIT.cx, y: ORBIT.cy }
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)
const sweep = (from: Point, to: Point): number => {
  const angle = (point: Point): number => Math.atan2(point.y - ORBIT.cy, point.x - ORBIT.cx)
  return (((angle(to) - angle(from)) * 180) / Math.PI + 360) % 360
}

describe('orbitLayout', () => {
  const layout = orbitLayout()

  it('puts the three directions on the ring at 12, 4 and 8 o’clock', () => {
    expect(layout.nodes).toHaveLength(3)
    for (const node of layout.nodes) expect(distance(node, centre)).toBeCloseTo(ORBIT.radius, 6)
    expect(layout.nodes[0].x).toBeCloseTo(ORBIT.cx, 6)
    expect(layout.nodes[0].y).toBeLessThan(ORBIT.cy)
    expect(layout.nodes[1].x).toBeGreaterThan(ORBIT.cx)
    expect(layout.nodes[2].x).toBeLessThan(ORBIT.cx)
    expect(layout.nodes[1].y).toBeGreaterThan(ORBIT.cy)
    expect(layout.nodes[2].y).toBeGreaterThan(ORBIT.cy)
  })

  it('keeps every node box, and every arrow end, inside the stage', () => {
    for (const node of layout.nodes) {
      expect(node.x - ORBIT.nodeWidth / 2).toBeGreaterThanOrEqual(0)
      expect(node.x + ORBIT.nodeWidth / 2).toBeLessThanOrEqual(ORBIT.width)
      expect(node.y - ORBIT.nodeHeight / 2).toBeGreaterThanOrEqual(0)
      expect(node.y + ORBIT.nodeHeight / 2).toBeLessThanOrEqual(ORBIT.height)
    }
    for (const link of [...layout.spokes, ...layout.arcs]) {
      for (const point of [link.start, link.end]) {
        expect(point.x).toBeGreaterThanOrEqual(0)
        expect(point.x).toBeLessThanOrEqual(ORBIT.width)
        expect(point.y).toBeGreaterThanOrEqual(0)
        expect(point.y).toBeLessThanOrEqual(ORBIT.height)
      }
    }
  })

  it('does not let the nodes overlap each other or the Soul disc', () => {
    layout.nodes.forEach((node, index) => {
      expect(distance(node, centre) - ORBIT.soulRadius).toBeGreaterThan(ORBIT.nodeHeight / 2)
      layout.nodes.slice(index + 1).forEach((other) => {
        const apart = Math.abs(node.x - other.x) >= ORBIT.nodeWidth || Math.abs(node.y - other.y) >= ORBIT.nodeHeight
        expect(apart).toBe(true)
      })
    })
  })

  it('joins Soul to each direction with a spoke that starts outside the disc and stops outside the node', () => {
    expect(layout.spokes).toHaveLength(3)
    layout.spokes.forEach((spoke, index) => {
      expect(spoke.ends).toEqual([index])
      expect(distance(spoke.start, centre)).toBeGreaterThanOrEqual(ORBIT.soulRadius)
      expect(insideNode(spoke.end, layout.nodes[index], 0)).toBe(false)
      expect(insideNode(spoke.end, layout.nodes[index], ORBIT.gap + 0.01)).toBe(true)
      expect(spoke.d).toMatch(/^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/)
    })
  })

  it('leads each direction to the next by a clockwise arc on the ring, clear of both nodes', () => {
    expect(layout.arcs).toHaveLength(3)
    layout.arcs.forEach((arc, index) => {
      const next = (index + 1) % 3
      expect(arc.ends).toEqual([index, next])
      expect(distance(arc.start, centre)).toBeCloseTo(ORBIT.radius, 1)
      expect(distance(arc.end, centre)).toBeCloseTo(ORBIT.radius, 1)
      expect(insideNode(arc.start, layout.nodes[index], 0)).toBe(false)
      expect(insideNode(arc.end, layout.nodes[next], 0)).toBe(false)
      const travelled = sweep(arc.start, arc.end)
      expect(travelled).toBeGreaterThan(10)
      expect(travelled).toBeLessThan(120)
      expect(arc.d).toContain(`A${ORBIT.radius} ${ORBIT.radius} 0 0 1`)
    })
  })

  it('is deterministic', () => {
    expect(orbitLayout()).toEqual(layout)
  })
})

describe('insideNode', () => {
  it('measures the node box, grown by the gap', () => {
    const node = { x: 50, y: 10 }
    expect(insideNode(node, node)).toBe(true)
    expect(insideNode({ x: 50 + ORBIT.nodeWidth / 2, y: 10 }, node, 0)).toBe(true)
    expect(insideNode({ x: 50 + ORBIT.nodeWidth / 2 + 0.5, y: 10 }, node, 0)).toBe(false)
    expect(insideNode({ x: 50 + ORBIT.nodeWidth / 2 + 0.5, y: 10 }, node)).toBe(true)
    expect(insideNode({ x: 50, y: 10 + ORBIT.nodeHeight / 2 + ORBIT.gap + 1 }, node)).toBe(false)
  })
})
