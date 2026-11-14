/**
 * How long a score card takes to come in or go out, its trail and venue dot with it, in milliseconds.
 * The card's own look is the CSS's: dropping in from a little above as it fades in and lifting away as
 * it fades out, as its game arrives or leaves (`.score-card-coming`, `.score-card-going`); fading in or
 * out in place as it comes into view or goes out of it (`.score-card-appearing`, `.score-card-fading`).
 */
export const cardComingDuration = 300

/** A score card coming in or going out, and when it started (as `performance.now()` gives it). */
export interface CardComing {
  in: boolean
  at: number
}

/** How far a card coming in or going out (and its trail) is shown at `now`: from 0, gone, to 1, fully shown. */
export function comingOpacity({ in: comingIn, at }: CardComing, now: number): number {
  const done = Math.min(1, Math.max(0, (now - at) / cardComingDuration))
  return comingIn ? done : 1 - done
}

/** Whether a card is still coming in or going out at `now`. */
export const stillComing = ({ at }: CardComing, now: number): boolean => now - at < cardComingDuration

/**
 * Which score cards are coming in or going out: a game arriving on the board or leaving it (it was
 * shown 30 minutes before its start, it dropped off after it finished, or the viewer's leagues showed
 * or hid it) has its card come in or go out; a card that comes or goes as the camera moves (its venue
 * crossing the horizon or the card radius) appears or fades the same way, in place. One moved into or
 * out of a card cluster stays placed, and fades by the CSS alone (`[data-in-card-cluster]`).
 */
export interface CardComings {
  /**
   * The games on the board now. Gives those gone since the games before (whose cards, if on screen,
   * go out: see goOut), and those back while their cards were still going out (whose old cards go at
   * once, as a new one comes in). The first games shown are none of them arrivals: they're the board
   * as it was when ScoreMap opened.
   */
  showGames(gameIds: Iterable<string>): { gone: string[]; back: string[] }
  /**
   * A card was just placed for a game: it comes in, its game having just arrived, or else appears, as
   * it came into view. One appearing as its old card fades out of view appears from as far as that got.
   */
  cardPlaced(gameId: string, now: number): 'comesIn' | 'appears'
  /**
   * The pins were read with the games last shown in them: a game that arrived and got no card by now
   * (its venue out of view, or far from the center of the view) comes into view later without coming in.
   */
  pinsRead(): void
  /** A card on screen goes out from now: its game gone from the board, or its venue out of view. */
  goOut(gameId: string, now: number): void
  /** The game's card coming in or going out, if it is. */
  coming(gameId: string): CardComing | undefined
  /** Forgets those done by `now`: gives the games whose cards came in, and those whose cards went out (to remove). */
  over(now: number): { cameIn: string[]; wentOut: string[] }
}

export function cardComings(): CardComings {
  let shown: Set<string> | null = null
  /** Games arrived since the pins were last read, for a card to come in. */
  const arrived = new Set<string>()
  const comings = new Map<string, CardComing>()

  return {
    showGames(gameIds) {
      const now = new Set(gameIds)
      const before = shown
      shown = now
      if (!before) return { gone: [], back: [] }
      const back: string[] = []
      for (const gameId of now) {
        if (before.has(gameId)) continue
        arrived.add(gameId)
        if (comings.get(gameId)?.in === false) {
          comings.delete(gameId)
          back.push(gameId)
        }
      }
      const gone = [...before].filter((gameId) => !now.has(gameId))
      for (const gameId of gone) arrived.delete(gameId)
      return { gone, back }
    },

    cardPlaced(gameId, now) {
      if (arrived.delete(gameId)) {
        comings.set(gameId, { in: true, at: now })
        return 'comesIn'
      }
      const fading = comings.get(gameId)
      const shownNow = fading?.in === false ? comingOpacity(fading, now) : 0
      comings.set(gameId, { in: true, at: now - shownNow * cardComingDuration })
      return 'appears'
    },

    pinsRead() {
      arrived.clear()
    },

    goOut(gameId, now) {
      // Partway in, it goes out from as far in as it got.
      const coming = comings.get(gameId)
      const shownNow = coming ? comingOpacity(coming, now) : 1
      comings.set(gameId, { in: false, at: now - (1 - shownNow) * cardComingDuration })
    },

    coming: (gameId) => comings.get(gameId),

    over(now) {
      const cameIn: string[] = []
      const wentOut: string[] = []
      for (const [gameId, coming] of comings) {
        if (stillComing(coming, now)) continue
        comings.delete(gameId)
        ;(coming.in ? cameIn : wentOut).push(gameId)
      }
      return { cameIn, wentOut }
    },
  }
}
