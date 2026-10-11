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
  /** Where the names of games' cities are written, which cards and their pointers keep clear of. */
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
  /** True when there's no room for the card and its game is counted in a card cluster instead. */
  inCardCluster: boolean
  /** From the edge of a moved card to its venue; null for a card that isn't moved. */
  trail: Segment | null
}

/** Games with no room for a card, shown as one count at the first one's venue. */
export interface CardCluster {
  gameIds: string[]
  /** The status the count shows as (see groupStatus). */
  status: GameStatus
  x: number
  y: number
}

export interface CardLayout {
  /** Where every card goes, by game. */
  cards: Map<string, CardPlacement>
  cardClusters: CardCluster[]
}

/**
 * Lays out the score cards on screen. Each sits above its venue, its pointer's tip on the spot, unless
 * that overlaps another card, a venue or a city's name: then it's moved aside, wholly on screen and
 * as near its venue as it can be, with a trail back to it (see arrange). Cards get room by status,
 * most prominent first, whichever is selected, so selecting a card never moves it; a card with no
 * room within reach joins a card cluster. Cards whose venues are well off screen stay where they'd
 * sit: nothing on screen can get in their way. Given where the cards were last time (`previous`), a
 * moved card stays where it was while that still has room and no spot much nearer has opened up, so
 * cards don't jump about as the globe turns.
 */
export function layOutCards(
  cards: readonly ScreenCard[],
  scene: CardScene,
  previous: ReadonlyMap<string, CardPlacement> = new Map(),
): CardLayout {
  const unmoved: CardPlacement = { offset: { dx: 0, dy: -scene.pointer }, inCardCluster: false, trail: null }
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
  const { shifts, cardClusters } = arrange(boxes, names, scene)

  const placements = new Map(cards.map((card) => [card.gameId, unmoved]))
  for (const box of boxes) {
    const shift = shifts.get(box.gameId)
    if (!shift) {
      placements.set(box.gameId, { ...unmoved, inCardCluster: true })
      continue
    }
    const moved = shift.dx !== 0 || shift.dy !== 0
    placements.set(box.gameId, {
      offset: { dx: shift.dx, dy: shift.dy - scene.pointer },
      inCardCluster: false,
      trail: moved ? trail(box, shift) : null,
    })
  }
  return {
    cards: placements,
    cardClusters: cardClusters.map((cluster) => ({ ...cluster, status: groupStatus(cluster.gameIds.map((id) => statuses.get(id)!)) })),
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
  if (!placement || placement.inCardCluster) return undefined
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
  cardClusters: Omit<CardCluster, 'status'>[]
}

// Space left between cards that had to be moved apart.
const gap = 4
// Half the size of the spot around each venue that cards keep clear of: its trail's dot and a margin.
const venueRadius = 6
// The furthest a card is moved from where it would sit, in pixels; a card with no room within reach
// joins a card cluster.
const reach = 400
// How much longer a trail may be, in pixels, to keep it clear of cards and other trails.
const clearTrailAllowance = 40
// How much shorter a moved card's trail must get, in pixels, for it to leave a spot that still fits.
const shorterTrailToMove = 40
// Moves tried for a card that doesn't fit where it would sit: every 4 pixels out to 160, then every 8
// out to the reach, which is close enough that far out and keeps laying out quick.
const moves: ScreenOffset[] = []
for (const [step, from, to] of [
  [4, 0, 160],
  [8, 160, reach],
]) {
  for (let dx = -to; dx <= to; dx += step) {
    for (let dy = -to; dy <= to; dy += step) {
      const distance = Math.hypot(dx, dy)
      if (distance > from && distance <= to) moves.push({ dx, dy })
    }
  }
}
// Games with no room join a count within this distance of their venue, rather than starting their own.
const cardClusterRadius = 40

/** A move, and how long the trail of a card moved that way is. */
interface Spot extends ScreenOffset {
  trail: number
}

/**
 * The moves for a card, nearest first: by trail length, from the venue to the card's nearest edge,
 * the same in every direction; then the shorter move. They're the same for every card of a size, so
 * they're kept for the next card and the next layout.
 */
function spotsFor({ width, height, x, y, venueX, venueY }: CardBox): Spot[] {
  const key = `${width} ${height} ${venueX - x} ${venueY - y}`
  let spots = spotsBySize.get(key)
  if (spots) return spots
  spots = moves
    .map(({ dx, dy }) => ({ dx, dy, trail: trailLength({ width, height, x: x + dx, y: y + dy, venueX, venueY }) }))
    .sort((a, b) => a.trail - b.trail || Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy) || a.dy - b.dy || a.dx - b.dx)
  // Cards come in a few sizes; in case they come in many, only the latest are kept.
  if (spotsBySize.size >= 50) spotsBySize.clear()
  spotsBySize.set(key, spots)
  return spots
}
const spotsBySize = new Map<string, Spot[]>()
// Where a card would sit, which it keeps when that has room.
const unmovedSpot: Spot = { dx: 0, dy: 0, trail: 0 }

/** How long a card's trail is: from its venue to the card's nearest edge. */
function trailLength({ width, height, x, y, venueX, venueY }: Omit<CardBox, 'gameId' | 'rank'>): number {
  return Math.hypot(Math.max(0, Math.abs(venueX - x) - width / 2), Math.max(0, Math.abs(venueY - y) - height / 2))
}

/**
 * Finds room for score cards that would overlap. Cards are placed one at a time, by rank and then
 * game order so the same cards always land the same way: each stays where it would sit if that's
 * clear, or else is moved to the spot with the shortest trail that keeps on screen, overlaps no card
 * already placed and covers no venue, so every venue (a moved card's trail's end) stays in sight. No
 * card covers a name in `names`, nor reaches its pointer through one; trails may cross them. A spot
 * whose trail crosses no card and that sits on no trail is taken over a nearer one while its trail
 * is at most clearTrailAllowance longer. A card with no spot within reach joins a card cluster
 * instead. A card that was moved last time keeps where it was while it fits, unless it has room back
 * over its venue or a spot whose trail is shorterTrailToMove shorter, so cards don't jump about as
 * the globe turns.
 */
function arrange(cards: readonly CardBox[], names: readonly ScreenBox[], screen: CardScene): Arrangement {
  const boxes = [...cards].sort((a, b) => a.rank - b.rank || (a.gameId < b.gameId ? -1 : a.gameId > b.gameId ? 1 : 0))
  const placed: CardBox[] = []
  // From each moved card's centre to its venue: the part outside the card is its trail.
  const trails: Segment[] = []
  const shifts = new Map<string, ScreenOffset>()
  const cardClusters: Omit<CardCluster, 'status'>[] = []

  for (const card of boxes) {
    // Only what's within reach of the card can get in its way.
    const near = (x: number, y: number, halfWidth: number, halfHeight: number) =>
      Math.abs(x - card.x) < reach + card.width / 2 + halfWidth && Math.abs(y - card.y) < reach + card.height / 2 + halfHeight
    const cardsNear = placed.filter((other) => near(other.x, other.y, other.width / 2 + gap, other.height / 2 + gap))
    const venuesNear = boxes.filter((other) => near(other.venueX, other.venueY, venueRadius, venueRadius))
    const namesNear = names.filter((name) => near(name.x, name.y, name.width / 2, name.height / 2))
    const trailsNear = trails.filter(
      (trail) =>
        near((trail.x1 + trail.x2) / 2, (trail.y1 + trail.y2) / 2, Math.abs(trail.x1 - trail.x2) / 2, Math.abs(trail.y1 - trail.y2) / 2),
    )
    // Half the pointer from the bottom of the card down to its venue, which is about as wide as it is long.
    const halfPointer = (card.venueY - card.y - card.height / 2) / 2

    // What the card keeps clear of (cards, venues and names), each as the box its centre stays out of.
    const keepOutBox = (x: number, y: number, halfWidth: number, halfHeight: number): ScreenBox => ({
      x,
      y,
      width: card.width + 2 * halfWidth,
      height: card.height + 2 * halfHeight,
    })
    const keepOuts = [
      ...cardsNear.map((other) => keepOutBox(other.x, other.y, other.width / 2 + gap, other.height / 2 + gap)),
      ...venuesNear.map((other) => keepOutBox(other.venueX, other.venueY, venueRadius, venueRadius)),
      ...namesNear.map((name) => keepOutBox(name.x, name.y, name.width / 2 + gap, name.height / 2 + gap)),
    ]
    // Spots near each other are mostly kept out by the same thing, so what kept out the last is tried first.
    let lastKeptOut: ScreenBox | undefined
    const isKeptOut = (x: number, y: number) => {
      const inside = (box: ScreenBox) => Math.abs(x - box.x) < box.width / 2 && Math.abs(y - box.y) < box.height / 2
      if (lastKeptOut && inside(lastKeptOut)) return true
      const found = keepOuts.find(inside)
      if (found) lastKeptOut = found
      return found !== undefined
    }

    const fits = ({ dx, dy }: ScreenOffset) => {
      const x = card.x + dx
      const y = card.y + dy
      const moved = dx !== 0 || dy !== 0
      const onScreen =
        x - card.width / 2 >= 0 && x + card.width / 2 <= screen.width && y - card.height / 2 >= 0 && y + card.height / 2 <= screen.height
      // A card that isn't moved sits where it would whatever the screen's edges, as its venue may be off it.
      if (moved && !onScreen) return false
      if (isKeptOut(x, y)) return false
      return (
        moved ||
        namesNear.every(
          (name) =>
            Math.abs(card.venueX - name.x) >= halfPointer + name.width / 2 + gap ||
            Math.abs(card.venueY - halfPointer - name.y) >= halfPointer + name.height / 2 + gap,
        )
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

    // Where the card was last time will do while it fits, trails or not, so a trail edging across a
    // card doesn't send it elsewhere; only a spot whose trail is no longer than trailToBeatPrevious does.
    const previous = card.previous && (card.previous.dx !== 0 || card.previous.dy !== 0) && fits(card.previous) ? card.previous : undefined
    const trailToBeatPrevious = previous && trailLength({ ...card, x: card.x + previous.dx, y: card.y + previous.dy }) - shorterTrailToMove

    // Where it would sit, if that's clear; or else the nearest spot clear of trails, while it's little
    // further than the nearest spot at all.
    let nearest: Spot | undefined = fits(unmovedSpot) ? unmovedSpot : undefined
    let clear: Spot | undefined = nearest && trailsClear(unmovedSpot) ? unmovedSpot : undefined
    if (!clear) {
      for (const spot of spotsFor(card)) {
        if (nearest && spot.trail > nearest.trail + clearTrailAllowance) break
        if (!nearest && trailToBeatPrevious !== undefined && spot.trail > trailToBeatPrevious) break
        if (!fits(spot)) continue
        nearest ??= spot
        if (trailsClear(spot)) {
          clear = spot
          break
        }
      }
    }
    const best = clear ?? nearest
    const keepsPrevious =
      previous !== undefined && clear !== unmovedSpot && !(best && trailToBeatPrevious !== undefined && best.trail <= trailToBeatPrevious)
    const shift = keepsPrevious ? previous : best && { dx: best.dx, dy: best.dy }
    if (shift) {
      shifts.set(card.gameId, shift)
      const x = card.x + shift.dx
      const y = card.y + shift.dy
      placed.push({ ...card, x, y })
      if (shift.dx !== 0 || shift.dy !== 0) trails.push({ x1: x, y1: y, x2: card.venueX, y2: card.venueY })
      continue
    }
    const cardCluster = cardClusters.find((c) => Math.hypot(c.x - card.venueX, c.y - card.venueY) <= cardClusterRadius)
    if (cardCluster) cardCluster.gameIds.push(card.gameId)
    else cardClusters.push({ gameIds: [card.gameId], x: card.venueX, y: card.venueY })
  }
  return { shifts, cardClusters }
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
