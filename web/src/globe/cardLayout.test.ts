import { describe, expect, it } from 'vitest'
import { layOutCards, type CardBox } from './cardLayout'

// Its venue just below it, as score cards sit.
const card = (gameId: string, x: number, y: number, rank = 0): CardBox => ({
  gameId,
  rank,
  x,
  y,
  width: 106,
  height: 60,
  venueX: x,
  venueY: y + 36,
})

const spreadCards = (cards: CardBox[]) => layOutCards(cards).shifts

function placed(cards: CardBox[]) {
  const shifts = spreadCards(cards)
  return cards.map((c) => ({ ...c, x: c.x + shifts.get(c.gameId)!.dx, y: c.y + shifts.get(c.gameId)!.dy }))
}

function overlaps(a: CardBox, b: CardBox): boolean {
  return Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2
}

function anyOverlap(cards: CardBox[]): boolean {
  return cards.some((a, i) => cards.slice(i + 1).some((b) => overlaps(a, b)))
}

describe('layOutCards', () => {
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

  it('makes room for several crowded cards', () => {
    const crowd = [card('a', 0, 0), card('b', 50, 20), card('c', 100, 0), card('d', 40, -30), card('e', 150, 30)]
    expect(anyOverlap(crowd)).toBe(true)
    expect(anyOverlap(placed(crowd))).toBe(false)
  })

  it('lands the same way whatever order the cards come in', () => {
    const crowd = [card('a', 0, 0), card('b', 50, 20), card('c', 100, 0)]
    expect(layOutCards([...crowd].reverse())).toEqual(layOutCards(crowd))
  })

  it('gives every card room while there is room within reach', () => {
    const { shifts, crowds } = layOutCards([card('a', 0, 0), card('b', 5, 2), card('c', 10, -3)])
    expect(shifts.size).toBe(3)
    expect(crowds).toEqual([])
  })

  it("groups games with no room for a card into a count at the first one's venue, the rest nearby joining it", () => {
    // Twenty games at nearly one spot: far more cards than fit within reach.
    const many = Array.from({ length: 20 }, (_, i) => card(`g${String(i).padStart(2, '0')}`, i, 0))
    const { shifts, crowds } = layOutCards(many)
    expect(crowds).toHaveLength(1)
    expect(shifts.size + crowds[0].gameIds.length).toBe(20)
    const first = many.find((c) => c.gameId === crowds[0].gameIds[0])!
    expect([crowds[0].x, crowds[0].y]).toEqual([first.venueX, first.venueY])
  })

  it('gives cards room by rank first, so the most important games keep their cards', () => {
    const many = Array.from({ length: 20 }, (_, i) => card(`g${String(i).padStart(2, '0')}`, i, 0, 1))
    const important = card('z', 10, 0, 0)
    const { shifts } = layOutCards([...many, important])
    expect(shifts.get('z')).toEqual({ dx: 0, dy: 0 })
  })
})
