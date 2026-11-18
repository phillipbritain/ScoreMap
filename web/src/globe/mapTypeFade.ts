import type { MapType } from '../settings/viewerSettings'

/** How long the satellite imagery takes to fade in or out over the plain map, as the loading screen's fade. */
export const mapTypeFadeMs = 400

/**
 * How long a switch waits for the new map type's tiles before fading anyway, so slow or failing
 * imagery doesn't leave the switch looking as if it did nothing: the tiles still to come then arrive
 * as they load.
 */
export const mapTypeWaitMs = 4000

/** What a map-type cross-fade does to the map (see GlobeMap.setMapType). */
export interface MapTypeFadeMap {
  /** Shows the new map type's layers alongside the old one's, leaving the old one's as they are. */
  showBoth(): void
  /** Hides the old map type's layers, leaving the new one's. */
  hideOld(): void
  /** Fades the satellite imagery, which lies over the plain map, to this opacity over this long (0: at once). */
  fadeImagery(opacity: 0 | 1, ms: number): void
  /** Calls back once the map next goes idle, with the tiles in view loaded. Returns a cancel. */
  onceLoaded(then: () => void): () => void
}

/**
 * Switching map type as a cross-fade: the old map stays on screen while the new one's tiles load
 * out of sight, then the satellite imagery fades in over the plain map or out from over it, in one
 * go, and the old map's layers go once they're covered. The satellite imagery lies over the plain
 * map's land and sea (see globeStyle), so the one fade serves both ways.
 */
export interface MapTypeFade {
  /** Starts switching to this map type, finishing any switch still under way at once first. */
  start(to: MapType, map: MapTypeFadeMap): void
  /** Whether a switch is still under way: the globe isn't settled until it's done. */
  running(): boolean
  /** Stops any switch under way where it is, doing nothing more. */
  destroy(): void
}

export function mapTypeFade(): MapTypeFade {
  /** The switch under way: what finishes it at once, and what stops its wait and timers. */
  let current: { finish: () => void; stop: () => void } | null = null

  const finishAtOnce = () => {
    const was = current
    if (!was) return
    was.stop()
    current = null
    was.finish()
  }

  return {
    start(to, map) {
      finishAtOnce()
      const finish = () => {
        map.fadeImagery(1, 0)
        map.hideOld()
      }
      let stopWait = () => {}
      let waitTimer: ReturnType<typeof setTimeout> | undefined
      let fadeTimer: ReturnType<typeof setTimeout> | undefined
      const stop = () => {
        stopWait()
        clearTimeout(waitTimer)
        clearTimeout(fadeTimer)
      }
      const switching = { finish, stop }
      current = switching

      const fade = () => {
        if (current !== switching) return
        stopWait()
        clearTimeout(waitTimer)
        map.fadeImagery(to === 'satellite' ? 1 : 0, mapTypeFadeMs)
        fadeTimer = setTimeout(() => {
          if (current !== switching) return
          current = null
          map.hideOld()
          // Whole again for the next time the satellite map shows; hidden by now, so unseen.
          if (to === 'plain') map.fadeImagery(1, 0)
        }, mapTypeFadeMs)
      }

      // The imagery starts unseen, so loading it shows nothing until it fades in.
      if (to === 'satellite') map.fadeImagery(0, 0)
      map.showBoth()
      stopWait = map.onceLoaded(fade)
      waitTimer = setTimeout(fade, mapTypeWaitMs)
    },
    running: () => current !== null,
    destroy() {
      current?.stop()
      current = null
    },
  }
}
