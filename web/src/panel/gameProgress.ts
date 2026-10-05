import type { Game } from '../games/game'

/** Where a game stands, for the game panel: "Period 3 · 4:12", "Period 3 · Delayed", "Final", "Upcoming". */
export function gameProgress({ status, delayed, clock, period }: Pick<Game, 'status' | 'delayed' | 'clock' | 'period'>): string {
  if (status !== 'Live') return status
  const parts = [period !== null ? `Period ${period}` : null, delayed ? 'Delayed' : clock]
  return parts.filter((part) => part !== null).join(' · ')
}
