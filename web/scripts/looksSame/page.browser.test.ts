import type { Map as MapLibreMap } from 'maplibre-gl'
import { afterEach, describe, expect, it } from 'vitest'
import { pageStep } from './page.ts'

type Stage = 'waitingForGames' | 'drawing' | 'ready'

afterEach(() => {
  delete window.scoremap
  document.getElementById('looks-same')?.remove()
})

/**
 * A globe with these pins, as `window.scoremap` holds it, saying what it's asked to: how far it has
 * loaded and whether it's still, or, as a base from before #128 does, only whether it's ready, or, as a
 * base from before #112 does, neither. It notes what it said when its pins were counted.
 */
function globe(pins: number, says: { stage?: () => Stage; settled?: () => boolean; ready?: () => boolean } = {}) {
  const features = Array.from({ length: pins }, () => ({}))
  const counted: { stage?: Stage; ready?: boolean }[] = []
  const renders: (() => void)[] = []
  const map = {
    getSource: (id: string) =>
      id === 'pins' ? { getData: async () => (counted.push({ stage: says.stage?.(), ready: says.ready?.() }), { features }) } : undefined,
    once: (event: string, listener: () => void) => event === 'render' && renders.push(listener),
    jumpTo: () => setTimeout(() => renders.splice(0).forEach((listener) => listener()), 50),
  }
  window.scoremap = { map: map as unknown as MapLibreMap, ...says }
  return { counted, map }
}

describe('pageStep', () => {
  it('says a page that can’t say when it’s ready is too old, rather than guessing', async () => {
    globe(3)
    expect(await pageStep({ step: 'games' })).toEqual({ tooOld: true })
  })

  it('gives the games once the globe’s stage is ready', async () => {
    let stage: Stage = 'waitingForGames'
    const { counted } = globe(3, { stage: () => stage, settled: () => true })
    setTimeout(() => (stage = 'drawing'), 100)
    setTimeout(() => (stage = 'ready'), 300)
    expect(await pageStep({ step: 'games' })).toEqual({ games: 3 })
    expect(counted).toEqual([{ stage: 'ready' }])
  })

  it('waits for the globe to settle after each turn of the camera', async () => {
    let settled = true
    const { map } = globe(3, { stage: () => 'ready', settled: () => settled })
    const jumpTo = map.jumpTo
    const turns: boolean[] = []
    map.jumpTo = () => {
      // Each turn unsettles the globe for a while; the next turn finds it settled again.
      turns.push(settled)
      settled = false
      setTimeout(() => (settled = true), 300)
      return jumpTo()
    }
    expect(await pageStep({ step: 'show', camera: { center: [0, 51], zoom: 9 } })).toEqual({ shown: true })
    expect(turns).toEqual([true, true])
    expect(settled).toBe(true)
  })

  it('falls back to an older base’s ready(), from before the stage', async () => {
    let ready = false
    const { counted } = globe(3, { ready: () => ready })
    setTimeout(() => (ready = true), 300)
    expect(await pageStep({ step: 'games' })).toEqual({ games: 3 })
    expect(counted).toEqual([{ ready: true }])
  })
})
