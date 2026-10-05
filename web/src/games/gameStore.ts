import type { Game } from './game'
import type { GameChange } from './gameChange'

/**
 * Applies one change event from the server to the browser's list of games.
 * Every change but a removal carries the game's current state, so it replaces the
 * game in place, or adds it if the browser didn't have it.
 */
export function applyChange(games: readonly Game[], { kind, game }: GameChange): Game[] {
  if (kind === 'removed') return games.filter((g) => g.id !== game.id)

  const index = games.findIndex((g) => g.id === game.id)
  if (index === -1) return [...games, game]
  return games.with(index, game)
}
