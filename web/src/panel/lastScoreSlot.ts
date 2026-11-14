import type { Game } from '../games/game'

/** Sports with two sides whose feeds give no scoring plays: tennis's sets show in the band, cricket's score is its runs. */
const sportsWithoutScoringPlays = new Set(['Tennis', 'Cricket'])

/**
 * Whether the game panel has a Last score slot for the game: only where a game scores in plays (a goal,
 * a basket, a touchdown), so a field (a race, a golf tournament), a fight card, tennis and cricket have
 * none. Held with "None yet" before the first score, so the panel keeps its height as the game goes on.
 */
export function hasLastScoreSlot(game: Pick<Game, 'sport' | 'contest'>): boolean {
  return game.contest.kind === 'sides' && !sportsWithoutScoringPlays.has(game.sport)
}
