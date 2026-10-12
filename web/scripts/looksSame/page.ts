import type { FeatureCollection } from 'geojson'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'

declare global {
  interface Window {
    /**
     * In dev runs, the globe's map and whether every game is on screen and still (see
     * src/globe/layoutTrace.ts); a base from before #112 has only the map.
     */
    scoremap?: { map: MapLibreMap; ready?: () => boolean }
  }
}

/** A camera as MapLibre's `jumpTo` takes it. */
export interface Camera {
  center: [longitude: number, latitude: number]
  zoom: number
}

/** What the looks-same check asks of the page, one step at a time. */
export type PageStep =
  /** Waits for the page to say it's ready, then gives how many games there are. */
  | { step: 'games' }
  /** Hides what can't be repeated, turns the camera to the view and waits for the page to say it's ready. */
  | { step: 'show'; camera: Camera }
  /** Stops every animation, and keeps them stopped. */
  | { step: 'freeze' }

export type PageAnswer =
  | { games: number }
  | { shown: true }
  | { frozen: true }
  /** Still waiting, for what's named, after as long as one step may take: run the step again. */
  | { waiting: string }
  /** The page can't say when it's ready (`window.scoremap.ready()`): it's from before #112. */
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
    const { map, ready } = window.scoremap!
    if (!ready) return { tooOld: true }
    const settle = async () => {
      await document.fonts.ready
      await until(ready, 'the globe to settle (window.scoremap.ready())')
    }
    /** Turns the camera, and waits for the map to draw the turn (until then the page still says it's ready) and settle. */
    const turn = async (camera: Camera) => {
      const drawn = new Promise((resolve) => map.once('render', resolve))
      map.jumpTo(camera)
      await drawn
      await settle()
    }

    if (step.step === 'games') {
      await settle()
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
      await settle()
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
    await frames(2)
    return { frozen: true }
  } catch (error) {
    if (error instanceof Waiting) return { waiting: error.message }
    throw error
  }
}
