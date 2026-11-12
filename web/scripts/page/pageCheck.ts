import '../scoremapWindow.ts'

/** What `npm run page` asks of the page. */
export type PageCheck =
  /** Waits for the globe's stage to be ready: the first games are on it and it has stopped moving. */
  | { check: 'ready' }
  /** Waits for the globe to be still, as after a turn of the camera. */
  | { check: 'settled' }
  /** Once the globe is ready, turns the camera to look at `center` from `zoom`, and waits for it to be still. */
  | { check: 'camera'; center: [longitude: number, latitude: number]; zoom: number }
  /** Reads a property (`textContent` unless given; `rect` for the bounding box) of the first element the selector picks. */
  | { check: 'read'; selector: string; property?: string }
  /**
   * Once the globe is ready, makes a score (`score`) or a finish (`finish`) happen to a Live game on
   * screen, in this tab only: one with a score card, or with none, one whose pin is in view.
   */
  | { check: 'happen'; event: 'score' | 'finish' }

export type PageCheckAnswer =
  | { ready: true }
  | { settled: true }
  | { camera: true }
  | { value: unknown }
  /** What `happen` made happen: the change's kind, and the game's id. */
  | { happened: { kind: string; gameId: string } }
  /** No Live game on screen could have it happen. */
  | { noGame: true }
  /** No element matches the selector. */
  | { missing: string }
  /** Still waiting, for what's named, after as long as one check may take: run the check again. */
  | { waiting: string }

/**
 * Runs a check in a dev run's page (sent there as its source text, so it's self-contained), through
 * `window.scoremap` and the DOM, without the caller writing a script of their own.
 *
 * agent-browser gives up on a script after 30 seconds, so a check waits at most `waitMs` (20 seconds)
 * and then says what it's waiting for; it can be run again, picking up where it was.
 */
export async function pageCheck(check: PageCheck, waitMs = 20_000): Promise<PageCheckAnswer> {
  const end = Date.now() + waitMs
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
  const { map, stage, settled } = window.scoremap! as Required<NonNullable<Window['scoremap']>>
  if (check.check === 'camera') {
    const notReady = await until(() => stage() === 'ready', 'the globe to be ready (window.scoremap.stage())')
    if (notReady) return { waiting: notReady }
    // Settled reads true until the map has drawn the turn.
    let drawn = false
    map.once('render', () => (drawn = true))
    map.jumpTo({ center: check.center, zoom: check.zoom })
    const waiting =
      (await until(() => drawn, 'the map to draw the turn')) ?? (await until(settled, 'the globe to settle (window.scoremap.settled())'))
    return waiting ? { waiting } : { camera: true }
  }
  if (check.check === 'happen') {
    const notReady = await until(() => stage() === 'ready', 'the globe to be ready (window.scoremap.stage())')
    if (notReady) return { waiting: notReady }
    const happen = window.scoremapGames?.happen
    if (!happen) return { waiting: 'the live games (window.scoremapGames): is this a dev run?' }
    const carded = new Set((window.scoremap!.frames?.at(-1) as { cards?: { gameId: string }[] } | undefined)?.cards?.map((card) => card.gameId))
    const { lng, lat } = map.getCenter()
    const canvas = map.getCanvas()
    // With no cards, a pin in view: inside the map, on the side of the globe facing the viewer.
    const inView = (longitude: number, latitude: number) => {
      const r = Math.PI / 180
      const facing =
        Math.sin(lat * r) * Math.sin(latitude * r) + Math.cos(lat * r) * Math.cos(latitude * r) * Math.cos((longitude - lng) * r) > 0.2
      const { x, y } = map.project([longitude, latitude])
      return facing && x >= 0 && y >= 0 && x <= canvas.clientWidth && y <= canvas.clientHeight
    }
    const change = happen(check.event, ({ id, venue: { longitude, latitude } }) =>
      carded.size > 0 ? carded.has(id) : longitude !== null && latitude !== null && inView(longitude, latitude),
    )
    return change ? { happened: { kind: change.kind, gameId: change.game.id } } : { noGame: true }
  }
  if (check.check === 'ready') {
    await document.fonts.ready
    const waiting = await until(() => stage() === 'ready', 'the globe to be ready (window.scoremap.stage())')
    return waiting ? { waiting } : { ready: true }
  }
  const waiting = await until(settled, 'the globe to settle (window.scoremap.settled())')
  return waiting ? { waiting } : { settled: true }
}
