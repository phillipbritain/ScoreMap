import type { Game } from '../games/game'
import type { ViewerSettings } from './viewerSettings'

/** The games whose pins the globe shows under the viewer's settings. */
export function visibleGames(games: readonly Game[], settings: ViewerSettings): Game[] {
  const hidden = new Set(settings.hiddenLeagues)
  return games.filter(
    (game) => !hidden.has(game.league) && (!settings.liveOnly || game.status === 'Live'),
  )
}

/**
 * The message shown over an empty globe, so the viewer knows it isn't broken.
 * `games` is null until the server's first snapshot arrives.
 */
export function noPinsMessage(games: readonly Game[] | null, visible: readonly Game[]): string | null {
  if (games === null || visible.length > 0) return null
  return games.length === 0 ? 'No games right now.' : 'No games match your filters.'
}
