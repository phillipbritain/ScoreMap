/**
 * The game board's clock, as the server sends it (BoardClock on the server): it `reads` this at the real
 * time `at` (both ISO 8601), and runs `times` times as fast as real time from there (0 while paused). The
 * real time with real games; the scenario clock in a scenario or a demo.
 */
export interface BoardClock {
  at: string
  reads: string
  times: number
}

/**
 * The time the board's games are on at the real time `realNow` (both ms since the epoch): the board's
 * clock run forward, or the real time until the server has sent it.
 */
export function boardTime(clock: BoardClock | null, realNow: number): number {
  if (!clock) return realNow
  return Date.parse(clock.reads) + (realNow - Date.parse(clock.at)) * clock.times
}
