import type { GameOdds } from '../games/game'

/** The betting line in one line: "SEA -2.5 · O/U 40.5", or whichever half the bookmaker gives. */
export function oddsLine({ line, overUnder }: GameOdds): string | null {
  const parts = [line, overUnder !== null ? `O/U ${overUnder}` : null].filter((part) => part !== null)
  return parts.length > 0 ? parts.join(' · ') : null
}
