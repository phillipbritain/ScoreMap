import { describe, expect, it } from 'vitest'
import type { GameStatus } from '../games/game'
import { layOutCards, type CardLayout, type CardScene, type ScreenCard, type ScreenOffset } from './cardLayout'
import type { ScreenBox } from './gameCities'

const pointer = 6
const scene: CardScene = { width: 1000, height: 800, pointer }

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
  for (const [gameId, { offset, crowded }] of cards) {
    if (!crowded) shifts.set(gameId, { dx: offset.dx, dy: offset.dy + pointer })
  }
  return shifts
}

const spreadCards = (cards: ScreenCard[]) => shiftsOf(lay(cards))

function placed(cards: ScreenCard[], names: ScreenBox[] = []): Box[] {
  const layout = lay(cards, names)
  return cards.map((c) => {
    const { offset } = layout.cards.get(c.gameId)!
    return { ...c, x: c.venueX + offset.dx, y: c.venueY + offset.dy - c.height / 2 }
  })
}

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

const sitting = { offset: { dx: 0, dy: -pointer }, crowded: false, trail: null }

describe('layOutCards', () => {
  it('sits a card with room just above its venue, its pointer on the spot, with no trail', () => {
    expect(lay([card('a', 100, 100)]).cards.get('a')).toEqual(sitting)
  })

  it('gives games at the same venue a card each, side by side, clear of the venue', () => {
    const cards = placed([card('a', 0, 0), card('b', 0, 0), card('c', 0, 0)])
    expect(anyOverlap(cards)).toBe(false)
    for (const c of cards) {
      const coversVenue = Math.abs(c.x - c.venueX) < c.width / 2 && Math.abs(c.y - c.venueY) < c.height / 2
      expect(coversVenue, c.gameId).toBe(false)
    }
  })

  it('leaves cards that already have room where they are', () => {
    const shifts = spreadCards([card('a', 0, 0), card('b', 200, 0), card('c', 0, 100)])
    for (const shift of shifts.values()) expect(shift).toEqual({ dx: 0, dy: 0 })
  })

  it('moves a card that would overlap another only as far as it needs, the shorter way', () => {
    // Side by side but overlapping across a fifth of their width: shorter to move sideways.
    const shifts = spreadCards([card('a', 0, 0), card('b', 90, 0)])
    expect(shifts.get('a')).toEqual({ dx: 0, dy: 0 })
    expect(shifts.get('b')).toEqual({ dx: 20, dy: 0 })
  })

  it('moves a card up or down rather than sideways when venues are close, since cards are wider than tall', () => {
    const [a, b] = placed([card('a', 0, 0), card('b', 30, 10)])
    expect([a.x, a.y, b.x]).toEqual([0, 0, 30])
    expect(anyOverlap([a, b])).toBe(false)
  })

  it('keeps every venue in sight, moving a card off one it would cover', () => {
    // b's card sits right over a's venue.
    const crowd = placed([card('a', 0, 0), card('b', 20, 60)])
    for (const c of crowd) {
      for (const venue of crowd) {
        const covers = Math.abs(c.x - venue.venueX) < c.width / 2 && Math.abs(c.y - venue.venueY) < c.height / 2
        expect(covers).toBe(false)
      }
    }
  })

  it('keeps trails clear of cards, moving a card further if its trail would cross another', () => {
    const crowd = [card('a', 0, 0), card('b', 50, 20), card('c', 100, 0), card('d', 40, -30), card('e', 150, 30)]
    const before = unmoved(crowd)
    const after = placed(crowd)
    const trails = after.filter((c, i) => c.x !== before[i].x || c.y !== before[i].y)
    expect(trails.length).toBeGreaterThan(0)
    for (const moved of trails) {
      for (const other of after) {
        if (other === moved) continue
        expect(lineCrossesCard(moved.x, moved.y, moved.venueX, moved.venueY, other)).toBe(false)
      }
    }
  })

  it("draws a moved card's trail from the card's edge to its venue", () => {
    const crowd = [card('a', 0, 0), card('b', 0, 0)]
    const layout = lay(crowd)
    const after = placed(crowd)
    const i = crowd.findIndex((c) => layout.cards.get(c.gameId)!.trail !== null)
    const trail = layout.cards.get(crowd[i].gameId)!.trail!
    const box = after[i]
    expect([trail.x2, trail.y2]).toEqual([box.venueX, box.venueY])
    const onEdge =
      Math.abs(Math.abs(trail.x1 - box.x) - box.width / 2) < 1e-9 ||
      Math.abs(Math.abs(trail.y1 - box.y) - box.height / 2) < 1e-9
    expect(onEdge).toBe(true)
  })

  describe("with the names of games' cities", () => {
    const crowd = [card('a', 0, 0), card('b', 50, 20), card('c', 100, 0), card('d', 40, -30), card('e', 150, 30)]
    const before = unmoved(crowd)
    // Names below a, around c's venue, and where d's card would go if moved up.
    const names = [
      { x: 0, y: 70, width: 80, height: 24 },
      { x: 100, y: 52, width: 70, height: 20 },
      { x: 40, y: -110, width: 90, height: 24 },
    ]
    const coversVenue = (name: ScreenBox, c: Box) =>
      Math.abs(c.venueX - name.x) < name.width / 2 && Math.abs(c.venueY - name.y) < name.height / 2

    function trailsAcrossNames(after: Box[]): number {
      let count = 0
      for (const [i, c] of after.entries()) {
        if (c.x === before[i].x && c.y === before[i].y) continue
        for (const name of names) {
          if (!coversVenue(name, c) && lineCrossesCard(c.x, c.y, c.venueX, c.venueY, name)) count++
        }
      }
      return count
    }

    it('keeps cards off them', () => {
      expect(before.some((c) => names.some((name) => overlaps(c, name)))).toBe(true)
      for (const c of placed(crowd, names)) {
        for (const name of names) expect(overlaps(c, name)).toBe(false)
      }
    })

    it("keeps trails off them, unless a name covers the trail's own venue", () => {
      // Laid out without the names, trails would cross them.
      expect(trailsAcrossNames(placed(crowd))).toBeGreaterThan(0)
      expect(trailsAcrossNames(placed(crowd, names))).toBe(0)
    })

    it("still gives a card to a game whose venue is under a name, whose trail can't avoid it", () => {
      const under = [{ x: 0, y: 40, width: 80, height: 20 }]
      expect(shiftsOf(lay([card('a', 0, 0), card('b', 5, 0)], under)).size).toBe(2)
    })
  })

  it('makes room for several crowded cards', () => {
    const crowd = [card('a', 0, 0), card('b', 50, 20), card('c', 100, 0), card('d', 40, -30), card('e', 150, 30)]
    expect(anyOverlap(unmoved(crowd))).toBe(true)
    expect(anyOverlap(placed(crowd))).toBe(false)
  })

  it('lands the same way whatever order the cards come in', () => {
    const crowd = [card('a', 0, 0), card('b', 50, 20), card('c', 100, 0)]
    expect(lay([...crowd].reverse())).toEqual(lay(crowd))
  })

  it('gives every card room while there is room within reach', () => {
    const layout = lay([card('a', 0, 0), card('b', 5, 2), card('c', 10, -3)])
    expect(shiftsOf(layout).size).toBe(3)
    expect(layout.crowds).toEqual([])
  })

  it("groups games with no room for a card into a count at the first one's venue, the rest nearby joining it", () => {
    // Twenty games at nearly one spot: far more cards than fit within reach.
    const many = games('g', 20, 0, 0, 'Live')
    const layout = lay(many)
    const { crowds } = layout
    expect(crowds).toHaveLength(1)
    expect(shiftsOf(layout).size + crowds[0].gameIds.length).toBe(20)
    for (const gameId of crowds[0].gameIds) expect(layout.cards.get(gameId)).toEqual({ ...sitting, crowded: true })
    const first = many.find((c) => c.gameId === crowds[0].gameIds[0])!
    expect([crowds[0].x, crowds[0].y]).toEqual([first.venueX, first.venueY])
  })

  it('gives Live games room first, so the games most worth following keep their cards', () => {
    const live = card('z', 10, 0, 'Live')
    expect(spreadCards([...games('g', 20, 0, 0, 'Final'), live]).get('z')).toEqual({ dx: 0, dy: 0 })
  })

  it('shows a crowd as its most prominent game, Disrupted only when all its games are', () => {
    const mixed = [...games('g', 20, 0, 0, 'Live'), card('f', 19, 0, 'Final')]
    const disrupted = games('d', 20, 500, 300, 'Disrupted')
    const { crowds } = lay([...mixed, ...disrupted])
    expect(crowds.map((c) => c.status).sort()).toEqual(['Disrupted', 'Live'])
  })

  it("leaves cards well off screen where they'd sit, however they overlap", () => {
    const { cards, crowds } = lay([card('a', -500, 100), card('b', -500, 100), card('c', 400, 1200)])
    for (const placement of cards.values()) expect(placement).toEqual(sitting)
    expect(crowds).toEqual([])
  })
})
