import { useEffect, useState } from 'react'
import type { Game } from '../games/game'
import { boardTime, type BoardClock } from '../live/boardClock'
import { gamesOnGlobe } from './gamesOnGlobe'
import type { ViewerSettings } from './viewerSettings'

// How often, in real time, the games on the globe are looked at again, as Upcoming games come within
// 30 minutes of their start or fill-in games' days end: each second, so a sped-up scenario keeps up.
const tickMs = 1000

/**
 * The games whose pins the globe shows (see gamesOnGlobe) at the board's time, read from its clock
 * (see boardTime) each second. The same list (the same array) while its games stay the same, so the
 * clock's ticks alone redraw nothing.
 */
export function useGamesOnGlobe(games: readonly Game[], settings: ViewerSettings, clock: BoardClock | null): Game[] {
  const [realNow, setRealNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setRealNow(Date.now()), tickMs)
    return () => clearInterval(timer)
  }, [])
  const shown = gamesOnGlobe(games, settings, boardTime(clock, realNow))
  // Kept from the last render while the same, as React's pattern for state from earlier renders.
  const [kept, setKept] = useState(shown)
  if (sameGames(kept, shown)) return kept
  setKept(shown)
  return shown
}

function sameGames(a: readonly Game[], b: readonly Game[]): boolean {
  return a.length === b.length && a.every((game, i) => game === b[i])
}
