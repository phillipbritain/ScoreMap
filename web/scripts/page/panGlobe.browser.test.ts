import type { Map as MapLibreMap } from 'maplibre-gl'
import { afterEach, describe, expect, it } from 'vitest'
import { panGlobe } from './panGlobe.ts'

type Stage = 'waitingForGames' | 'drawing' | 'ready'

afterEach(() => {
  delete window.scoremap
})

/**
 * A globe, as `window.scoremap` holds it, that lays its cards out (keeps a frame) each time it's
 * panned, and is unsettled for a while after each jump of the camera. It notes what it was asked to do.
 */
function globe(stage: () => Stage) {
  let settled = true
  const asked: string[] = []
  const renders: (() => void)[] = []
  const frames: unknown[] = ['a frame from before the pan']
  const map = {
    once: (event: string, listener: () => void) => event === 'render' && renders.push(listener),
    jumpTo: ({ center, zoom }: { center: [number, number]; zoom: number }) => {
      asked.push(`jump to ${center} at ${zoom}, ${stage()}`)
      settled = false
      setTimeout(() => renders.splice(0).forEach((listener) => listener()), 50)
      setTimeout(() => (settled = true), 300)
    },
    panBy: ([x, y]: [number, number]) => {
      asked.push(`pan by ${x},${y}, ${settled ? 'settled' : 'moving'}`)
      frames.push(`after panning by ${x},${y}`)
    },
  }
  window.scoremap = { map: map as unknown as MapLibreMap, stage, settled: () => settled, frames }
  return { asked }
}

describe('panGlobe', () => {
  it('waits for the globe to be ready, turns to the camera, waits for it to settle, and gives the pan’s frames', async () => {
    let stage: Stage = 'waitingForGames'
    const { asked } = globe(() => stage)
    setTimeout(() => (stage = 'ready'), 300)
    const answer = await panGlobe({
      camera: { center: [8, 51.5], zoom: 5 },
      steps: [
        { by: [-4, 0], frames: 2 },
        { by: [0, 3], frames: 1 },
      ],
    })
    expect(asked).toEqual(['jump to 8,51.5 at 5, ready', 'pan by -4,0, settled', 'pan by -4,0, settled', 'pan by 0,3, settled'])
    expect(answer).toEqual({ frames: ['after panning by -4,0', 'after panning by -4,0', 'after panning by 0,3'] })
  })

  it('says what it’s still waiting for once its time is up, without panning, to be run again', async () => {
    const { asked } = globe(() => 'drawing')
    expect(await panGlobe({ camera: { center: [0, 0], zoom: 5 }, steps: [{ by: [1, 0], frames: 1 }] }, 200)).toEqual({
      waiting: 'the globe to be ready (window.scoremap.stage())',
    })
    expect(asked).toEqual([])
  })
})
