import type { Game } from '../games/game'

/**
 * How worth watching a game's score card is, for which cards get room first where it's busy (see
 * layOutCards): lower first. Games whose venues are near the middle of the screen (see nearCenter) come
 * before the rest; then, on each side, hot games, then other Live games, then Upcoming, then Final;
 * within each, games with ranked teams first, the higher ranked the sooner.
 */
export function cardRank(game: Game, centered: boolean): number {
  return (centered ? 0 : tierSize) + statusTier(game) + rankedBonus(game)
}

// Each status tier is 1 apart, a ranked team's bonus less than that, so the near-center side takes
// all four status tiers.
const tierSize = 4

function statusTier(game: Game): number {
  if (game.status === 'Upcoming') return 2
  if (game.status === 'Final') return 3
  return game.hot ? 0 : 1
}

/** Between 0 and -0.9, so it never takes a game out of its tier: each ranked team brings it forward, a higher rank further. */
function rankedBonus(game: Game): number {
  if (game.contest.kind !== 'sides') return 0
  let bonus = 0
  for (const { rank } of [game.contest.home, game.contest.away]) if (rank) bonus -= 0.2 + (26 - rank) * 0.01
  return Math.max(-0.9, bonus)
}

/**
 * Whether a venue is near the middle of the screen, for cardRank: within a fifth of the screen's shorter
 * side of its center.
 */
export function nearCenter(x: number, y: number, width: number, height: number): boolean {
  return Math.hypot(x - width / 2, y - height / 2) <= centerShare * Math.min(width, height)
}
const centerShare = 0.2
