import type { Map as MapLibreMap } from 'maplibre-gl'
import type { CardScene, ScreenCard } from './cardLayout'
import type { LoadingStage } from './globeMap'

/** What the score cards were laid out from, one frame of it. */
export interface LaidOutFrame {
  cards: ScreenCard[]
  scene: CardScene
}

/** What the globe tells scripts of how far it has loaded. */
interface GlobeLoading {
  /** How far the globe's initial load has got: wait for `'ready'` before the first look (see GlobeMap.stage). */
  stage: () => LoadingStage
  /** Whether the globe is still right now: wait for it after turning the camera (see GlobeMap.settled). */
  settled: () => boolean
}

/**
 * In dev runs only, the map, what the score cards were last laid out from, and how far the globe has
 * loaded, on `window.scoremap`, so a script driving the page can turn the globe and replay the frames
 * through the layout (see docs/agents/card-layout-replay.md), or wait to screenshot it.
 */
interface LayoutTrace extends GlobeLoading {
  map: MapLibreMap
  /** The latest frames, oldest first. */
  frames: LaidOutFrame[]
}

declare global {
  interface Window {
    scoremap?: LayoutTrace
  }
}

// About a few seconds of frames, a few megabytes at most.
const framesKept = 300

/** Puts the map on `window.scoremap`, with how far the globe has loaded, in dev runs. */
export function traceLayouts(map: MapLibreMap, loading: GlobeLoading): void {
  if (!import.meta.env.DEV) return
  window.scoremap = { map, frames: [], ...loading }
}

/** Keeps a frame the score cards were laid out from, in dev runs. */
export function traceLayout(frame: LaidOutFrame): void {
  const frames = import.meta.env.DEV ? window.scoremap?.frames : undefined
  if (!frames) return
  frames.push(frame)
  if (frames.length > framesKept) frames.shift()
}
