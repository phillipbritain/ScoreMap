import type { Game } from '../games/game'

/**
 * Where a game stands, for the game panel. The server's clock line already carries the period
 * in the sport's style, so this adds only the delay and fallbacks: "Q3 4:12", "Q3 4:12 · Delayed",
 * "Final/OT", "Upcoming".
 */
export function gameProgress({ status, delayed, clock }: Pick<Game, 'status' | 'delayed' | 'clock'>): string {
  if (status === 'Live' && delayed) return clock ? `${clock} · Delayed` : 'Delayed'
  if (status === 'Upcoming') return status
  return clock ?? status
}
