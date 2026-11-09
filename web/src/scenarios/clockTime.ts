export interface Viewer {
  /** IANA time zone; defaults to the browser's. */
  timeZone?: string
  /** BCP 47 locale; defaults to the browser's. */
  locale?: string
}

/** An instant to the second in the viewer's time, with its date, e.g. "Sun, Oct 4, 1:47:12 PM EDT". */
export function clockTime(date: Date, viewer: Viewer = {}): string {
  const { locale } = viewer
  const timeZone = viewer.timeZone ?? new Intl.DateTimeFormat().resolvedOptions().timeZone
  const day = format(date, locale, { timeZone, weekday: 'short', month: 'short', day: 'numeric' })
  const seconds = format(date, locale, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
  return `${day}, ${seconds}`
}

function format(date: Date, locale: string | undefined, options: Intl.DateTimeFormatOptions): string {
  // ICU puts narrow no-break spaces before AM/PM; plain spaces read the same and wrap predictably.
  return new Intl.DateTimeFormat(locale, options).format(date).replace(/\s/g, ' ')
}
