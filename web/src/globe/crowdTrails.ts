import type { ScreenBox } from './cityNameBox'
import { trailCorners, type FirstLeg, type Point } from './trailRoute'

/** A score card with room, as the card layout has placed it: its center on screen, its size, its venue, and whether it was moved aside. */
export interface PlacedBox {
  gameId: string
  moved: boolean
  x: number
  y: number
  width: number
  height: number
  venueX: number
  venueY: number
}

/** What a card handed a new spot keeps clear of, as the card layout's placing does (see cardLayout's arrange). */
export interface KeepClear {
  /** The map's size on screen. */
  width: number
  height: number
  /** How far a card keeps from its own venue. */
  venueGap: number
  /** Space kept between cards, and from names. */
  gap: number
  /** Half the size of the spot around each venue that cards keep clear of. */
  venueRadius: number
  /** Every venue being laid out, whether its card has room or not. */
  venues: readonly Point[]
  names: readonly ScreenBox[]
}

// Venues within this many pixels of each other on screen, linked one to the next, are one crowd: about
// one city's, so cards aren't handed between cities.
const crowdRadius = 90

/**
 * Hands each crowd's moved cards round the spots they've been moved to (a card above its venue keeps
 * its place), so they go round the crowd's middle
 * in the same order as their venues do, and their trails don't cross: where that leaves fewer trails
 * crossing than before, and every card fits its new spot. Of the ways round, the one with the shortest
 * trails. Cards placed this way last time stay put, as their trails already cross no more than they
 * would handed round. Gives each card's center, moved or not.
 */
export function untangle(cards: readonly PlacedBox[], clear: KeepClear): Map<string, Point> {
  const at = new Map(cards.map((card) => [card.gameId, { x: card.x, y: card.y }]))
  for (const all of crowdsOf(cards)) {
    const crowd = all.filter(({ moved }) => moved)
    if (crowd.length < 2) continue
    const middle = {
      x: crowd.reduce((sum, card) => sum + card.venueX, 0) / crowd.length,
      y: crowd.reduce((sum, card) => sum + card.venueY, 0) / crowd.length,
    }
    const angle = (x: number, y: number) => Math.atan2(y - middle.y, x - middle.x)
    const spots = crowd.map(({ gameId }) => at.get(gameId)!).sort((a, b) => angle(a.x, a.y) - angle(b.x, b.y))
    const byVenue = [...crowd].sort((a, b) => angle(a.venueX, a.venueY) - angle(b.venueX, b.venueY))
    let best: Map<string, Point> | undefined
    let shortest = Infinity
    for (let turn = 0; turn < spots.length; turn++) {
      const handed = new Map(byVenue.map((card, i) => [card.gameId, spots[(i + turn) % spots.length]]))
      const length = byVenue.reduce((sum, card) => sum + Math.hypot(handed.get(card.gameId)!.x - card.venueX, handed.get(card.gameId)!.y - card.venueY), 0)
      if (length < shortest) [best, shortest] = [handed, length]
    }
    const before = new Map(all.map(({ gameId }) => [gameId, at.get(gameId)!]))
    const handed = new Map([...before, ...best!])
    if (crossings(all, handed) >= crossings(all, before)) continue
    const after = new Map(at)
    for (const [gameId, spot] of best!) after.set(gameId, spot)
    // A card left where it was fits as placing found it (which allows it a little drift).
    const handedOn = crowd.filter(({ gameId }) => best!.get(gameId) !== before.get(gameId))
    if (handedOn.every((card) => fitsAt(card, after, cards, clear))) for (const [gameId, spot] of best!) at.set(gameId, spot)
  }
  return at
}

/** Cards whose venues are near each other, linked one to the next. */
function crowdsOf(cards: readonly PlacedBox[]): PlacedBox[][] {
  const crowd = cards.map((_, i) => i)
  const root = (i: number): number => (crowd[i] === i ? i : (crowd[i] = root(crowd[i])))
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++)
      if (Math.hypot(cards[i].venueX - cards[j].venueX, cards[i].venueY - cards[j].venueY) < crowdRadius) crowd[root(i)] = root(j)
  const crowds = new Map<number, PlacedBox[]>()
  cards.forEach((card, i) => crowds.set(root(i), [...(crowds.get(root(i)) ?? []), card]))
  return [...crowds.values()]
}

/** How many pairs of the crowd's trails cross, each drawn from its card's center to its venue. */
function crossings(crowd: readonly PlacedBox[], at: ReadonlyMap<string, Point>): number {
  let count = 0
  for (let i = 0; i < crowd.length; i++)
    for (let j = i + 1; j < crowd.length; j++) {
      const [a, b] = [crowd[i], crowd[j]]
      if (linesCross(at.get(a.gameId)!, { x: a.venueX, y: a.venueY }, at.get(b.gameId)!, { x: b.venueX, y: b.venueY })) count++
    }
  return count
}

/** Whether a card fits centered where `at` has it: on screen, clear of the other cards, the venues and the names. */
function fitsAt(card: PlacedBox, at: ReadonlyMap<string, Point>, cards: readonly PlacedBox[], clear: KeepClear): boolean {
  const { x, y } = at.get(card.gameId)!
  const inside = (boxX: number, boxY: number, halfWidth: number, halfHeight: number) =>
    Math.abs(x - boxX) < card.width / 2 + halfWidth && Math.abs(y - boxY) < card.height / 2 + halfHeight
  if (x - card.width / 2 < 0 || x + card.width / 2 > clear.width || y - card.height / 2 < 0 || y + card.height / 2 > clear.height) return false
  for (const other of cards) {
    if (other === card) continue
    const there = at.get(other.gameId)!
    if (inside(there.x, there.y, other.width / 2 + clear.gap, other.height / 2 + clear.gap)) return false
  }
  for (const venue of clear.venues) {
    const own = venue.x === card.venueX && venue.y === card.venueY
    const reach = own ? clear.venueGap : clear.venueRadius
    if (inside(venue.x, venue.y, reach, reach)) return false
  }
  return !clear.names.some((name) => inside(name.x, name.y, name.width / 2 + clear.gap, name.height / 2 + clear.gap))
}

/** A card's trail as routed: where it leaves the card, and which way it goes first (see trailCorners). */
export interface Route {
  from: Point
  firstLeg: FirstLeg
}

// What a route costs, to pick the cheapest: crossing its own card, crossing another card, crossing a
// trail routed already, and each pixel of its length.
const cost = { ownCard: 1000, card: 100, trail: 20, pixel: 0.05 }

/**
 * Routes each moved card's trail to its venue, in the order given: leaving the card where it faces its
 * venue, or from the middle of a side, and going straight or at 45° first, whichever crosses the fewest
 * cards, then the fewest trails routed already, then is shortest. A card that isn't moved keeps its
 * trail straight down to its venue below.
 */
export function routeTrails(cards: readonly PlacedBox[]): Map<string, Route> {
  const routes = new Map<string, Route>()
  const routed: Point[][] = []
  for (const card of cards) {
    const venue = { x: card.venueX, y: card.venueY }
    const facing = facingEdge(card)
    if (!card.moved) {
      routes.set(card.gameId, { from: facing, firstLeg: 'straight' })
      routed.push([facing, venue])
      continue
    }
    const exits = [
      facing,
      { x: card.x, y: card.y - card.height / 2 },
      { x: card.x, y: card.y + card.height / 2 },
      { x: card.x - card.width / 2, y: card.y },
      { x: card.x + card.width / 2, y: card.y },
    ]
    let best: { route: Route; corners: Point[]; cost: number } | undefined
    for (const from of exits)
      for (const firstLeg of ['straight', 'diagonal'] as const) {
        const corners = trailCorners(from, venue, firstLeg)
        let total = 0
        for (let i = 1; i < corners.length; i++) {
          const [a, b] = [corners[i - 1], corners[i]]
          // A piece leaving along the card's edge doesn't cross it: the card shrunk a little.
          if (lineCrossesBox(a, b, card, -1.5)) total += cost.ownCard
          for (const other of cards) if (other !== card && lineCrossesBox(a, b, other, 0)) total += cost.card
          for (const trail of routed) for (let j = 1; j < trail.length; j++) if (linesCross(a, b, trail[j - 1], trail[j])) total += cost.trail
          total += Math.hypot(b.x - a.x, b.y - a.y) * cost.pixel
        }
        if (!best || total < best.cost) best = { route: { from, firstLeg }, corners, cost: total }
      }
    routes.set(card.gameId, best!.route)
    routed.push(best!.corners)
  }
  return routes
}

/** Where a line from a card's center to its venue leaves the card. */
function facingEdge({ x, y, width, height, venueX, venueY }: PlacedBox): Point {
  const toX = venueX - x
  const toY = venueY - y
  const edge = Math.min(1, width / 2 / Math.abs(toX), height / 2 / Math.abs(toY))
  return { x: x + toX * edge, y: y + toY * edge }
}

/** Whether two lines cross, other than where they only touch at an end. */
function linesCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0
}

/** Whether a line passes through a box, given by its center and size, grown by `grow` pixels each way. */
function lineCrossesBox(a: Point, b: Point, box: { x: number; y: number; width: number; height: number }, grow: number): boolean {
  let from = 0
  let to = 1
  for (const [start, delta, low, high] of [
    [a.x, b.x - a.x, box.x - box.width / 2 - grow, box.x + box.width / 2 + grow],
    [a.y, b.y - a.y, box.y - box.height / 2 - grow, box.y + box.height / 2 + grow],
  ]) {
    if (delta === 0) {
      if (start <= low || start >= high) return false
      continue
    }
    const p = (low - start) / delta
    const q = (high - start) / delta
    from = Math.max(from, Math.min(p, q))
    to = Math.min(to, Math.max(p, q))
    if (from >= to) return false
  }
  return true
}
