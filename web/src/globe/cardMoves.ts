import type { ScreenOffset } from './cardLayout'

/** How long a score card takes to glide to where the card layout moved it, in milliseconds. */
export const cardMoveDuration = 300

/**
 * How far, in pixels, the card layout can move a card from one frame to the next for it to just follow:
 * the small steps of a card pushed along as the globe turns. A move further than this glides.
 */
export const cardMoveStep = 6

/** How a glide slows as it lands: easing out, as the CSS's cubic-bezier(0.33, 1, 0.68, 1) does (see PlacedCard.glide). */
export const cardMoveEasing = 'cubic-bezier(0.33, 1, 0.68, 1)'
const easeOut = (t: number) => 1 - (1 - t) ** 3

/**
 * A card gliding to where the card layout put it: how far it's shown off that, on screen, as it starts
 * (`at`, as `performance.now()` gives it), closing to nothing over cardMoveDuration. Its trail glides
 * with it (see trailLayer).
 */
export interface CardMove {
  from: ScreenOffset
  at: number
}

/** How far a gliding card is shown off where the card layout put it, at `now`. */
export function moveLag({ from, at }: CardMove, now: number): ScreenOffset {
  const left = 1 - easeOut(Math.min(1, Math.max(0, (now - at) / cardMoveDuration)))
  return { dx: from.dx * left, dy: from.dy * left }
}

/** Whether a card is still gliding at `now`. */
export const stillMoving = ({ at }: CardMove, now: number): boolean => now - at < cardMoveDuration

/**
 * Which score cards are gliding from where they were to where the card layout has moved them, so they
 * don't jump: say, handed round a crowd, moved aside for a card come into view, or back over their
 * venues. Told where each card shown is laid out each frame; a card's first place, and its small steps
 * as the globe turns, are followed at once. A card moved again as it glides glides on from where it's
 * shown, so it never jumps either.
 */
export interface CardMoves {
  /** Where the card layout puts a game's card now: gives the glide this starts, if it starts one. */
  placeAt(gameId: string, offset: ScreenOffset, now: number): CardMove | undefined
  /** The game's card's glide, while it's gliding at `now`. */
  move(gameId: string, now: number): CardMove | undefined
  /** The game's card is no longer shown (gone, or counted in a card cluster): shown again, it starts where it's laid out. */
  forget(gameId: string): void
}

export function cardMoves(): CardMoves {
  const cards = new Map<string, { offset: ScreenOffset; move?: CardMove }>()
  return {
    placeAt(gameId, offset, now) {
      const card = cards.get(gameId)
      if (!card) {
        cards.set(gameId, { offset })
        return undefined
      }
      const step = { dx: card.offset.dx - offset.dx, dy: card.offset.dy - offset.dy }
      card.offset = offset
      if (Math.hypot(step.dx, step.dy) <= cardMoveStep) return undefined
      const lag = card.move && stillMoving(card.move, now) ? moveLag(card.move, now) : { dx: 0, dy: 0 }
      card.move = { from: { dx: lag.dx + step.dx, dy: lag.dy + step.dy }, at: now }
      return card.move
    },
    move(gameId, now) {
      const move = cards.get(gameId)?.move
      return move && stillMoving(move, now) ? move : undefined
    },
    forget(gameId) {
      cards.delete(gameId)
    },
  }
}
