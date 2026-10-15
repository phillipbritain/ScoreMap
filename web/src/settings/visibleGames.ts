import type { Game } from '../games/game'
import type { ViewerSettings } from './viewerSettings'

/**
 * The games whose pins the globe shows under the viewer's settings. With Top Events on, only top
 * events show, whichever leagues are switched off.
 */
export function visibleGames(games: readonly Game[], settings: ViewerSettings): Game[] {
  const hidden = new Set(settings.hiddenLeagues)
  return games.filter(
    (game) =>
      (settings.topEventsOnly ? game.topEvent : !hidden.has(game.league)) &&
      (!settings.liveOnly || game.status === 'Live') &&
      (settings.showDisrupted || game.status !== 'Disrupted'),
  )
}

/**
 * The message shown over an empty globe, so the viewer knows it isn't broken.
 * `games` is null until the server's first snapshot arrives.
 */
export function noPinsMessage(
  games: readonly Game[] | null,
  visible: readonly Game[],
  settings: ViewerSettings,
): string | null {
  if (games === null || visible.length > 0) return null
  if (games.length === 0) return 'No games right now.'
  return settings.topEventsOnly && !games.some((game) => game.topEvent)
    ? 'No top events right now.'
    : 'No games match your settings.'
}
