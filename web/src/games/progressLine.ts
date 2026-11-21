import type { Game } from './game'

/**
 * How much room the line has: `short` for pins and score cards, where the pin's color already
 * shows the status; `full` for the event panel, which names the status when there's nothing more to say.
 */
export type ProgressLineForm = 'short' | 'full'

/** Whose time an Upcoming game's start time is written in: the browser's time zone and locale unless given. */
export interface Viewer {
  /** IANA time zone. */
  timeZone?: string
  /** BCP 47 locale. */
  locale?: string
}

/**
 * Where a game stands, in one line. The server's clock line already carries the period in the
 * sport's style ("Q3 4:12", "Final/OT", "FT"), so this adds only the delay and fallbacks. Short:
 * "Q3 4:12", "Delayed", "Final", or null. Full: also
 * "Q3 4:12 · Delayed", "Live". In either, an Upcoming game's start time in the viewer's time,
 * "1:00 PM" (ADR-0029).
 */
export function progressLine(
  { status, delayed, clock, startTime }: Pick<Game, 'status' | 'delayed' | 'clock' | 'startTime'>,
  form: ProgressLineForm,
  viewer: Viewer = {},
): string | null {
  const statusName = form === 'full' ? status : null
  switch (status) {
    case 'Live':
      if (!delayed) return clock ?? statusName
      return form === 'full' && clock ? `${clock} · Delayed` : 'Delayed'
    case 'Final':
      return clock ?? 'Final'
    case 'Upcoming':
      return new Date(startTime).toLocaleTimeString(viewer.locale, { timeZone: viewer.timeZone, hour: 'numeric', minute: '2-digit' })
  }
}
