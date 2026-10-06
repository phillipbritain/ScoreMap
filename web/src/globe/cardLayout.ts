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
 * placed and covers no venue, so every venue (a moved card's trail's end) stays in sight. Of those
 * spots it takes the nearest whose trail crosses no card and that sits on no trail, where there is
 * one. A card with no spot within reach joins a crowd instead.
 */
export function layOutCards(cards: readonly CardBox[]): CardLayout {
  const boxes = [...cards].sort((a, b) => a.rank - b.rank || (a.gameId < b.gameId ? -1 : a.gameId > b.gameId ? 1 : 0))
  const placed: CardBox[] = []
  // From each moved card's centre to its venue: the part outside the card is its trail.
  const trails: Segment[] = []
  const shifts = new Map<string, CardShift>()
  const crowds: CardCrowd[] = []

  for (const card of boxes) {
    // Only what's within reach of the card can get in its way.
    const near = (x: number, y: number, halfWidth: number, halfHeight: number) =>
      Math.abs(x - card.x) < furthest + card.width / 2 + halfWidth &&
      Math.abs(y - card.y) < furthest + card.height / 2 + halfHeight
    const cardsNear = placed.filter((other) => near(other.x, other.y, other.width / 2 + gap, other.height / 2 + gap))
    const venuesNear = boxes.filter((other) => near(other.venueX, other.venueY, venueRadius, venueRadius))
    const trailsNear = trails.filter(
      (trail) =>
        near((trail.x1 + trail.x2) / 2, (trail.y1 + trail.y2) / 2, Math.abs(trail.x1 - trail.x2) / 2, Math.abs(trail.y1 - trail.y2) / 2),
    )

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

    // Whether a card moved this way would keep clear of trails: its own crossing no card, and no trail
    // already drawn crossing it.
    const trailsClear = ({ dx, dy }: CardShift) => {
      const x = card.x + dx
      const y = card.y + dy
      const halfWidth = card.width / 2 + gap
      const halfHeight = card.height / 2 + gap
      if (trailsNear.some((trail) => crosses(trail, x, y, halfWidth, halfHeight))) return false
      if (dx === 0 && dy === 0) return true
      const own = { x1: x, y1: y, x2: card.venueX, y2: card.venueY }
      return cardsNear.every((other) => !crosses(own, other.x, other.y, other.width / 2 + gap, other.height / 2 + gap))
    }

    // The nearest spot clear of trails too, or failing that the nearest spot at all.
    let shift: CardShift | undefined
    for (const move of moves) {
      if (!fits(move)) continue
      if (trailsClear(move)) {
        shift = move
        break
      }
      shift ??= move
    }
    if (shift) {
      shifts.set(card.gameId, shift)
      const x = card.x + shift.dx
      const y = card.y + shift.dy
      placed.push({ ...card, x, y })
      if (shift.dx !== 0 || shift.dy !== 0) trails.push({ x1: x, y1: y, x2: card.venueX, y2: card.venueY })
      continue
    }
    const crowd = crowds.find((c) => Math.hypot(c.x - card.venueX, c.y - card.venueY) <= crowdRadius)
    if (crowd) crowd.gameIds.push(card.gameId)
    else crowds.push({ gameIds: [card.gameId], x: card.venueX, y: card.venueY })
  }
  return { shifts, crowds }
}

interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Whether a line passes through a box, given by its centre and half its size. */
function crosses({ x1, y1, x2, y2 }: Segment, x: number, y: number, halfWidth: number, halfHeight: number): boolean {
  // Narrow down the part of the line within the box one axis at a time.
  let from = 0
  let to = 1
  for (const [start, delta, low, high] of [
    [x1, x2 - x1, x - halfWidth, x + halfWidth],
    [y1, y2 - y1, y - halfHeight, y + halfHeight],
  ]) {
    if (delta === 0) {
      if (start <= low || start >= high) return false
      continue
    }
    const a = (low - start) / delta
    const b = (high - start) / delta
    from = Math.max(from, Math.min(a, b))
    to = Math.min(to, Math.max(a, b))
    if (from >= to) return false
  }
  return true
}
