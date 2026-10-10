import type { GameStatus } from '../games/game'
import type { ScreenBox } from './gameCities'
import { groupStatus, statusProminence } from './statusLook'

/** One game's score card, as the map shows it: its venue on screen and the card's measured size. */
export interface ScreenCard {
  gameId: string
  status: GameStatus
  /** The venue the card points at, in screen pixels. */
  venueX: number
  venueY: number
  width: number
  height: number
}

/** What the cards are laid out around. */
export interface CardScene {
  /** The map's size on screen. Cards whose venues are well off it aren't laid out. */
  width: number
  height: number
  /** How far a card's pointer reaches below the card, down to its venue. */
  pointer: number
  /** Where the names of games' cities are written, which cards and trails keep clear of. */
  names?: readonly ScreenBox[]
}

/** A distance on screen, in pixels. */
export interface ScreenOffset {
  dx: number
  dy: number
}

/** A line on screen, in pixels. */
export interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Where one card goes. */
export interface CardPlacement {
  /** Where the card's bottom centre sits, from its venue: just above it, or moved aside. */
  offset: ScreenOffset
  /** True when there's no room for the card and its game is counted in a crowd instead. */
  crowded: boolean
  /** From the edge of a moved card to its venue; null for a card that isn't moved. */
  trail: Segment | null
}

/** Games with no room for a card, shown as one count at the first one's venue. */
export interface CardCrowd {
  gameIds: string[]
  /** The status the count shows as (see groupStatus). */
  status: GameStatus
  x: number
  y: number
}

export interface CardLayout {
  /** Where every card goes, by game. */
  cards: Map<string, CardPlacement>
  crowds: CardCrowd[]
}

/**
 * Lays out the score cards on screen. Each sits above its venue, its pointer's tip on the spot, unless
 * that overlaps another card, a venue or a city's name: then it's moved the least it can be, with a
 * trail back to its venue (see arrange). Cards get room by status, most prominent first, whichever is
 * selected, so selecting a card never moves it; a card with no room within reach joins a crowd.
 * Cards whose venues are well off screen stay where they'd sit: nothing on screen can get in their
 * way. Given where the cards were last time (`previous`), a moved card stays where it was while that
 * still has room, so cards don't jump about as the globe turns.
 */
export function layOutCards(
  cards: readonly ScreenCard[],
  scene: CardScene,
  previous: ReadonlyMap<string, CardPlacement> = new Map(),
): CardLayout {
  const unmoved: CardPlacement = { offset: { dx: 0, dy: -scene.pointer }, crowded: false, trail: null }
  const statuses = new Map(cards.map((card) => [card.gameId, card.status]))
  const rank = ({ status }: ScreenCard) => statusProminence.indexOf(status)
  const boxes = cards
    .filter((card) => nearScreen(card.venueX, card.venueY, scene))
    .map(
      (card): CardBox => ({
        gameId: card.gameId,
        x: card.venueX,
        y: card.venueY - scene.pointer - card.height / 2,
        width: card.width,
        height: card.height,
        venueX: card.venueX,
        venueY: card.venueY,
        rank: rank(card),
        previous: shiftOf(previous.get(card.gameId), scene.pointer),
      }),
    )
  const names = (scene.names ?? []).filter((name) => nearScreen(name.x, name.y, scene))
  const { shifts, crowds } = arrange(boxes, names)

  const placements = new Map(cards.map((card) => [card.gameId, unmoved]))
  for (const box of boxes) {
    const shift = shifts.get(box.gameId)
    if (!shift) {
      placements.set(box.gameId, { ...unmoved, crowded: true })
      continue
    }
    const moved = shift.dx !== 0 || shift.dy !== 0
    placements.set(box.gameId, {
      offset: { dx: shift.dx, dy: shift.dy - scene.pointer },
      crowded: false,
      trail: moved ? trail(box, shift) : null,
    })
  }
  return {
    cards: placements,
    crowds: crowds.map((crowd) => ({ ...crowd, status: groupStatus(crowd.gameIds.map((id) => statuses.get(id)!)) })),
  }
}

// Cards whose venues are this far off screen aren't laid out: nothing on screen can get in their way.
const offScreenMargin = 200

/** Whether a point is on screen, or near enough that what's drawn there could reach it. */
function nearScreen(x: number, y: number, { width, height }: CardScene): boolean {
  return x > -offScreenMargin && x < width + offScreenMargin && y > -offScreenMargin && y < height + offScreenMargin
}

/** How far a card was moved from where it would sit, if it had room. */
function shiftOf(placement: CardPlacement | undefined, pointer: number): ScreenOffset | undefined {
  if (!placement || placement.crowded) return undefined
  return { dx: placement.offset.dx, dy: placement.offset.dy + pointer }
}

/** A moved card's trail: from where a line from the card's centre to its venue leaves the card. */
function trail(box: CardBox, { dx, dy }: ScreenOffset): Segment {
  const centreX = box.x + dx
  const centreY = box.y + dy
  const toVenueX = box.venueX - centreX
  const toVenueY = box.venueY - centreY
  const edge = Math.min(1, box.width / 2 / Math.abs(toVenueX), box.height / 2 / Math.abs(toVenueY))
  return { x1: centreX + toVenueX * edge, y1: centreY + toVenueY * edge, x2: box.venueX, y2: box.venueY }
}

/** One score card where it would sit undisturbed, in screen pixels. */
interface CardBox {
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
  /** How far the card was moved last time it was laid out, if it had room. */
  previous?: ScreenOffset
}

interface Arrangement {
  /** How far each card that has room is moved from where it would sit. */
  shifts: Map<string, ScreenOffset>
  /** The rest, grouped with others nearby. */
  crowds: Omit<CardCrowd, 'status'>[]
}

// Space left between cards that had to be moved apart.
const gap = 4
// Half the size of the spot around each venue that cards keep clear of: its trail's dot and a margin.
const venueRadius = 6
// Moves tried for a card that doesn't fit where it would sit: every step of this many pixels up to
// the furthest a card is moved, nearest first.
const step = 4
const furthest = 160
const moves: ScreenOffset[] = []
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
 * placed and covers no venue, so every venue (a moved card's trail's end) stays in sight. No card
 * covers a name in `names`, and no trail crosses one unless it covers the trail's own venue. Of those
 * spots it takes the nearest whose trail crosses no card and that sits on no trail, where there is
 * one. A card with no spot within reach joins a crowd instead. A card that was moved last time tries
 * where it was straight after where it would sit, and keeps it while it fits, so it moves only when
 * that spot has no room.
 */
function arrange(cards: readonly CardBox[], names: readonly ScreenBox[]): Arrangement {
  const boxes = [...cards].sort((a, b) => a.rank - b.rank || (a.gameId < b.gameId ? -1 : a.gameId > b.gameId ? 1 : 0))
  const placed: CardBox[] = []
  // From each moved card's centre to its venue: the part outside the card is its trail.
  const trails: Segment[] = []
  const shifts = new Map<string, ScreenOffset>()
  const crowds: Omit<CardCrowd, 'status'>[] = []

  for (const card of boxes) {
    // Only what's within reach of the card can get in its way.
    const near = (x: number, y: number, halfWidth: number, halfHeight: number) =>
      Math.abs(x - card.x) < furthest + card.width / 2 + halfWidth &&
      Math.abs(y - card.y) < furthest + card.height / 2 + halfHeight
    const cardsNear = placed.filter((other) => near(other.x, other.y, other.width / 2 + gap, other.height / 2 + gap))
    const venuesNear = boxes.filter((other) => near(other.venueX, other.venueY, venueRadius, venueRadius))
    const namesNear = names.filter((name) => near(name.x, name.y, name.width / 2, name.height / 2))
    // A name over the card's own venue can't be kept clear of its trail.
    const namesAcrossTrail = namesNear.filter(
      (name) => Math.abs(card.venueX - name.x) >= name.width / 2 || Math.abs(card.venueY - name.y) >= name.height / 2,
    )
    const trailsNear = trails.filter(
      (trail) =>
        near((trail.x1 + trail.x2) / 2, (trail.y1 + trail.y2) / 2, Math.abs(trail.x1 - trail.x2) / 2, Math.abs(trail.y1 - trail.y2) / 2),
    )

    const fits = ({ dx, dy }: ScreenOffset) => {
      const x = card.x + dx
      const y = card.y + dy
      const clearOf = (otherX: number, otherY: number, halfWidth: number, halfHeight: number) =>
        Math.abs(x - otherX) >= card.width / 2 + halfWidth || Math.abs(y - otherY) >= card.height / 2 + halfHeight
      return (
        cardsNear.every((other) => clearOf(other.x, other.y, other.width / 2 + gap, other.height / 2 + gap)) &&
        venuesNear.every((other) => clearOf(other.venueX, other.venueY, venueRadius, venueRadius)) &&
        namesNear.every((name) => clearOf(name.x, name.y, name.width / 2 + gap, name.height / 2 + gap)) &&
        ((dx === 0 && dy === 0) ||
          namesAcrossTrail.every(
            (name) => !crosses({ x1: x, y1: y, x2: card.venueX, y2: card.venueY }, name.x, name.y, name.width / 2, name.height / 2),
          ))
      )
    }

    // Whether a card moved this way would keep clear of trails: its own crossing no card, and no trail
    // already drawn crossing it.
    const trailsClear = ({ dx, dy }: ScreenOffset) => {
      const x = card.x + dx
      const y = card.y + dy
      const halfWidth = card.width / 2 + gap
      const halfHeight = card.height / 2 + gap
      if (trailsNear.some((trail) => crosses(trail, x, y, halfWidth, halfHeight))) return false
      if (dx === 0 && dy === 0) return true
      const own = { x1: x, y1: y, x2: card.venueX, y2: card.venueY }
      return cardsNear.every((other) => !crosses(own, other.x, other.y, other.width / 2 + gap, other.height / 2 + gap))
    }

    // The nearest spot clear of trails too, or failing that the nearest spot at all. Where the card was
    // last time will do while it fits, trails or not, so a trail edging across a card doesn't send it
    // elsewhere.
    let shift: ScreenOffset | undefined
    const tries = card.previous ? [moves[0], card.previous, ...moves.slice(1)] : moves
    for (const move of tries) {
      if (!fits(move)) continue
      if (move === card.previous || trailsClear(move)) {
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
