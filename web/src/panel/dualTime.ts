/** An instant shown in the viewer's time, with the venue's local time beside it when that differs. */
export interface DualTime {
  /** Date and time in the viewer's time zone, e.g. "Sun, Oct 4, 1:00 PM EDT". */
  viewer: string
  /**
   * Time in the venue's time zone, e.g. "12:00 PM CDT", with the date added when the venue is on
   * a different day. Null when the venue's time zone is unknown or matches the viewer's.
   */
  venue: string | null
}

export interface Viewer {
  /** IANA time zone; defaults to the browser's. */
  timeZone?: string
  /** BCP 47 locale; defaults to the browser's. */
  locale?: string
}

/** Formats an ISO 8601 instant in both the viewer's and the venue's time zones. */
export function dualTime(instant: string, venueTimeZone: string | null, viewer: Viewer = {}): DualTime {
  const date = new Date(instant)
  const { locale } = viewer
  const viewerZone = viewer.timeZone ?? new Intl.DateTimeFormat().resolvedOptions().timeZone

  const viewerDay = day(date, viewerZone, locale)
  const viewerTime = time(date, viewerZone, locale)
  const shown: DualTime = { viewer: `${viewerDay}, ${viewerTime}`, venue: null }
  if (!venueTimeZone) return shown

  const venueDay = day(date, venueTimeZone, locale)
  const venueTime = time(date, venueTimeZone, locale)
  if (venueDay === viewerDay && venueTime === viewerTime) return shown

  return { ...shown, venue: venueDay === viewerDay ? venueTime : `${venueDay}, ${venueTime}` }
}

function day(date: Date, timeZone: string, locale?: string): string {
  return format(date, locale, { timeZone, weekday: 'short', month: 'short', day: 'numeric' })
}

function time(date: Date, timeZone: string, locale?: string): string {
  return format(date, locale, { timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
}

function format(date: Date, locale: string | undefined, options: Intl.DateTimeFormatOptions): string {
  // ICU puts narrow no-break spaces before AM/PM; plain spaces read the same and wrap predictably.
  return new Intl.DateTimeFormat(locale, options).format(date).replace(/\s/g, ' ')
}
