import type { Game } from './game'

/**
 * How much room the line has: `short` for pins and score cards, where the pin's colour already
 * shows the status; `full` for the game panel, which names the status when there's nothing more to say.
 */
export type ProgressLineForm = 'short' | 'full'

/**
 * Where a game stands, in one line. The server's clock line already carries the period in the
 * sport's style ("Q3 4:12", "Final/OT", "FT"), so this adds only the delay, the kind of disruption
 * and fallbacks. Short: "Q3 4:12", "Delayed", "Final", "Postponed", or null. Full: also
 * "Q3 4:12 · Delayed", "Live", "Upcoming".
 */
export function progressLine(
  { status, delayed, disruption, clock }: Pick<Game, 'status' | 'delayed' | 'disruption' | 'clock'>,
  form: ProgressLineForm,
): string | null {
  const statusName = form === 'full' ? status : null
  switch (status) {
    case 'Live':
      if (!delayed) return clock ?? statusName
      return form === 'full' && clock ? `${clock} · Delayed` : 'Delayed'
    case 'Final':
      return clock ?? 'Final'
    case 'Disrupted':
      return disruption ?? statusName
    case 'Upcoming':
      return statusName
  }
}
