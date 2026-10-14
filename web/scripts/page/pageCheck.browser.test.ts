import type { Map as MapLibreMap } from 'maplibre-gl'
import { afterEach, describe, expect, it } from 'vitest'
import { pageCheck } from './pageCheck.ts'

type Stage = 'waitingForGames' | 'drawing' | 'ready'

afterEach(() => {
  delete window.scoremap
  document.getElementById('page-check')?.remove()
})

/** A globe, as `window.scoremap` holds it, saying how far it has loaded and whether it's still. */
function globe(says: { stage: () => Stage; settled: () => boolean }) {
  window.scoremap = { map: {} as MapLibreMap, ...says }
}

describe('pageCheck', () => {
  it('waits for the globe’s stage to be ready', async () => {
    let stage: Stage = 'waitingForGames'
    globe({ stage: () => stage, settled: () => true })
    setTimeout(() => (stage = 'drawing'), 100)
    setTimeout(() => (stage = 'ready'), 300)
    expect(await pageCheck({ check: 'ready' })).toEqual({ ready: true })
    expect(stage).toBe('ready')
  })

  it('waits for the globe to settle', async () => {
    let settled = false
    globe({ stage: () => 'ready', settled: () => settled })
    setTimeout(() => (settled = true), 300)
    expect(await pageCheck({ check: 'settled' })).toEqual({ settled: true })
    expect(settled).toBe(true)
  })

  it('turns the camera once the globe is ready, and waits for it to settle after drawing the turn', async () => {
    let settled = true
    let draw = () => {}
    const turns: unknown[] = []
    const map = {
      once: (_event: string, listener: () => void) => (draw = listener),
      jumpTo: (camera: unknown) => {
        turns.push(camera)
        settled = false
        setTimeout(draw, 100)
        setTimeout(() => (settled = true), 300)
      },
    }
    window.scoremap = { map: map as unknown as MapLibreMap, stage: () => 'ready', settled: () => settled }
    expect(await pageCheck({ check: 'camera', center: [-74, 40.7], zoom: 6 })).toEqual({ camera: true })
    expect(turns).toEqual([{ center: [-74, 40.7], zoom: 6 }])
    expect(settled).toBe(true)
  })

  it('says what it’s still waiting for once its time is up, to be run again', async () => {
    globe({ stage: () => 'drawing', settled: () => false })
    expect(await pageCheck({ check: 'ready' }, 200)).toEqual({ waiting: 'the globe to be ready (window.scoremap.stage())' })
    expect(await pageCheck({ check: 'settled' }, 200)).toEqual({ waiting: 'the globe to settle (window.scoremap.settled())' })
  })

  it('waits for the globe to be there at all, on a page that isn’t a dev run', async () => {
    expect(await pageCheck({ check: 'ready' }, 200)).toEqual({ waiting: 'the globe (window.scoremap): is this a dev run?' })
  })

  it('reads a property of the first element a selector picks, its text by default', async () => {
    const panel = document.createElement('div')
    panel.id = 'page-check'
    panel.innerHTML = '<p class="score">3 – 1</p><img class="logo" width="40">'
    document.body.append(panel)
    expect(await pageCheck({ check: 'read', selector: '#page-check .score' })).toEqual({ value: '3 – 1' })
    expect(await pageCheck({ check: 'read', selector: '#page-check .logo', property: 'width' })).toEqual({ value: 40 })
    expect(await pageCheck({ check: 'read', selector: '#page-check .logo', property: 'rect' })).toMatchObject({ value: { width: 40 } })
    expect(await pageCheck({ check: 'read', selector: '.game-panel' })).toEqual({ missing: '.game-panel' })
  })
})
