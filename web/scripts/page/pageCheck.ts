// window.scoremap's type is declared in ../looksSame/page.ts, part of the same scripts build.

/** What `npm run page` asks of the page. */
export type PageCheck =
  /** Waits for the globe's stage to be ready: the first games are on it and it has stopped moving. */
  | { check: 'ready' }
  /** Waits for the globe to be still, as after a turn of the camera. */
  | { check: 'settled' }
  /** Reads a property (`textContent` unless given; `rect` for the bounding box) of the first element the selector picks. */
  | { check: 'read'; selector: string; property?: string }

export type PageCheckAnswer =
  | { ready: true }
  | { settled: true }
  | { value: unknown }
  /** No element matches the selector. */
  | { missing: string }
  /** Still waiting, for what's named, after as long as one check may take: run the check again. */
  | { waiting: string }

/**
 * Runs a check in a dev run's page (sent there as its source text, so it's self-contained), through
 * `window.scoremap` and the DOM, without the caller writing a script of their own.
 *
 * agent-browser gives up on a script after 30 seconds, so a check waits at most `ms` (20 seconds)
 * and then says what it's waiting for; it can be run again, picking up where it was.
 */
export async function pageCheck(check: PageCheck, ms = 20_000): Promise<PageCheckAnswer> {
  const end = Date.now() + ms
  const until = async (done: () => boolean, what: string) => {
    while (!done()) {
      if (Date.now() > end) return what
      await new Promise<void>((resolve) => setTimeout(resolve, 100))
    }
  }

  if (check.check === 'read') {
    const element = document.querySelector(check.selector)
    if (!element) return { missing: check.selector }
    const property = check.property ?? 'textContent'
    if (property === 'rect') return { value: element.getBoundingClientRect().toJSON() }
    return { value: (element as unknown as Record<string, unknown>)[property] }
  }

  const noGlobe = await until(() => !!window.scoremap?.stage, 'the globe (window.scoremap): is this a dev run?')
  if (noGlobe) return { waiting: noGlobe }
  const { stage, settled } = window.scoremap! as Required<NonNullable<Window['scoremap']>>
  if (check.check === 'ready') {
    await document.fonts.ready
    const waiting = await until(() => stage() === 'ready', 'the globe to be ready (window.scoremap.stage())')
    return waiting ? { waiting } : { ready: true }
  }
  const waiting = await until(settled, 'the globe to settle (window.scoremap.settled())')
  return waiting ? { waiting } : { settled: true }
}
