// Turns the globe of a dev run a few pixels a frame, as a slow drag would, and gives back what the
// score cards were laid out from in each frame, as JSON. Run it in the page, e.g. with
// `agent-browser eval "$(cat web/scripts/panGlobe.js)" > trace.json`, then replay the frames with
// scripts/replayCardTrace.test.ts (see docs/agents/card-layout-replay.md). Edit the camera and the
// pan below to suit what you're looking at.
;(async () => {
  const camera = { center: [-118.5, 34.0], zoom: 4.2 }
  const pan = [
    { by: [4, 0], frames: 120 },
    { by: [0, -4], frames: 80 },
  ]

  const { map, frames } = window.scoremap ?? {}
  if (!map) throw new Error('No window.scoremap: is this a dev run (npm run dev)?')
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))
  map.jumpTo(camera)
  // Long enough for the cards to settle where the camera starts.
  for (let i = 0; i < 30; i++) await nextFrame()
  frames.length = 0
  for (const { by, frames: count } of pan) {
    for (let i = 0; i < count; i++) {
      map.panBy(by, { animate: false })
      await nextFrame()
    }
  }
  return JSON.stringify(frames)
})()
