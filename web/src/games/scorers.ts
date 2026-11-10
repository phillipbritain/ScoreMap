import type { Game } from './game'

/** One of a two-sided game's sides. */
export type Side = 'home' | 'away'

/**
 * The side that last scored in a game, and when (the clock liveGames reads: performance.now() in the
 * app): what the score card and the game panel light up for a moment (see spotlightMs), kept for each
 * game since the last snapshot in what just happened (see justHappened.ts).
 */
export interface Scorer {
  side: Side
  at: number
}

/** How long a scorer stays lit, from when it scored. */
export const spotlightMs = 3_000

/**
 * The side that scored between two states of a two-sided game: the one side whose score went up.
 * Null when neither did or both did (a correction, or two scores in one change, can't be told apart),
 * or when the game has no two sides (a field or a fight card).
 */
export function scoringSide(before: Game, after: Game): Side | null {
  if (before.contest.kind !== 'sides' || after.contest.kind !== 'sides') return null
  const { home: homeBefore, away: awayBefore } = before.contest
  const { home, away } = after.contest
  const homeUp = rose(homeBefore.score, home.score)
  const awayUp = rose(awayBefore.score, away.score)
  if (homeUp === awayUp) return null
  return homeUp ? 'home' : 'away'
}

const rose = (before: string | null, after: string | null): boolean => {
  const was = Number(before ?? 0)
  const is = Number(after)
  return after !== null && Number.isFinite(was) && Number.isFinite(is) && is > was
}

/**
 * How far into its spotlight a scorer is, as of now: what a lit row's animation starts from, so a
 * row drawn again partway through (a card redrawn for its clock, a panel opened) carries on rather
 * than starting over. Null once the spotlight is over, or with no scorer.
 */
export function spotlightElapsed(scorer: Scorer | undefined, now: number): number | null {
  if (!scorer) return null
  const elapsed = Math.max(0, now - scorer.at)
  return elapsed < spotlightMs ? elapsed : null
}
