import type { Game } from '../games/game'

/**
 * What the game panel's score block has where the last score goes:
 * - `shown`: the last score, or "None yet" before one, for sports that score in plays (a goal, a basket,
 *   a touchdown);
 * - `held`: its room left empty, for cricket, whose feed gives no scoring plays (its runs are its score),
 *   so its panel is as tall as the other team sports';
 * - `none`: nothing, for a field (a race, a golf tournament), a fight card and tennis, whose bands under
 *   the strip make their panels taller anyway.
 */
export type LastScoreSlot = 'shown' | 'held' | 'none'

export function lastScoreSlot(game: Pick<Game, 'sport' | 'contest'>): LastScoreSlot {
  if (game.contest.kind !== 'sides' || game.sport === 'Tennis') return 'none'
  return game.sport === 'Cricket' ? 'held' : 'shown'
}
