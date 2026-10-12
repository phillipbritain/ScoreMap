import type { FeatureCollection } from 'geojson'
import type { Map as MapLibreMap } from 'maplibre-gl'

declare global {
  interface Window {
    /**
     * In dev runs, the globe's map and whether every game is on screen and still (see
     * src/globe/layoutTrace.ts); a base from before the second has only the map.
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
  /** Waits for the games to arrive and the map to settle, then gives how many games there are. */
  | { step: 'games' }
  /**
   * Waits for the globe and its `games`, hides what can't be repeated, turns the camera to the view
   * and waits for it to settle.
   */
  | { step: 'show'; games: number; camera: Camera }
  /** Stops every animation, and keeps them stopped. */
  | { step: 'freeze' }

export type PageAnswer =
  | { games: number }
  | { shown: true }
  | { frozen: true }
  /** Still waiting, for what's named, after as long as one step may take: run the step again. */
  | { waiting: string }

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
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
  const frames = async (count: number) => {
    for (let i = 0; i < count; i++) await new Promise((resolve) => requestAnimationFrame(resolve))
  }
  const until = async (ready: () => boolean | Promise<boolean>, what: string) => {
    while (!(await ready())) {
      if (Date.now() > end) throw new Waiting(what)
      await sleep(100)
    }
  }

  try {
    await until(() => !!window.scoremap?.map, 'the globe (window.scoremap): is this a dev run?')
    const map = window.scoremap!.map
    const pinCount = async () => {
      const source = map.getSource('pins') as { getData?: () => Promise<FeatureCollection> } | undefined
      return (await source?.getData?.())?.features.length ?? 0
    }
    const ready = window.scoremap!.ready
    const settle = async () => {
      await document.fonts.ready
      if (ready) {
        // Once the map has drawn the frame the last change asked for, the page says when every game
        // is on screen and still (see GlobeMap.settled).
        await frames(2)
        await until(ready, 'the globe to settle (window.scoremap.ready())')
        return
      }
      // A base from before the page could say: wait for the map, and long enough for the score
      // cards to settle (they're laid out each frame).
      await until(() => map.loaded() && map.areTilesLoaded() && !map.isMoving(), 'the map to load')
      await frames(60)
      let idle = false
      map.once('idle', () => (idle = true))
      map.triggerRepaint()
      await until(() => idle, 'the map to settle')
      await frames(2)
    }

    if (step.step === 'games') {
      if (ready) {
        await settle()
        return { games: await pinCount() }
      }
      // Without the page to say, the games have all come once their count holds for a while (they
      // come a league at a time). None at all has to hold longer, since the first take a moment.
      let count = -1
      let heldSince = Date.now()
      await until(async () => {
        const now = await pinCount()
        if (now !== count) [count, heldSince] = [now, Date.now()]
        return Date.now() - heldSince > (count ? 3000 : 15_000)
      }, 'the games')
      await settle()
      return { games: count }
    }

    if (step.step === 'show') {
      if (!document.getElementById('looks-same')) {
        const style = document.createElement('style')
        style.id = 'looks-same'
        style.textContent = 'img { visibility: hidden !important; }'
        document.head.append(style)
      }
      if (ready) await settle()
      // A base from before the pins source was named so can't be counted; give it time instead.
      if (map.getSource('pins')) await until(async () => (await pinCount()) === step.games, `${step.games} games`)
      else await sleep(5000)
      // Score cards are laid out from where they were the frame before, and the games may have come
      // in any order. Zoomed out to small pins, no cards show, so back at the view they're laid out
      // afresh, all at once.
      map.jumpTo({ center: step.camera.center, zoom: 2 })
      await settle()
      map.jumpTo(step.camera)
      await settle()
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
