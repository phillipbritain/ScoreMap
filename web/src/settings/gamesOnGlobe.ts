import type { Game } from '../games/game'
import type { ViewerSettings } from './viewerSettings'
import { visibleGames } from './visibleGames'

/** How many games a globe with fewer on now is filled to with Upcoming games (ADR-0029). */
export const fillTo = 12

/** An Upcoming game starting this soon is on now, whatever else is on (ADR-0021). */
export const startsSoon = 30 * 60_000

/** The furthest off an Upcoming game can start and still fill in (ADR-0029); the server sends none further. */
export const fillInReach = 6 * 60 * 60_000

/**
 * The games whose pins the globe shows, at the board's time `now` (ms since the epoch; see boardClock),
 * under the viewer's settings (see visibleGames). Every game on now shows: Live, Final, or Upcoming and
 * starting within 30 minutes. When fewer than 12 of those show across the whole globe, Upcoming games
 * fill in, soonest first, to make 12 (ADR-0029): each starting within 6 hours, on the same day as now in
 * the viewer's time zone (`timeZone`, the browser's unless given). With "Only show live games" on, no
 * Upcoming game shows at all, but Final games still do.
 */
export function gamesOnGlobe(games: readonly Game[], settings: ViewerSettings, now: number, timeZone?: string): Game[] {
  const visible = visibleGames(games, settings)
  if (settings.onlyLiveGames) return visible.filter((game) => game.status !== 'Upcoming')
  const startsIn = (game: Game) => Date.parse(game.startTime) - now
  const isOnNow = (game: Game) => game.status !== 'Upcoming' || startsIn(game) <= startsSoon
  const onNow = visible.filter(isOnNow)
  if (onNow.length >= fillTo) return onNow
  const day = dayIn(timeZone)
  const today = day(now)
  const fillIns = visible
    .filter((game) => !isOnNow(game) && startsIn(game) <= fillInReach && day(Date.parse(game.startTime)) === today)
    .sort((a, b) => startsIn(a) - startsIn(b))
    .slice(0, fillTo - onNow.length)
  return [...onNow, ...fillIns]
}

/** The calendar day a time falls on in a time zone, as "2026-11-15". */
function dayIn(timeZone: string | undefined): (time: number) => string {
  const format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  return (time) => format.format(time)
}
