import type { Game, GameTeam } from './game'

/**
 * A game's two sides in the order they're shown, top first: the away team on top, as US scoreboards
 * have it, but in tennis the home side, the player ESPN lists first. The server's tennis progress line
 * and scoreline read in the same order.
 */
export function sidesTopFirst({ sport, home, away }: Pick<Game, 'sport' | 'home' | 'away'>): [GameTeam, GameTeam] {
  return sport === 'Tennis' ? [home, away] : [away, home]
}
