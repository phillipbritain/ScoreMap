import type { Game } from '../games/game'

/**
 * How a pin (or the cluster it's in) draws attention to a change: a lively burst when the score
 * changes, a pulse when a game starts, and a calmer fade when it finishes. The styles live in CSS.
 */
export type PinAnimation = 'score' | 'start' | 'finish'

/**
 * Which animation a game plays, going from how the globe last showed it to how it is now; null for
 * changes that only redraw it (the clock, the period, a delay). A game that starts or finishes
 * plays that, even if its score changed in the same update.
 */
export function pinAnimation(before: Game, after: Game): PinAnimation | null {
  if (before.status === 'Upcoming' && after.status === 'Live') return 'start'
  if (before.status === 'Live' && after.status === 'Final') return 'finish'
  if (before.home.score !== after.home.score || before.away.score !== after.away.score) return 'score'
  return null
}
