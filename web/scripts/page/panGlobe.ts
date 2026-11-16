import '../scoremapWindow.ts'

/** Where the camera starts and how the globe is panned from there, a few pixels a frame, as a slow drag would. */
export interface Pan {
  camera: { center: [longitude: number, latitude: number]; zoom: number }
  steps: { by: [x: number, y: number]; frames: number }[]
}

/** How many frames the page keeps (`framesKept` in src/globe/layoutTrace.ts): a longer pan loses its start. */
export const framesKept = 300

/** Over Los Angeles, panned east then north. */
export const defaultPan: Pan = {
  camera: { center: [-118.5, 34.0], zoom: 4.2 },
  steps: [
    { by: [4, 0], frames: 120 },
    { by: [0, -4], frames: 80 },
  ],
}

/**
 * Pans a dev run's globe (sent to the page as its source text, so it's self-contained) and gives
 * back what the score cards were laid out from in each frame of the pan, for
 * scripts/replayCardTrace.test.ts. It waits for the globe to be ready, turns to the camera and waits
 * for the cards to settle there first.
 *
 * agent-browser gives up on a script after 30 seconds, so the waits take at most `waitMs` (20
 * seconds), then it says what it's waiting for without panning; it can be run again. The pan itself
 * takes a frame a step.
 */
export async function panGlobe({ camera, steps }: Pan, waitMs = 20_000): Promise<{ frames: unknown[] } | { waiting: string }> {
  const end = Date.now() + waitMs
  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  const until = async (done: () => boolean, what: string) => {
    while (!done()) {
      if (Date.now() > end) return what
      await new Promise<void>((resolve) => setTimeout(resolve, 100))
    }
  }

  const noGlobe = await until(() => !!window.scoremap?.frames, 'the globe (window.scoremap): is this a dev run?')
  if (noGlobe) return { waiting: noGlobe }
  const { map, frames, stage, settled } = window.scoremap! as Required<NonNullable<Window['scoremap']>>
  const notReady = await until(() => stage() === 'ready', 'the globe to be ready (window.scoremap.stage())')
  if (notReady) return { waiting: notReady }
  // The cards settle where the camera starts, once the map has drawn the turn there.
  let drawn = false
  map.once('render', () => (drawn = true))
  map.jumpTo(camera)
  const unsettled =
    (await until(() => drawn, 'the map to draw the turn')) ?? (await until(settled, 'the globe to settle (window.scoremap.settled())'))
  if (unsettled) return { waiting: unsettled }
  frames.length = 0
  for (const { by, frames: count } of steps) {
    for (let i = 0; i < count; i++) {
      map.panBy(by, { animate: false })
      await nextFrame()
    }
  }
  return { frames: [...frames] }
}
