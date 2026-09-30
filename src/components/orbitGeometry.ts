/**
 * Geometry of the Orbit view: Soul in the centre, the three directions on a ring at 12, 4 and 8 o'clock.
 * Everything is in viewBox units (the stage is 100 x 80), so the arrows drawn in SVG and the HTML nodes
 * placed by percentage can never drift apart.
 */
export const ORBIT = {
  width: 100,
  height: 80,
  cx: 50,
  cy: 45,
  radius: 33,
  nodeWidth: 30,
  nodeHeight: 14,
  soulRadius: 9,
  gap: 1.6,
  /** Angles in degrees, clockwise from 3 o'clock (SVG y points down): top, lower right, lower left. */
  angles: [-90, 30, 150],
} as const

export interface Point { x: number; y: number }

export interface OrbitLink {
  /** Indexes into the directions this link touches, for highlighting. */
  ends: number[]
  d: string
  start: Point
  end: Point
}

export interface OrbitLayout {
  nodes: Point[]
  spokes: OrbitLink[]
  arcs: OrbitLink[]
}

const radians = (degrees: number): number => (degrees * Math.PI) / 180

function onRing(angle: number): Point {
  return { x: ORBIT.cx + ORBIT.radius * Math.cos(radians(angle)), y: ORBIT.cy + ORBIT.radius * Math.sin(radians(angle)) }
}

/** Is the point inside the node's box, grown by the gap so arrows stop just short of it? */
export function insideNode(point: Point, centre: Point, grow: number = ORBIT.gap): boolean {
  return Math.abs(point.x - centre.x) <= ORBIT.nodeWidth / 2 + grow && Math.abs(point.y - centre.y) <= ORBIT.nodeHeight / 2 + grow
}

/** Walk along the ring from a node's centre (direction +1 clockwise, -1 counter) to the first point outside its box. */
function leaveNode(angle: number, centre: Point, direction: 1 | -1): number {
  let inside = angle
  let outside = angle + direction * 170
  for (let step = 1; step <= 170; step += 1) {
    const candidate = angle + direction * step
    if (!insideNode(onRing(candidate), centre)) { outside = candidate; break }
    inside = candidate
  }
  for (let round = 0; round < 24; round += 1) {
    const middle = (inside + outside) / 2
    if (insideNode(onRing(middle), centre)) inside = middle
    else outside = middle
  }
  return outside
}

/** Where the straight line from Soul's centre towards a node first reaches the node's box. */
function reachNode(centre: Point): Point {
  let outside = 0
  let inside = 1
  for (let round = 0; round < 30; round += 1) {
    const middle = (outside + inside) / 2
    const point = { x: ORBIT.cx + (centre.x - ORBIT.cx) * middle, y: ORBIT.cy + (centre.y - ORBIT.cy) * middle }
    if (insideNode(point, centre)) inside = middle
    else outside = middle
  }
  return { x: ORBIT.cx + (centre.x - ORBIT.cx) * outside, y: ORBIT.cy + (centre.y - ORBIT.cy) * outside }
}

const fixed = (value: number): string => value.toFixed(2)

export function orbitLayout(): OrbitLayout {
  const nodes = ORBIT.angles.map(onRing)
  const spokes = nodes.map((centre, index): OrbitLink => {
    const length = Math.hypot(centre.x - ORBIT.cx, centre.y - ORBIT.cy)
    const reach = (ORBIT.soulRadius + ORBIT.gap) / length
    const start = { x: ORBIT.cx + (centre.x - ORBIT.cx) * reach, y: ORBIT.cy + (centre.y - ORBIT.cy) * reach }
    const end = reachNode(centre)
    return { ends: [index], start, end, d: `M${fixed(start.x)} ${fixed(start.y)} L${fixed(end.x)} ${fixed(end.y)}` }
  })
  const arcs = nodes.map((from, index): OrbitLink => {
    const next = (index + 1) % nodes.length
    const fromAngle = ORBIT.angles[index]
    const toAngle = fromAngle + 120
    const startAngle = leaveNode(fromAngle, from, 1)
    const endAngle = leaveNode(toAngle, nodes[next], -1)
    const start = onRing(startAngle)
    const end = onRing(endAngle)
    return { ends: [index, next], start, end,
      d: `M${fixed(start.x)} ${fixed(start.y)} A${ORBIT.radius} ${ORBIT.radius} 0 0 1 ${fixed(end.x)} ${fixed(end.y)}` }
  })
  return { nodes, spokes, arcs }
}
