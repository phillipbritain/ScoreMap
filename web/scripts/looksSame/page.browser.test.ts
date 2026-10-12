import type { Map as MapLibreMap } from 'maplibre-gl'
import { afterEach, describe, expect, it } from 'vitest'
import { pageStep } from './page.ts'

afterEach(() => {
  delete window.scoremap
})

/** A globe with these pins, that a script can be told is ready, as `window.scoremap` holds it. */
function globe(pins: number, ready?: () => boolean): void {
  const features = Array.from({ length: pins }, () => ({}))
  const map = { getSource: (id: string) => (id === 'pins' ? { getData: async () => ({ features }) } : undefined) }
  window.scoremap = { map: map as unknown as MapLibreMap, ready }
}

describe('pageStep', () => {
  it('says a page that can’t say when it’s ready is too old, rather than guessing', async () => {
    globe(3)
    expect(await pageStep({ step: 'games' })).toEqual({ tooOld: true })
  })

  it('gives the games once the page says it’s ready', async () => {
    let settled = false
    globe(3, () => settled)
    setTimeout(() => (settled = true), 300)
    expect(await pageStep({ step: 'games' })).toEqual({ games: 3 })
  })
})
