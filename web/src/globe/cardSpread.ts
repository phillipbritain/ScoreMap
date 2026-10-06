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
}

/** How far a card is moved from where it would sit, in screen pixels. */
export interface CardShift {
  dx: number
  dy: number
}

// Space left between cards that had to be moved apart.
const gap = 4
// Half the size of the spot around each venue that cards keep clear of: its trail's dot and a margin.
const venueRadius = 6
// Moves tried for a card that doesn't fit where it would sit: every step of this many pixels up to
// the furthest a card is moved, nearest first. A card with no room within reach stays where it would sit.
const step = 4
const furthest = 160
const moves: CardShift[] = []
for (let dx = -furthest; dx <= furthest; dx += step) {
  for (let dy = -furthest; dy <= furthest; dy += step) {
    if (Math.hypot(dx, dy) <= furthest) moves.push({ dx, dy })
  }
}
moves.sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy) || a.dy - b.dy || a.dx - b.dx)

/**
 * Moves score cards that would overlap so each has room, as little as it can. Cards are placed one
 * at a time, in game order so the same cards always land the same way: each stays where it would sit
 * if that's clear, or else takes the nearest spot that overlaps no card already placed and covers no
 * venue, so every venue (a moved card's trail's end) stays in sight.
 */
export function spreadCards(cards: readonly CardBox[]): Map<string, CardShift> {
  const boxes = [...cards].sort((a, b) => (a.gameId < b.gameId ? -1 : a.gameId > b.gameId ? 1 : 0))
  const placed: CardBox[] = []
  const shifts = new Map<string, CardShift>()

  const fits = (card: CardBox, { dx, dy }: CardShift) => {
    const x = card.x + dx
    const y = card.y + dy
    const clearOf = (otherX: number, otherY: number, halfWidth: number, halfHeight: number) =>
      Math.abs(x - otherX) >= card.width / 2 + halfWidth || Math.abs(y - otherY) >= card.height / 2 + halfHeight
    return (
      placed.every((other) => clearOf(other.x, other.y, other.width / 2 + gap, other.height / 2 + gap)) &&
      boxes.every((other) => clearOf(other.venueX, other.venueY, venueRadius, venueRadius))
    )
  }

  for (const card of boxes) {
    const shift = moves.find((move) => fits(card, move)) ?? { dx: 0, dy: 0 }
    shifts.set(card.gameId, shift)
    placed.push({ ...card, x: card.x + shift.dx, y: card.y + shift.dy })
  }
  return shifts
}
