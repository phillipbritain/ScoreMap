import type { FeatureCollection } from 'geojson'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'

declare global {
  interface Window {
    /**
     * In dev runs, the globe's map, how far it has loaded and whether it's still (see
     * src/globe/layoutTrace.ts). A base from before #128 says only whether every game is on screen
     * and still (`ready`), and one from before #112 has only the map.
     */
    scoremap?: {
      map: MapLibreMap
      stage?: () => 'waitingForGames' | 'drawing' | 'ready'
      settled?: () => boolean
      ready?: () => boolean
    }
  }
}

/** A camera as MapLibre's `jumpTo` takes it. */
export interface Camera {
  center: [longitude: number, latitude: number]
  zoom: number
}

/** What the looks-same check asks of the page, one step at a time. */
export type PageStep =
  /** Waits for the globe to be ready, then gives how many games there are. */
  | { step: 'games' }
  /** Hides what can't be repeated, turns the camera to the view and waits for the globe to settle. */
  | { step: 'show'; camera: Camera }
  /** Stops every animation, and keeps them stopped. */
  | { step: 'freeze' }

export type PageAnswer =
  | { games: number }
  | { shown: true }
  | { frozen: true }
  /** Still waiting, for what's named, after as long as one step may take: run the step again. */
  | { waiting: string }
  /** The page can't say when it's ready (`stage()`, or before #128 `ready()`): it's from before #112. */
  | { tooOld: true }

/**
 * Runs a step in a dev run's page (sent there as its source text, so it's self-contained), through
 * `window.scoremap`. Logos and venue photos are hidden, since they come from outside and may or may
 * not have loaded; animations are stopped where they start, or finished if they end.
 *
 * agent-browser gives up on a script after 30 seconds, so a step waits at most 20 and then says
 * what it's waiting for; every step can be run again, picking up where it was.
 */
export async function pageStep(step: PageStep): Promise<PageAnswer> {
  const end = Date.now() + 20_000
  class Waiting extends Error {}
  const frames = async (count: number) => {
    for (let i = 0; i < count; i++) await new Promise((resolve) => requestAnimationFrame(resolve))
  }
  const until = async (ready: () => boolean | Promise<boolean>, what: string) => {
    while (!(await ready())) {
      if (Date.now() > end) throw new Waiting(what)
      await new Promise<void>((resolve) => setTimeout(resolve, 100))
    }
  }

  try {
    await until(() => !!window.scoremap?.map, 'the globe (window.scoremap): is this a dev run?')
    const { map, stage, settled, ready } = window.scoremap!
    // A base from before #128 says only ready(): whether every game is on screen and still, right now.
    const checks =
      stage && settled
        ? { ready: { check: () => stage() === 'ready', name: 'stage() to be ready' }, still: { check: settled, name: 'settled()' } }
        : ready && { ready: { check: ready, name: 'ready()' }, still: { check: ready, name: 'ready()' } }
    if (!checks) return { tooOld: true }
    /** Waits for the page's fonts, then for the globe to pass one of window.scoremap's checks. */
    const globeTo = async (what: string, { check, name }: { check: () => boolean; name: string }) => {
      await document.fonts.ready
      await until(check, `the globe to ${what} (window.scoremap.${name})`)
    }
    /** Waits for the globe to be ready. */
    const beReady = () => globeTo('be ready', checks.ready)
    /** Turns the camera, and waits for the map to draw the turn (until then the globe still says it's still) and settle. */
    const turn = async (camera: Camera) => {
      let drawn = false
      map.once('render', () => (drawn = true))
      map.jumpTo(camera)
      await until(() => drawn, 'the map to draw the turn')
      await globeTo('settle', checks.still)
    }

    if (step.step === 'games') {
      await beReady()
      // The globe is only ready once the pins source has loaded (see GlobeMap.settled).
      const pins = (await map.getSource<GeoJSONSource>('pins')!.getData()) as FeatureCollection
      return { games: pins.features.length }
    }

    if (step.step === 'show') {
      if (!document.getElementById('looks-same')) {
        const style = document.createElement('style')
        style.id = 'looks-same'
        style.textContent = 'img { visibility: hidden !important; }'
        document.head.append(style)
      }
      await beReady()
      // Score cards are laid out from where they were the frame before, and the games may have come
      // in any order. Zoomed out to small pins, no cards show, so back at the view they're laid out
      // afresh, all at once.
      await turn({ center: step.camera.center, zoom: 2 })
      await turn(step.camera)
      return { shown: true }
    }

    // Every frame from here on, since a score card redrawn after this starts its animations afresh.
    const freeze = () => {
      for (const animation of document.getAnimations()) {
        if (animation.playState === 'paused' || animation.playState === 'finished') continue
        if (animation.effect?.getComputedTiming().endTime === Infinity) {
          animation.pause()
          animation.currentTime = 0
        } else {
          animation.finish()
        }
      }
      requestAnimationFrame(freeze)
    }
    freeze()
    // Not waiting for the page, which was ready: letting the browser draw the stopped animations
    // before the screenshot.
    await frames(2)
    return { frozen: true }
  } catch (error) {
    if (error instanceof Waiting) return { waiting: error.message }
    throw error
  }
}
