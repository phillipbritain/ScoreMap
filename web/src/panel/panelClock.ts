import type { Game } from '../games/game'
import { progressLine } from '../games/progressLine'

/**
 * The game clock as the event panel shows it over the venue's photo: a small label over a big line. Live
 * with a running clock, the period in words over the time ("4th Quarter" over "8:30"); Live with none, the
 * period itself ("Bot 4th", "Halftime", "65'") under "Live", or "Delayed" while it's held up; Upcoming,
 * the start time under "Starts"; Final, how it ended ("Final/OT", "Final/ET") alone. `live` lights the dot
 * that says the clock is running.
 */
export interface PanelClock {
  label: string | null
  main: string
  live: boolean
}

const clockTime = /^(.*?)\s*(\d{1,2}:\d{2})$/

const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`

/** A period as the feed shortens it ("Q4", "P2", "OT"), in words; any other as it is. */
function periodInWords(period: string): string {
  const numbered = /^([QPH])(\d)$/.exec(period)
  if (numbered) return `${ordinal(Number(numbered[2]))} ${{ Q: 'Quarter', P: 'Period', H: 'Half' }[numbered[1] as 'Q' | 'P' | 'H']}`
  if (period === 'OT') return 'Overtime'
  return period
}

export function panelClock(game: Pick<Game, 'status' | 'delayed' | 'clock' | 'startTime'>): PanelClock {
  switch (game.status) {
    case 'Upcoming':
      return { label: 'Starts', main: progressLine(game, 'short')!, live: false }
    case 'Final':
      return { label: null, main: game.clock ?? 'Final', live: false }
    case 'Live': {
      const timed = game.clock ? clockTime.exec(game.clock) : null
      if (timed) {
        const period = periodInWords(timed[1])
        return { label: game.delayed ? `${period} · Delayed` : period, main: timed[2], live: !game.delayed }
      }
      return { label: game.delayed ? 'Delayed' : 'Live', main: game.clock ?? 'Live', live: !game.delayed }
    }
  }
}
