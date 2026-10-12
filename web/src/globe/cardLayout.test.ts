import { describe, expect, it } from 'vitest'
import type { GameStatus } from '../games/game'
import { layOutCards, type CardLayout, type CardScene, type ScreenCard, type ScreenOffset } from './cardLayout'
import { cardJump } from './cardJump'
import type { ScreenBox } from './gameCities'

const pointer = 6
const scene: CardScene = { width: 1000, height: 800, pointer }
// The middle of the screen, where most of these cards are, with room all round.
const mx = 500
const my = 400

// A card 106 by 60 that would sit centred at (x, y), its venue just below it as score cards sit.
const card = (gameId: string, x: number, y: number, status: GameStatus = 'Live'): ScreenCard => ({
  gameId,
  status,
  venueX: x,
  venueY: y + 30 + pointer,
  width: 106,
  height: 60,
})

const games = (prefix: string, count: number, x: number, y: number, status: GameStatus) =>
  Array.from({ length: count }, (_, i) => card(`${prefix}${String(i).padStart(2, '0')}`, x + i, y, status))

/** A card where it ends up on screen, by its centre. */
interface Box extends ScreenBox {
  gameId: string
  venueX: number
  venueY: number
}

const lay = (cards: ScreenCard[], names: ScreenBox[] = []) => layOutCards(cards, { ...scene, names })

/** How far each card that has room is moved from where it would sit. */
function shiftsOf({ cards }: CardLayout): Map<string, ScreenOffset> {
  const shifts = new Map<string, ScreenOffset>()
  for (const [gameId, { offset, inCardCluster }] of cards) {
    if (!inCardCluster) shifts.set(gameId, { dx: offset.dx, dy: offset.dy + pointer })
  }
  return shifts
}

const spreadCards = (cards: ScreenCard[]) => shiftsOf(lay(cards))

function boxesOf(cards: ScreenCard[], layout: CardLayout): Box[] {
  return cards.map((c) => {
    const { offset } = layout.cards.get(c.gameId)!
    return { ...c, x: c.venueX + offset.dx, y: c.venueY + offset.dy - c.height / 2 }
  })
}

const placed = (cards: ScreenCard[], names: ScreenBox[] = []): Box[] => boxesOf(cards, lay(cards, names))

const unmoved = (cards: ScreenCard[]): Box[] =>
  cards.map((c) => ({ ...c, x: c.venueX, y: c.venueY - pointer - c.height / 2 }))

function overlaps(a: ScreenBox, b: ScreenBox): boolean {
  return Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2
}

// Samples along the line, which is plenty to catch a crossing at these sizes.
function lineCrossesCard(x1: number, y1: number, x2: number, y2: number, c: ScreenBox): boolean {
  for (let t = 0; t <= 1; t += 0.01) {
    const x = x1 + (x2 - x1) * t
    const y = y1 + (y2 - y1) * t
    if (Math.abs(x - c.x) < c.width / 2 && Math.abs(y - c.y) < c.height / 2) return true
  }
  return false
}

function anyOverlap(cards: ScreenBox[]): boolean {
  return cards.some((a, i) => cards.slice(i + 1).some((b) => overlaps(a, b)))
}

/** How long a moved card's trail is: from its venue to the card's nearest edge. */
const trailLength = (c: Box) =>
  Math.hypot(Math.max(0, Math.abs(c.venueX - c.x) - c.width / 2), Math.max(0, Math.abs(c.venueY - c.y) - c.height / 2))

const sitting = { offset: { dx: 0, dy: -pointer }, inCardCluster: false, trail: null }

describe('layOutCards', () => {
  it('sits a card with room just above its venue, its pointer on the spot, with no trail', () => {
    expect(lay([card('a', mx, my)]).cards.get('a')).toEqual(sitting)
  })

  it('gives games at the same venue a card each, side by side, clear of the venue', () => {
    const cards = placed([card('a', mx, my), card('b', mx, my), card('c', mx, my)])
    expect(anyOverlap(cards)).toBe(false)
    for (const c of cards) {
      const coversVenue = Math.abs(c.x - c.venueX) < c.width / 2 && Math.abs(c.y - c.venueY) < c.height / 2
      expect(coversVenue, c.gameId).toBe(false)
    }
  })

  it('leaves cards that already have room where they are', () => {
    const shifts = spreadCards([card('a', mx, my), card('b', mx + 200, my), card('c', mx, my + 100)])
    for (const shift of shifts.values()) expect(shift).toEqual({ dx: 0, dy: 0 })
  })

  it('moves a card that would overlap another only as far as it needs, the shorter way', () => {
    // Side by side but overlapping across a fifth of their width: shorter to move sideways.
    const shifts = spreadCards([card('a', mx, my), card('b', mx + 90, my)])
    expect(shifts.get('a')).toEqual({ dx: 0, dy: 0 })
    expect(shifts.get('b')).toEqual({ dx: 20, dy: 0 })
  })

  it('moves a card up or down rather than sideways when venues are close, since cards are wider than tall', () => {
    const [a, b] = placed([card('a', mx, my), card('b', mx + 30, my + 10)])
    expect([a.x, a.y, b.x]).toEqual([mx, my, mx + 30])
    expect(anyOverlap([a, b])).toBe(false)
  })

  it('takes the spot with the shortest trail, beside its venue rather than above it where the move is shorter', () => {
    // A venue at the foot of the screen, so the card can't go below it, under another city's name.
    const a = card('a', mx, scene.height - 56)
    const name = { x: a.venueX, y: a.venueY - 36, width: 100, height: 50 }
    const [moved] = placed([a], [name])
    // Above the name the move would be about 60 px, beside it over 100, but the trail is shorter beside.
    expect(Math.abs(moved.x - mx)).toBeGreaterThan(100)
    expect(Math.abs(moved.y - (a.venueY - 36))).toBeLessThan(30)
    expect(trailLength(moved)).toBeLessThan(60)
  })

  it('keeps every venue in sight, moving a card off one it would cover', () => {
    // b's card sits right over a's venue.
    const packed = placed([card('a', mx, my), card('b', mx + 20, my + 60)])
    for (const c of packed) {
      for (const venue of packed) {
        const covers = Math.abs(c.x - venue.venueX) < c.width / 2 && Math.abs(c.y - venue.venueY) < c.height / 2
        expect(covers).toBe(false)
      }
    }
  })

  it('keeps trails clear of cards, moving a card a little further if its trail would cross another', () => {
    const packed = [card('a', mx, my), card('b', mx + 50, my + 20), card('c', mx + 100, my), card('d', mx + 40, my - 30), card('e', mx + 150, my + 30)]
    const before = unmoved(packed)
    const after = placed(packed)
    const trails = after.filter((c, i) => c.x !== before[i].x || c.y !== before[i].y)
    expect(trails.length).toBeGreaterThan(0)
    for (const moved of trails) {
      for (const other of after) {
        if (other === moved) continue
        expect(lineCrossesCard(moved.x, moved.y, moved.venueX, moved.venueY, other)).toBe(false)
      }
    }
  })

  it('takes the nearest spot, its trail crossing another card, when keeping clear would take it more than 40 px further', () => {
    // Two games at one venue at the foot of the screen: b can't go below, and every spot of b's whose
    // trail misses a's card (the side of it, low down, far out) is a long way off.
    const pair = [card('a', mx, scene.height - 56), card('b', mx, scene.height - 56)]
    const [a, b] = placed(pair)
    expect([a.x, a.y]).toEqual([mx, scene.height - 56])
    expect(trailLength(b)).toBeLessThan(65)
    expect(lineCrossesCard(b.x, b.y, b.venueX, b.venueY, a)).toBe(true)
  })

  it("draws a moved card's trail from the card's edge to its venue", () => {
    const packed = [card('a', mx, my), card('b', mx, my)]
    const layout = lay(packed)
    const after = placed(packed)
    const i = packed.findIndex((c) => layout.cards.get(c.gameId)!.trail !== null)
    const trail = layout.cards.get(packed[i].gameId)!.trail!
    const box = after[i]
    expect([trail.x2, trail.y2]).toEqual([box.venueX, box.venueY])
    const onEdge =
      Math.abs(Math.abs(trail.x1 - box.x) - box.width / 2) < 1e-9 ||
      Math.abs(Math.abs(trail.y1 - box.y) - box.height / 2) < 1e-9
    expect(onEdge).toBe(true)
  })

  it('moves a card as far as 400 px rather than into a card cluster', () => {
    // A long name over where both cards would sit, and well out to either side.
    const name = { x: mx, y: my - 60, width: 700, height: 300 }
    const pair = [card('a', mx, my), card('b', mx, my)]
    const layout = lay(pair, [name])
    expect(layout.cardClusters).toEqual([])
    const after = boxesOf(pair, layout)
    for (const c of after) expect(overlaps(c, name)).toBe(false)
    expect(Math.max(...after.map((c) => Math.hypot(c.x - c.venueX, c.y - (c.venueY - pointer - c.height / 2))))).toBeGreaterThan(160)
  })

  it('keeps moved cards wholly on screen', () => {
    // Games at a venue in the bottom left corner: room only up and to the right.
    const corner = games('g', 6, 40, scene.height - 50, 'Live')
    const layout = lay(corner)
    expect(layout.cardClusters).toEqual([])
    for (const [i, c] of boxesOf(corner, layout).entries()) {
      if (!layout.cards.get(corner[i].gameId)!.trail) continue
      expect(c.x - c.width / 2, c.gameId).toBeGreaterThanOrEqual(0)
      expect(c.y + c.height / 2, c.gameId).toBeLessThanOrEqual(scene.height)
    }
  })

  describe("with the names of games' cities", () => {
    const packed = [card('a', mx, my), card('b', mx + 50, my + 20), card('c', mx + 100, my), card('d', mx + 40, my - 30), card('e', mx + 150, my + 30)]
    const before = unmoved(packed)
    // Names below a, around c's venue, and where d's card would go if moved up.
    const names = [
      { x: mx, y: my + 70, width: 80, height: 24 },
      { x: mx + 100, y: my + 52, width: 70, height: 20 },
      { x: mx + 40, y: my - 110, width: 90, height: 24 },
    ]

    it('keeps cards off them', () => {
      expect(before.some((c) => names.some((name) => overlaps(c, name)))).toBe(true)
      for (const c of placed(packed, names)) {
        for (const name of names) expect(overlaps(c, name)).toBe(false)
      }
    })

    it('lets trails cross them, so a card goes past the name below its venue rather than further away', () => {
      // Two games at one venue, its city's name just below it.
      const pair = [card('a', mx, my), card('b', mx, my)]
      const below = { x: mx, y: my + 56, width: 80, height: 20 }
      const [, b] = placed(pair, [below])
      expect(b.y).toBeGreaterThan(below.y)
      expect(lineCrossesCard(b.x, b.y, b.venueX, b.venueY, below)).toBe(true)
    })

    it("still gives a card to a game whose venue is under a name, whose trail can't avoid it", () => {
      const under = [{ x: mx, y: my + 40, width: 80, height: 20 }]
      expect(shiftsOf(lay([card('a', mx, my), card('b', mx + 5, my)], under)).size).toBe(2)
    })

    it('moves a card aside rather than have its pointer reach through a name', () => {
      // Another city's name over the venue: clear of the card above it, not of the pointer down to it.
      const a = card('a', mx, my)
      const over = { x: mx, y: a.venueY + 6, width: 80, height: 16 }
      expect(overlaps(unmoved([a])[0], { ...over, width: over.width + 8, height: over.height + 8 })).toBe(false)
      const placement = lay([a], [over]).cards.get('a')!
      expect(placement.inCardCluster).toBe(false)
      expect(placement.trail).not.toBeNull()
    })
  })

  it('makes room for several overlapping cards', () => {
    const packed = [card('a', mx, my), card('b', mx + 50, my + 20), card('c', mx + 100, my), card('d', mx + 40, my - 30), card('e', mx + 150, my + 30)]
    expect(anyOverlap(unmoved(packed))).toBe(true)
    expect(anyOverlap(placed(packed))).toBe(false)
  })

  it('lands the same way whatever order the cards come in', () => {
    const packed = [card('a', mx, my), card('b', mx + 50, my + 20), card('c', mx + 100, my)]
    expect(lay([...packed].reverse())).toEqual(lay(packed))
  })

  it('gives every card room while there is room within reach', () => {
    const layout = lay([card('a', mx, my), card('b', mx + 5, my + 2), card('c', mx + 10, my - 3)])
    expect(shiftsOf(layout).size).toBe(3)
    expect(layout.cardClusters).toEqual([])
  })

  describe('on a small screen, with room for only a few cards', () => {
    const small: CardScene = { width: 400, height: 300, pointer }
    const layIn = (cards: ScreenCard[]) => layOutCards(cards, small)

    it("groups games with no room for a card into a count at the first one's venue, the rest nearby joining it", () => {
      // Twenty games at nearly one spot: far more cards than fit on screen.
      const many = games('g', 20, 200, 150, 'Live')
      const layout = layIn(many)
      const { cardClusters } = layout
      expect(cardClusters).toHaveLength(1)
      expect(shiftsOf(layout).size + cardClusters[0].gameIds.length).toBe(20)
      for (const gameId of cardClusters[0].gameIds) expect(layout.cards.get(gameId)).toEqual({ ...sitting, inCardCluster: true })
      const first = many.find((c) => c.gameId === cardClusters[0].gameIds[0])!
      expect([cardClusters[0].x, cardClusters[0].y]).toEqual([first.venueX, first.venueY])
    })

    it('gives Live games room first, so the games most worth following keep their cards', () => {
      const live = card('z', 210, 150, 'Live')
      expect(shiftsOf(layIn([...games('g', 20, 200, 150, 'Final'), live])).get('z')).toEqual({ dx: 0, dy: 0 })
    })

    it('shows a card cluster as its most prominent game, Disrupted only when all its games are', () => {
      const mixed = [...games('g', 20, 200, 150, 'Live'), card('f', 219, 150, 'Final')]
      expect(layIn(mixed).cardClusters.map((c) => c.status)).toEqual(['Live'])
      expect(layIn(games('d', 20, 200, 150, 'Disrupted')).cardClusters.map((c) => c.status)).toEqual(['Disrupted'])
    })
  })

  describe('laid out again, as the globe turns', () => {
    // Two games at one venue: b is moved aside, below the venue.
    const pair = [card('a', mx, my), card('b', mx, my)]
    const lastTime = (shifts: Record<string, ScreenOffset>) =>
      new Map(
        Object.entries(shifts).map(([gameId, { dx, dy }]) => [gameId, { offset: { dx, dy: dy - pointer }, inCardCluster: false, trail: null }]),
      )
    const trailOf = (shift: ScreenOffset) => {
      const b = { ...pair[1], x: pair[1].venueX + shift.dx, y: pair[1].venueY - pointer - 30 + shift.dy }
      return trailLength(b)
    }

    it('keeps a moved card where it was while that still has room, rather than jumping to a spot a little nearer', () => {
      const nearest = spreadCards(pair).get('b')!
      const lower = { dx: 0, dy: nearest.dy + 24 }
      expect(trailOf(lower) - trailOf(nearest)).toBeLessThan(40)
      const layout = layOutCards(pair, scene, lastTime({ a: { dx: 0, dy: 0 }, b: lower }))
      expect(shiftsOf(layout).get('b')).toEqual(lower)
    })

    it('keeps a moved card where it was while that still has room, however much nearer a spot opens up', () => {
      const nearest = spreadCards(pair).get('b')!
      const far = { dx: 0, dy: nearest.dy + 160 }
      expect(trailOf(far) - trailOf(nearest)).toBeGreaterThanOrEqual(160)
      const layout = layOutCards(pair, scene, lastTime({ a: { dx: 0, dy: 0 }, b: far }))
      expect(shiftsOf(layout).get('b')).toEqual(far)
    })

    it('keeps a card where it was rather than let a more prominent card looking for room take its spot', () => {
      // Two games at one venue; a city's name turns up over it, so the Live card there has to move.
      const live = card('live', mx, my)
      const upcoming = card('upcoming', mx, my, 'Upcoming')
      const over = [{ x: mx, y: my, width: 80, height: 20 }]
      // Where the Live card would go, had it the venue to itself, is where the Upcoming card was.
      const taken = shiftsOf(lay([live], over)).get('live')!
      const layout = layOutCards([live, upcoming], { ...scene, names: over }, lastTime({ live: { dx: 0, dy: 0 }, upcoming: taken }))
      expect(shiftsOf(layout).get('upcoming')).toEqual(taken)
      expect(shiftsOf(layout).get('live')).not.toEqual(taken)
      expect(anyOverlap(boxesOf([live, upcoming], layout))).toBe(false)
    })

    it('keeps a moved card where it was as the globe turns its neighbour a pixel closer', () => {
      // b moved down just clear of a's venue; as the globe turns, b's venue edges a pixel higher than a's.
      const b = { dx: 0, dy: 72 }
      expect(shiftsOf(lay([card('a', mx, my), card('b', mx + 1, my)])).get('b')).toEqual(b)
      const layout = layOutCards([card('a', mx, my), card('b', mx + 1, my - 1)], scene, lastTime({ a: { dx: 0, dy: 0 }, b }))
      expect(shiftsOf(layout).get('b')).toEqual(b)
    })

    it('keeps a card above its venue, whatever fraction of a pixel its venue is at', () => {
      // Venues as the globe had them, just off the top of the screen, which once put the card's own
      // venue a rounding error inside the card above it.
      const at = (venueX: number, venueY: number): ScreenCard => ({ gameId: 'a', status: 'Live', venueX, venueY, width: 94, height: 61 })
      const frames = [at(526.7053513415644, -53.395523840588766), at(523.7689444446646, -53.4684770992202)]
      for (const frame of frames) expect(lay([frame]).cards.get('a')).toEqual(sitting)
    })

    it('moves a card back over its venue once there is room there', () => {
      const layout = layOutCards([card('b', mx, my)], scene, lastTime({ b: { dx: 0, dy: 80 } }))
      expect(shiftsOf(layout).get('b')).toEqual({ dx: 0, dy: 0 })
    })

    it('moves a card from where it was once that has no room', () => {
      const below = { dx: 0, dy: 80 }
      const blocking = { x: mx, y: my + 80, width: 80, height: 24 }
      const layout = layOutCards(pair, { ...scene, names: [blocking] }, lastTime({ a: { dx: 0, dy: 0 }, b: below }))
      expect(shiftsOf(layout).get('b')).not.toEqual(below)
      expect(anyOverlap(placed(pair, [blocking]))).toBe(false)
    })

    it('pushes cards along as the globe turns the last of a row off screen, rather than send it across the crowd', () => {
      // Four games at one venue, in a strip of screen with no room above or below their cards: a sits
      // over the venue, the rest in a row to its right, out to the screen's edge.
      const strip: CardScene = { width: 1000, height: 140, pointer }
      const row = (x: number) => ['a', 'b', 'c', 'd'].map((gameId) => card(gameId, x, 64))
      const was = { a: { dx: 0, dy: 0 }, b: { dx: 120, dy: 0 }, c: { dx: 230, dy: 0 }, d: { dx: 340, dy: 0 } }
      const before = row(600)
      expect(boxesOf(before, layOutCards(before, strip, lastTime(was))).map(({ x, width }) => x + width / 2)).toEqual([653, 773, 883, 993])

      // The globe turns the row 15 px right: d would reach 8 px off screen, and every spot near it is taken.
      const now = row(615)
      const layout = layOutCards(now, strip, lastTime(was))
      const shifts = shiftsOf(layout)
      for (const [gameId, shift] of Object.entries(was)) {
        const moved = shifts.get(gameId)!
        expect(Math.hypot(moved.dx - shift.dx, moved.dy - shift.dy), gameId).toBeLessThanOrEqual(cardJump)
      }
      const after = boxesOf(now, layout)
      expect(anyOverlap(after)).toBe(false)
      for (const c of after) expect(c.x + c.width / 2, c.gameId).toBeLessThanOrEqual(strip.width)
    })

    it('keeps cards anchored as the globe pans across a crowd of venues', () => {
      // Forty venues packed in a spiral, panned across the screen 4 px a frame and spreading a little
      // as they go, as a globe's venues shift against each other while it turns.
      const statuses: GameStatus[] = ['Live', 'Upcoming', 'Final']
      const crowd = (frame: number): ScreenCard[] =>
        Array.from({ length: 40 }, (_, i) => {
          const r = 14 * Math.sqrt(i) * (1 + frame / 1000)
          const angle = i * 2.39996
          return {
            gameId: `g${String(i).padStart(2, '0')}`,
            status: statuses[i % 3],
            venueX: 900 - 4 * frame + r * Math.cos(angle),
            venueY: my + r * Math.sin(angle),
            width: 106,
            height: 60,
          }
        })
      // How often a card with its venue on screen leaps further than a jump from where it was.
      let jumps = 0
      let previous: CardLayout['cards'] = new Map()
      for (let frame = 0; frame < 100; frame++) {
        const cards = crowd(frame)
        const layout = layOutCards(cards, scene, previous)
        for (const { gameId, venueX, venueY } of cards) {
          const was = previous.get(gameId)
          const now = layout.cards.get(gameId)!
          if (!was || was.inCardCluster || now.inCardCluster) continue
          const onScreen = venueX >= 0 && venueX <= scene.width && venueY >= 0 && venueY <= scene.height
          if (onScreen && Math.hypot(now.offset.dx - was.offset.dx, now.offset.dy - was.offset.dy) > cardJump) jumps++
        }
        previous = layout.cards
      }
      // No jumpier than the layout is now. Before #88 (21) it made 130 here, and after it 5; a change
      // that makes fewer should lower this, so the next one can't make more unseen.
      expect(jumps).toBeLessThanOrEqual(5)
    })
  })

  it("leaves cards well off screen where they'd sit, however they overlap", () => {
    const { cards, cardClusters } = lay([card('a', -500, 100), card('b', -500, 100), card('c', 400, 1200)])
    for (const placement of cards.values()) expect(placement).toEqual(sitting)
    expect(cardClusters).toEqual([])
  })
})
