import type { Game } from '../games/game'
import { chosenConferences, type ViewerSettings } from './viewerSettings'

/**
 * The games whose pins the globe shows under the viewer's settings: those of the leagues switched on and,
 * in a league narrowed to some of its conferences, only those with a team in one of them (either side).
 * With Top Events on, only top events show, whichever leagues are switched off or narrowed.
 */
export function visibleGames(games: readonly Game[], settings: ViewerSettings): Game[] {
  if (settings.topEventsOnly) return games.filter((game) => game.topEvent)
  const hidden = new Set(settings.hiddenLeagues)
  return games.filter((game) => !hidden.has(game.league) && inChosenConference(game, settings))
}

function inChosenConference(game: Game, settings: ViewerSettings): boolean {
  const chosen = chosenConferences(settings, game.league)
  if (chosen.length === 0) return true
  if (game.contest.kind !== 'sides') return false
  const { home, away } = game.contest
  return [home.conference, away.conference].some((conference) => conference !== null && chosen.includes(conference))
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
