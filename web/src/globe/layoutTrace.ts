import type { Map as MapLibreMap } from 'maplibre-gl'
import type { CardScene, ScreenCard } from './cardLayout'

/** What the score cards were laid out from, one frame of it. */
export interface LaidOutFrame {
  cards: ScreenCard[]
  scene: CardScene
}

/**
 * In dev runs only, the map and what the score cards were last laid out from, on `window.scoremap`,
 * so a script driving the page can turn the globe and replay the frames through the layout (see
 * docs/agents/card-layout-replay.md).
 */
interface LayoutTrace {
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

/** Puts the map on `window.scoremap`, in dev runs. */
export function traceLayouts(map: MapLibreMap): void {
  if (import.meta.env.DEV) window.scoremap = { map, frames: [] }
}

/** Keeps a frame the score cards were laid out from, in dev runs. */
export function traceLayout(frame: LaidOutFrame): void {
  const frames = import.meta.env.DEV ? window.scoremap?.frames : undefined
  if (!frames) return
  frames.push(frame)
  if (frames.length > framesKept) frames.shift()
}
