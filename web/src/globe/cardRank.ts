import type { Game } from '../games/game'

/**
 * How worth watching a game is, for which score cards get room first where it's busy (see layOutCards):
 * lower first. Hot games, then games in clutch time, then close Live games, then other Live games, then
 * Upcoming, then Final; within each, games with ranked teams first, the higher ranked the sooner.
 */
export function cardRank(game: Game): number {
  return band(game) + rankedBonus(game)
}

function band(game: Game): number {
  if (game.status === 'Upcoming') return 4
  if (game.status === 'Final') return 5
  if (game.hot) return 0
  if (game.clutchTime) return 1
  return isClose(game) ? 2 : 3
}

/** Within a score of each other: in football and basketball 8 points, in other sports 1. */
function isClose(game: Game): boolean {
  if (game.contest.kind !== 'sides') return false
  const home = Number(game.contest.home.score)
  const away = Number(game.contest.away.score)
  if (game.contest.home.score === null || game.contest.away.score === null || !Number.isFinite(home) || !Number.isFinite(away)) return false
  const closeBy = game.sport === 'Basketball' || game.sport === 'Football' ? 8 : 1
  return Math.abs(home - away) <= closeBy
}

/** Between 0 and -0.9, so it never takes a game out of its band: each ranked team brings it forward, a higher rank further. */
function rankedBonus(game: Game): number {
  if (game.contest.kind !== 'sides') return 0
  let bonus = 0
  for (const { rank } of [game.contest.home, game.contest.away]) if (rank) bonus -= 0.2 + (26 - rank) * 0.01
  return Math.max(-0.9, bonus)
}
