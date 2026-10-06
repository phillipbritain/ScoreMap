/** One score card where it would sit undisturbed, in screen pixels. */
export interface CardBox {
  gameId: string
  /** The card's centre, above its venue. */
  x: number
  y: number
  width: number
  height: number
  /** The venue the card points at, which no card may cover. */
  venueX: number
  venueY: number
  /** Which cards get room first where there isn't room for all: lowest first, then in game order. */
  rank: number
}

/** How far a card is moved from where it would sit, in screen pixels. */
export interface CardShift {
  dx: number
  dy: number
}

/** Games with no room for a card, shown as one count at the first one's venue. */
export interface CardCrowd {
  gameIds: string[]
  x: number
  y: number
}

export interface CardLayout {
  /** How far each card that has room is moved. */
  shifts: Map<string, CardShift>
  /** The rest, grouped with others nearby. */
  crowds: CardCrowd[]
}

// Space left between cards that had to be moved apart.
const gap = 4
// Half the size of the spot around each venue that cards keep clear of: its trail's dot and a margin.
const venueRadius = 6
// Moves tried for a card that doesn't fit where it would sit: every step of this many pixels up to
// the furthest a card is moved, nearest first.
const step = 4
const furthest = 160
const moves: CardShift[] = []
for (let dx = -furthest; dx <= furthest; dx += step) {
  for (let dy = -furthest; dy <= furthest; dy += step) {
    if (Math.hypot(dx, dy) <= furthest) moves.push({ dx, dy })
  }
}
moves.sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy) || a.dy - b.dy || a.dx - b.dx)
// Games with no room join a count within this distance of their venue, rather than starting their own.
const crowdRadius = 40

/**
 * Finds room for score cards that would overlap, moving each as little as it can. Cards are placed
 * one at a time, by rank and then game order so the same cards always land the same way: each stays
 * where it would sit if that's clear, or else takes the nearest spot that overlaps no card already
 * placed and covers no venue, so every venue (a moved card's trail's end) stays in sight. A card with
 * no such spot within reach joins a crowd instead.
 */
export function layOutCards(cards: readonly CardBox[]): CardLayout {
  const boxes = [...cards].sort((a, b) => a.rank - b.rank || (a.gameId < b.gameId ? -1 : a.gameId > b.gameId ? 1 : 0))
  const placed: CardBox[] = []
  const shifts = new Map<string, CardShift>()
  const crowds: CardCrowd[] = []

  for (const card of boxes) {
    // Only what's within reach of the card can get in its way.
    const near = (x: number, y: number, halfWidth: number, halfHeight: number) =>
      Math.abs(x - card.x) < furthest + card.width / 2 + halfWidth &&
      Math.abs(y - card.y) < furthest + card.height / 2 + halfHeight
    const cardsNear = placed.filter((other) => near(other.x, other.y, other.width / 2 + gap, other.height / 2 + gap))
    const venuesNear = boxes.filter((other) => near(other.venueX, other.venueY, venueRadius, venueRadius))

    const fits = ({ dx, dy }: CardShift) => {
      const x = card.x + dx
      const y = card.y + dy
      const clearOf = (otherX: number, otherY: number, halfWidth: number, halfHeight: number) =>
        Math.abs(x - otherX) >= card.width / 2 + halfWidth || Math.abs(y - otherY) >= card.height / 2 + halfHeight
      return (
        cardsNear.every((other) => clearOf(other.x, other.y, other.width / 2 + gap, other.height / 2 + gap)) &&
        venuesNear.every((other) => clearOf(other.venueX, other.venueY, venueRadius, venueRadius))
      )
    }

    const shift = moves.find(fits)
    if (shift) {
      shifts.set(card.gameId, shift)
      placed.push({ ...card, x: card.x + shift.dx, y: card.y + shift.dy })
      continue
    }
    const crowd = crowds.find((c) => Math.hypot(c.x - card.venueX, c.y - card.venueY) <= crowdRadius)
    if (crowd) crowd.gameIds.push(card.gameId)
    else crowds.push({ gameIds: [card.gameId], x: card.venueX, y: card.venueY })
  }
  return { shifts, crowds }
}
