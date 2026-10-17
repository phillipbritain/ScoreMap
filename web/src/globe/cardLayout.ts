import type { GameStatus } from '../games/game'
import { cardJump } from './cardJump'
import type { ScreenBox } from './cityNameBox'
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
  /** How far a card keeps from its venue at the least, its trail between: it sits this far above it. */
  venueGap: number
  /** Where the names of games' cities are written, which cards keep clear of. */
  names?: readonly ScreenBox[]
  /**
   * Whether the camera has moved since the cards were last laid out. While it moves, the cards in
   * card clusters take turns to look for room, one a layout, as looking takes a while (see arrange).
   */
  moving?: boolean
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
  /** Where the card's bottom centre sits, from its venue: the venue gap above it, or moved aside. */
  offset: ScreenOffset
  /** True when there's no room for the card and its game is counted in a card cluster instead. */
  inCardCluster: boolean
  /** Whether the card was moved aside from above its venue to make room. */
  moved: boolean
  /** From the edge of the card to its venue; null for a card in a card cluster. */
  trail: Segment | null
  /** For a card in a card cluster, how many layouts ago it last looked for room (see CardScene.moving). */
  lookedAgo?: number
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
 * Lays out the score cards on screen. Each sits the venue gap above its venue, with a short trail down
 * to it, unless that overlaps another card, a venue or a city's name: then it's moved aside, wholly on
 * screen and as near its venue as it can be but never nearer than the gap, its trail following it (see
 * arrange). Cards get room by status,
 * most prominent first, whichever is selected, so selecting a card never moves it; a card with no
 * room within reach joins a card cluster. Cards whose venues are well off screen stay where they'd
 * sit: nothing on screen can get in their way. Given where the cards were last time (`previous`), a
 * card stays where it was while that still has room, moving only back over its venue, a card the
 * globe turns off screen pushes the cards in its way along rather than leave them, and a card looking
 * for room leaves others where they were, so cards don't jump about as the globe turns.
 */
export function layOutCards(
  cards: readonly ScreenCard[],
  scene: CardScene,
  previous: ReadonlyMap<string, CardPlacement> = new Map(),
): CardLayout {
  const sitting = (card: ScreenCard): CardPlacement => ({
    offset: { dx: 0, dy: -scene.venueGap },
    inCardCluster: false,
    moved: false,
    trail: { x1: card.venueX, y1: card.venueY - scene.venueGap, x2: card.venueX, y2: card.venueY },
  })
  const statuses = new Map(cards.map((card) => [card.gameId, card.status]))
  const rank = ({ status }: ScreenCard) => statusProminence.indexOf(status)
  const boxes = cards
    .filter((card) => nearScreen(card.venueX, card.venueY, scene))
    .map(
      (card): CardBox => ({
        gameId: card.gameId,
        x: card.venueX,
        y: card.venueY - scene.venueGap - card.height / 2,
        width: card.width,
        height: card.height,
        venueX: card.venueX,
        venueY: card.venueY,
        rank: rank(card),
        previous: shiftOf(previous.get(card.gameId), scene.venueGap),
        lookedAgo: lookedAgoOf(previous.get(card.gameId)),
      }),
    )
  const names = (scene.names ?? []).filter((name) => nearScreen(name.x, name.y, scene))
  const { shifts, cardClusters, lookedAgo } = arrange(pushOnScreen(boxes, scene), names, scene)

  const placements = new Map(cards.map((card) => [card.gameId, sitting(card)]))
  for (const box of boxes) {
    const shift = shifts.get(box.gameId)
    if (!shift) {
      placements.set(box.gameId, {
        offset: { dx: 0, dy: -scene.venueGap },
        inCardCluster: true,
        moved: false,
        trail: null,
        lookedAgo: lookedAgo.get(box.gameId),
      })
      continue
    }
    placements.set(box.gameId, {
      offset: { dx: shift.dx, dy: shift.dy - scene.venueGap },
      inCardCluster: false,
      moved: isMoved(shift),
      trail: trail(box, shift),
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
function shiftOf(placement: CardPlacement | undefined, venueGap: number): ScreenOffset | undefined {
  if (!placement || placement.inCardCluster) return undefined
  return { dx: placement.offset.dx, dy: placement.offset.dy + venueGap }
}

/** How many layouts ago a card in a card cluster last looked for room; undefined for a card that had room. */
function lookedAgoOf(placement: CardPlacement | undefined): number | undefined {
  return placement?.inCardCluster ? (placement.lookedAgo ?? 0) : undefined
}

/** A card's trail: from where a line from the card's centre to its venue leaves the card. */
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
  /** The card's centre, the venue gap above its venue. */
  x: number
  y: number
  width: number
  height: number
  /** The card's venue, which no card may cover. */
  venueX: number
  venueY: number
  /** Which cards get room first where there isn't room for all: lowest first, then in game order. */
  rank: number
  /** How far the card was moved last time it was laid out, if it had room. */
  previous?: ScreenOffset
  /** If it was in a card cluster last time, how many layouts ago it last looked for room. */
  lookedAgo?: number
}

interface Arrangement {
  /** How far each card that has room is moved from where it would sit. */
  shifts: Map<string, ScreenOffset>
  /** The rest, grouped with others nearby. */
  cardClusters: Omit<CardCluster, 'status'>[]
  /** For each card in a card cluster, how many layouts ago it last looked for room. */
  lookedAgo: Map<string, number>
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
// How far, in pixels, a card may come into what it keeps clear of, or off screen, and keep where it
// was last time: as the globe turns, what's on screen shifts a little against itself, and cards
// packed against each other would otherwise jump apart.
const drift = 4
// The spacing, in pixels, of the grid every move tried lies on (see moves and takenSpots).
const spotGrid = 4
// Moves tried for a card that doesn't fit where it would sit: every 4 pixels out to 160, then every 8
// out to the reach, which is close enough that far out and keeps laying out quick.
const moves: ScreenOffset[] = []
for (const [step, from, to] of [
  [spotGrid, 0, 160],
  [2 * spotGrid, 160, reach],
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

/**
 * For the card looking for room, which spots on the grid of moves (out to the reach either way) are
 * taken, so each spot it tries is looked up rather than checked against everything near: spots off
 * screen, kept out by what it keeps clear of or too near its own venue; and, apart, spots where a card
 * still to be placed was last time. Kept for the next card that looks, as making them anew each time
 * would take a while.
 */
const gridHalf = reach / spotGrid
const gridSize = 2 * gridHalf + 1
const takenSpots = new Uint8Array(gridSize * gridSize)
const heldSpots = new Uint8Array(gridSize * gridSize)

/** Where a move is in takenSpots and heldSpots. */
const gridCell = ({ dx, dy }: ScreenOffset) => (dy / spotGrid + gridHalf) * gridSize + dx / spotGrid + gridHalf

/**
 * The first and last steps along one way of the grid at which `isIn` holds, which it does for a run of
 * steps, if any. `from` and `to` are about where the run starts and ends, worked out by division;
 * `isIn` itself settles the ends, so they agree to the last bit with the sums it makes.
 */
function stepsWhere(isIn: (step: number) => boolean, from: number, to: number): [number, number] | null {
  let first = Math.max(-gridHalf, Math.ceil(from) - 1)
  let last = Math.min(gridHalf, Math.floor(to) + 1)
  while (first <= last && !isIn(first)) first++
  while (last >= first && !isIn(last)) last--
  return first <= last ? [first, last] : null
}

/** How long a card's trail is: from its venue to the card's nearest edge. */
function trailLength({ width, height, x, y, venueX, venueY }: Omit<CardBox, 'gameId' | 'rank'>): number {
  return Math.hypot(Math.max(0, Math.abs(venueX - x) - width / 2), Math.max(0, Math.abs(venueY - y) - height / 2))
}

/**
 * Finds room for score cards that would overlap. Cards are placed one at a time, by rank and then
 * game order so the same cards always land the same way: each stays where it would sit if that's
 * clear, or else is moved to the spot with the shortest trail that keeps on screen, overlaps no card
 * already placed, covers no venue, so every venue (a trail's end) stays in sight, and keeps the venue
 * gap from its own venue. No card covers a name in `names`; trails may cross them. A spot
 * whose trail crosses no card and that sits on no trail is taken over a nearer one while its trail
 * is at most clearTrailAllowance longer. A card with no spot within reach joins a card cluster
 * instead. So cards don't jump about as the globe turns, a card keeps where it was last time while it
 * fits, give or take the drift, moving only back over its venue once that's clear; and a card looking
 * for room leaves the cards still to be placed where they were.
 *
 * A card with no room looks at every spot within reach, which takes a while. So while the camera moves,
 * the cards in card clusters last time take turns to look, one a layout, the one that looked longest
 * ago; the rest stay in their card clusters unless there's room where they'd sit. Once it stops, they
 * all look.
 */
function arrange(cards: readonly CardBox[], names: readonly ScreenBox[], screen: CardScene): Arrangement {
  const boxes = [...cards].sort((a, b) => a.rank - b.rank || (a.gameId < b.gameId ? -1 : a.gameId > b.gameId ? 1 : 0))
  const looking = screen.moving
    ? boxes.reduce<CardBox | undefined>(
        (longest, box) => (box.lookedAgo !== undefined && (!longest || box.lookedAgo > longest.lookedAgo!) ? box : longest),
        undefined,
      )
    : undefined
  const lookedAgo = new Map<string, number>()
  const placed: CardBox[] = []
  // From each card's centre to its venue: the part outside the card is its trail.
  const trails: Segment[] = []
  const shifts = new Map<string, ScreenOffset>()
  const cardClusters: Omit<CardCluster, 'status'>[] = []

  for (const [index, card] of boxes.entries()) {
    // Only what's within reach of the card can get in its way.
    const near = (x: number, y: number, halfWidth: number, halfHeight: number) =>
      Math.abs(x - card.x) < reach + card.width / 2 + halfWidth && Math.abs(y - card.y) < reach + card.height / 2 + halfHeight
    // What the card keeps clear of, each as a box its centre stays out of, `halfWidth` and `halfHeight`
    // wider either way than the card: cards placed, venues and names near. Each is given to `see` in
    // turn, until it says to stop. Most cards try a spot or two, so nothing is made for them.
    type KeepOut = (x: number, y: number, halfWidth: number, halfHeight: number) => boolean
    const someKeepOut = (see: KeepOut) => {
      for (const other of placed) {
        const halfWidth = other.width / 2 + gap
        const halfHeight = other.height / 2 + gap
        if (near(other.x, other.y, halfWidth, halfHeight) && see(other.x, other.y, halfWidth, halfHeight)) return true
      }
      // A card keeps the venue gap from its own venue rather than the venue's spot (see fits).
      for (const other of boxes) {
        if (other !== card && near(other.venueX, other.venueY, venueRadius, venueRadius) && see(other.venueX, other.venueY, venueRadius, venueRadius))
          return true
      }
      for (const name of names) {
        if (near(name.x, name.y, name.width / 2, name.height / 2) && see(name.x, name.y, name.width / 2 + gap, name.height / 2 + gap)) return true
      }
      return false
    }
    // Where the cards still to be placed were last time, which this card keeps out of unless it was there.
    const someHeld = (see: KeepOut) => {
      for (let later = index + 1; later < boxes.length; later++) {
        const other = boxes[later]
        if (!other.previous) continue
        const x = other.x + other.previous.dx
        const y = other.y + other.previous.dy
        const halfWidth = other.width / 2 + gap
        const halfHeight = other.height / 2 + gap
        if (near(x, y, halfWidth, halfHeight) && see(x, y, halfWidth, halfHeight)) return true
      }
      return false
    }
    // Whether a card centred at (x, y) is inside a box the card keeps out of, by more than `slack` pixels.
    const inside = (x: number, y: number, slack: number) => (boxX: number, boxY: number, halfWidth: number, halfHeight: number) =>
      Math.abs(x - boxX) < (card.width + 2 * halfWidth) / 2 - slack && Math.abs(y - boxY) < (card.height + 2 * halfHeight) / 2 - slack
    // Whether a card centred at x (or y) is on screen, by `slack` pixels.
    const onScreenAcross = (x: number, slack: number) => x - card.width / 2 >= -slack && x + card.width / 2 <= screen.width + slack
    const onScreenDown = (y: number, slack: number) => y - card.height / 2 >= -slack && y + card.height / 2 <= screen.height + slack

    // Whether the card fits moved this way: `slack` is how far it may come into what it keeps clear
    // of, or off screen, for keeping where it was last time.
    const fits = ({ dx, dy }: ScreenOffset, slack = 0) => {
      const x = card.x + dx
      const y = card.y + dy
      const moved = dx !== 0 || dy !== 0
      // A card that isn't moved sits where it would whatever the screen's edges, as its venue may be off it.
      if (moved && !(onScreenAcross(x, slack) && onScreenDown(y, slack))) return false
      if (someKeepOut(inside(x, y, slack))) return false
      // Sitting above its venue, it's the gap away by its making: measured, a rounding error could put it inside.
      if (moved && inside(x, y, slack)(card.venueX, card.venueY, screen.venueGap, screen.venueGap)) return false
      const wasHere = card.previous !== undefined && dx === card.previous.dx && dy === card.previous.dy
      return wasHere || !someHeld(inside(x, y, 0))
    }

    // The same as fits, for every move on the grid at once (see takenSpots), for a card looking for room.
    const markTakenSpots = () => {
      takenSpots.fill(0)
      heldSpots.fill(0)
      // Taken where a card centred there is inside the box, by the same sums as inside.
      const mark = (spots: Uint8Array) => (boxX: number, boxY: number, halfWidth: number, halfHeight: number) => {
        const halfAcross = (card.width + 2 * halfWidth) / 2
        const halfDown = (card.height + 2 * halfHeight) / 2
        const across = stepsWhere(
          (step) => Math.abs(card.x + step * spotGrid - boxX) < halfAcross,
          (boxX - halfAcross - card.x) / spotGrid,
          (boxX + halfAcross - card.x) / spotGrid,
        )
        const down = stepsWhere(
          (step) => Math.abs(card.y + step * spotGrid - boxY) < halfDown,
          (boxY - halfDown - card.y) / spotGrid,
          (boxY + halfDown - card.y) / spotGrid,
        )
        if (!across || !down) return false
        for (let row = down[0]; row <= down[1]; row++) {
          const start = gridCell({ dx: across[0] * spotGrid, dy: row * spotGrid })
          spots.fill(1, start, start + across[1] - across[0] + 1)
        }
        return false
      }
      someKeepOut(mark(takenSpots))
      mark(takenSpots)(card.venueX, card.venueY, screen.venueGap, screen.venueGap)
      someHeld(mark(heldSpots))
      // Off screen.
      const across = stepsWhere(
        (step) => onScreenAcross(card.x + step * spotGrid, 0),
        (card.width / 2 - card.x) / spotGrid,
        (screen.width - card.width / 2 - card.x) / spotGrid,
      )
      const down = stepsWhere(
        (step) => onScreenDown(card.y + step * spotGrid, 0),
        (card.height / 2 - card.y) / spotGrid,
        (screen.height - card.height / 2 - card.y) / spotGrid,
      )
      for (let row = -gridHalf; row <= gridHalf; row++) {
        const start = gridCell({ dx: -gridHalf * spotGrid, dy: row * spotGrid })
        if (!across || !down || row < down[0] || row > down[1]) {
          takenSpots.fill(1, start, start + gridSize)
          continue
        }
        takenSpots.fill(1, start, start + across[0] + gridHalf)
        takenSpots.fill(1, start + across[1] + gridHalf + 1, start + gridSize)
      }
    }
    // Whether a move on the grid fits, once markTakenSpots has marked the spots taken.
    const spotFits = (spot: ScreenOffset) => {
      const cell = gridCell(spot)
      if (takenSpots[cell]) return false
      const wasHere = card.previous !== undefined && spot.dx === card.previous.dx && spot.dy === card.previous.dy
      return wasHere || !heldSpots[cell]
    }

    // The cards and trails near, which the card's trail and the card keep clear of; worked out when first needed.
    let clearOf: { cards: CardBox[]; trails: Segment[] } | undefined
    // Whether a card moved this way would keep clear of trails: its own crossing no card, and no trail
    // already drawn crossing it.
    const trailsClear = ({ dx, dy }: ScreenOffset) => {
      clearOf ??= {
        cards: placed.filter((other) => near(other.x, other.y, other.width / 2 + gap, other.height / 2 + gap)),
        trails: trails.filter((trail) =>
          near((trail.x1 + trail.x2) / 2, (trail.y1 + trail.y2) / 2, Math.abs(trail.x1 - trail.x2) / 2, Math.abs(trail.y1 - trail.y2) / 2),
        ),
      }
      const x = card.x + dx
      const y = card.y + dy
      const halfWidth = card.width / 2 + gap
      const halfHeight = card.height / 2 + gap
      if (clearOf.trails.some((trail) => crosses(trail, x, y, halfWidth, halfHeight))) return false
      const own = { x1: x, y1: y, x2: card.venueX, y2: card.venueY }
      return clearOf.cards.every((other) => !crosses(own, other.x, other.y, other.width / 2 + gap, other.height / 2 + gap))
    }

    // Where a moved card was last time will do while it fits, give or take the drift, trails or not,
    // so a trail edging across a card doesn't send it elsewhere.
    const wasMoved = isMoved(card.previous)
    const previous = wasMoved && fits(card.previous!, drift) ? card.previous : undefined

    // Where it would sit, if that's clear (give or take the drift, if it sat there last time); or else
    // the nearest spot clear of trails, while it's little further than the nearest spot at all.
    let nearest: Spot | undefined = fits(unmovedSpot, card.previous && !wasMoved ? drift : 0) ? unmovedSpot : undefined
    let clear: Spot | undefined = nearest && trailsClear(unmovedSpot) ? unmovedSpot : undefined
    // A card in a card cluster last time looks for room only when its turn comes (see above).
    const looks = card.lookedAgo === undefined || !screen.moving || card === looking
    if (!clear && !previous && looks) {
      markTakenSpots()
      for (const spot of spotsFor(card)) {
        if (nearest && spot.trail > nearest.trail + clearTrailAllowance) break
        if (!spotFits(spot)) continue
        nearest ??= spot
        if (trailsClear(spot)) {
          clear = spot
          break
        }
      }
    }
    const best = clear ?? nearest
    const shift = previous && clear !== unmovedSpot ? previous : best && { dx: best.dx, dy: best.dy }
    if (shift) {
      shifts.set(card.gameId, shift)
      const x = card.x + shift.dx
      const y = card.y + shift.dy
      placed.push({ ...card, x, y })
      trails.push({ x1: x, y1: y, x2: card.venueX, y2: card.venueY })
      continue
    }
    lookedAgo.set(card.gameId, looks ? 0 : card.lookedAgo! + 1)
    const cardCluster = cardClusters.find((c) => Math.hypot(c.x - card.venueX, c.y - card.venueY) <= cardClusterRadius)
    if (cardCluster) cardCluster.gameIds.push(card.gameId)
    else cardClusters.push({ gameIds: [card.gameId], x: card.venueX, y: card.venueY })
  }
  return { shifts, cardClusters, lookedAgo }
}

/** One way across the screen: where a card is along it, how far it was moved, and how big it is. */
interface Axis {
  centre: 'x' | 'y'
  shift: 'dx' | 'dy'
  size: 'width' | 'height'
}
const horizontal: Axis = { centre: 'x', shift: 'dx', size: 'width' }
const vertical: Axis = { centre: 'y', shift: 'dy', size: 'height' }

/**
 * Brings the moved cards the globe has turned off screen since last time back on, by where they were
 * then, pushing the moved cards in their way along with them. A crowd of cards reaching to the edge
 * of the screen is packed against it, so as the globe turns the crowd towards that edge, the card
 * there would otherwise find every spot near it taken, and leave for the room opening up on the far
 * side of the crowd. A card is pushed no further than a jump, and a push stops at a card sitting over
 * its venue or at the other edge of the screen, leaving the card to find room as it would. A card
 * pushed onto a venue or a name finds room elsewhere (see arrange): the one card nearest the crowd
 * leaves, rather than every card pushing it.
 */
function pushOnScreen(cards: readonly CardBox[], screen: CardScene): CardBox[] {
  // Where each card was moved to last time, as pushed so far.
  const was = new Map(cards.flatMap((card) => (card.previous ? [[card.gameId, card.previous] as const] : [])))

  // Pushes a card `distance` pixels along an axis, and the moved cards in its way as far as it takes
  // to keep the gap between them; or, if that would push a card off screen, further than a jump or
  // from over its venue, nothing.
  const push = (pushed: CardBox, along: Axis, distance: number) => {
    const across = along === horizontal ? vertical : horizontal
    const direction = Math.sign(distance)
    const pushes = new Map([[pushed.gameId, distance]])
    const centreAfterPush = (card: CardBox, axis: Axis) =>
      card[axis.centre] + was.get(card.gameId)![axis.shift] + (axis === along ? (pushes.get(card.gameId) ?? 0) : 0)
    const queue = [pushed]
    for (const card of queue) {
      const centre = centreAfterPush(card, along)
      if (centre - card[along.size] / 2 < 0 || centre + card[along.size] / 2 > screen[along.size]) return
      for (const other of cards) {
        if (other === card || !was.has(other.gameId)) continue
        // Cards beside each other across the push, give or take the drift, aren't in each other's way.
        const besideBy = (card[across.size] + other[across.size]) / 2 + gap - drift
        if (Math.abs(centreAfterPush(other, across) - centreAfterPush(card, across)) >= besideBy) continue
        // How far the other card is ahead of this one, in the push's direction, and must be.
        const ahead = (centreAfterPush(other, along) - centre) * direction
        const needed = (card[along.size] + other[along.size]) / 2 + gap
        if (ahead < 0 || ahead >= needed) continue
        if (!isMoved(was.get(other.gameId))) return
        const pushedBy = (pushes.get(other.gameId) ?? 0) + (needed - ahead) * direction
        if (Math.abs(pushedBy) > cardJump) return
        pushes.set(other.gameId, pushedBy)
        queue.push(other)
      }
    }
    for (const [gameId, pushedBy] of pushes) {
      const at = was.get(gameId)!
      was.set(gameId, { ...at, [along.shift]: at[along.shift] + pushedBy })
    }
  }

  // By rank and then game order, as cards are arranged, so the same cards always land the same way.
  const order = [...cards].sort((a, b) => a.rank - b.rank || (a.gameId < b.gameId ? -1 : a.gameId > b.gameId ? 1 : 0))
  for (const along of [horizontal, vertical]) {
    for (const card of order) {
      const at = was.get(card.gameId)
      if (!isMoved(at)) continue
      const centre = card[along.centre] + at[along.shift]
      const half = card[along.size] / 2
      // How far it takes to bring the card back on screen, off one edge or the other.
      const backOn = Math.max(0, half - centre) || Math.min(0, screen[along.size] - half - centre)
      if (backOn !== 0 && Math.abs(backOn) <= cardJump) push(card, along, backOn)
    }
  }
  return cards.map((card) => (was.get(card.gameId) === card.previous ? card : { ...card, previous: was.get(card.gameId) }))
}

/** Whether a card was moved from where it would sit: it had room, somewhere other than above its venue. */
function isMoved(shift: ScreenOffset | undefined): shift is ScreenOffset {
  return shift !== undefined && (shift.dx !== 0 || shift.dy !== 0)
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
