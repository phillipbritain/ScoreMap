// Turns the globe of a dev run a few pixels a frame, as a slow drag would, and gives back what the
// score cards were laid out from in each frame, as JSON. Run it in the page, e.g. with
// `agent-browser eval "$(cat web/scripts/panGlobe.js)" > trace.json`, then replay the frames with
// scripts/replayCardTrace.test.ts (see docs/agents/card-layout-replay.md). The camera and the pan
// are below; to change them without editing this file, set `window.panGlobe` to either or both first,
// in the same eval.
;(async () => {
  const { camera, pan } = {
    camera: { center: [-118.5, 34.0], zoom: 4.2 },
    pan: [
      { by: [4, 0], frames: 120 },
      { by: [0, -4], frames: 80 },
    ],
    ...window.panGlobe,
  }

  const { map, frames, stage, settled } = window.scoremap ?? {}
  if (!map) throw new Error('No window.scoremap: is this a dev run (npm run dev)?')
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))
  const until = async (done) => {
    while (!done()) await nextFrame()
  }
  await until(() => stage() === 'ready')
  // The cards settle where the camera starts, once the map has drawn the turn there.
  const drawn = new Promise((resolve) => map.once('render', resolve))
  map.jumpTo(camera)
  await drawn
  await until(settled)
  frames.length = 0
  for (const { by, frames: count } of pan) {
    for (let i = 0; i < count; i++) {
      map.panBy(by, { animate: false })
      await nextFrame()
    }
  }
  return JSON.stringify(frames)
})()
