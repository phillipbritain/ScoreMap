import type { Map as MapLibreMap } from 'maplibre-gl'
import type { CardScene, ScreenCard } from './cardLayout'

/** What the score cards were laid out from, one frame of it. */
export interface LaidOutFrame {
  cards: ScreenCard[]
  scene: CardScene
}

/**
 * In dev runs only, the map, what the score cards were last laid out from, and whether the page is
 * ready, on `window.scoremap`, so a script driving the page can turn the globe and replay the frames
 * through the layout (see docs/agents/card-layout-replay.md), or wait to screenshot it.
 */
interface LayoutTrace {
  map: MapLibreMap
  /** The latest frames, oldest first. */
  frames: LaidOutFrame[]
  /**
   * Whether every game is on screen and still: the server's first snapshot of games has reached the
   * globe, and the globe has settled (see GlobeMap.settled).
   */
  ready: () => boolean
}

declare global {
  interface Window {
    scoremap?: LayoutTrace
  }
}

// About a few seconds of frames, a few megabytes at most.
const framesKept = 300

let snapshotShown = false

/** Puts the map on `window.scoremap`, with whether the globe has settled, in dev runs. */
export function traceLayouts(map: MapLibreMap, settled: () => boolean): void {
  if (import.meta.env.DEV) window.scoremap = { map, frames: [], ready: () => snapshotShown && settled() }
}

/** Notes that the server's first snapshot of games has been handed to the globe, in dev runs. */
export function traceSnapshotShown(): void {
  if (import.meta.env.DEV) snapshotShown = true
}

/** Keeps a frame the score cards were laid out from, in dev runs. */
export function traceLayout(frame: LaidOutFrame): void {
  const frames = import.meta.env.DEV ? window.scoremap?.frames : undefined
  if (!frames) return
  frames.push(frame)
  if (frames.length > framesKept) frames.shift()
}
