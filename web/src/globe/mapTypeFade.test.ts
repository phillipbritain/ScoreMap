import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mapTypeFade, mapTypeFadeMs, mapTypeWaitMs, type MapTypeFadeMap } from './mapTypeFade'

/** A map that records what the fade does to it, and goes idle when told to. */
function fakeMap() {
  const steps: string[] = []
  let loaded: (() => void) | null = null
  const map: MapTypeFadeMap = {
    showBoth: () => steps.push('showBoth'),
    hideOld: () => steps.push('hideOld'),
    fadeImagery: (opacity, ms) => steps.push(`imagery ${opacity} over ${ms}`),
    onceLoaded: (then) => {
      loaded = then
      return () => {
        loaded = null
      }
    },
  }
  return { map, steps, load: () => loaded?.() }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('mapTypeFade', () => {
  it('to satellite: keeps the plain map until the imagery has loaded, fades the imagery in over it, then hides the plain map', () => {
    const fade = mapTypeFade()
    const { map, steps, load } = fakeMap()

    fade.start('satellite', map)
    expect(steps).toEqual(['imagery 0 over 0', 'showBoth'])
    expect(fade.running()).toBe(true)

    load()
    expect(steps.at(-1)).toBe(`imagery 1 over ${mapTypeFadeMs}`)
    expect(steps).not.toContain('hideOld')

    vi.advanceTimersByTime(mapTypeFadeMs)
    expect(steps.at(-1)).toBe('hideOld')
    expect(fade.running()).toBe(false)
  })

  it('to plain: shows the plain map under the imagery, fades the imagery out once it has loaded, then hides it', () => {
    const fade = mapTypeFade()
    const { map, steps, load } = fakeMap()

    fade.start('plain', map)
    expect(steps).toEqual(['showBoth'])

    load()
    expect(steps.at(-1)).toBe(`imagery 0 over ${mapTypeFadeMs}`)

    vi.advanceTimersByTime(mapTypeFadeMs)
    // Hidden, then made whole again for the next time the satellite map shows.
    expect(steps.slice(-2)).toEqual(['hideOld', 'imagery 1 over 0'])
    expect(fade.running()).toBe(false)
  })

  it("fades anyway once it has waited long enough for tiles that don't come", () => {
    const fade = mapTypeFade()
    const { map, steps } = fakeMap()

    fade.start('satellite', map)
    vi.advanceTimersByTime(mapTypeWaitMs - 1)
    expect(steps).toEqual(['imagery 0 over 0', 'showBoth'])

    vi.advanceTimersByTime(1)
    expect(steps.at(-1)).toBe(`imagery 1 over ${mapTypeFadeMs}`)
  })

  it('a switch during a fade finishes that one at once before starting its own', () => {
    const fade = mapTypeFade()
    const first = fakeMap()
    const second = fakeMap()

    fade.start('satellite', first.map)
    fade.start('plain', second.map)
    expect(first.steps.slice(-2)).toEqual(['imagery 1 over 0', 'hideOld'])
    expect(second.steps).toEqual(['showBoth'])

    // The first's wait no longer counts.
    first.load()
    vi.advanceTimersByTime(mapTypeWaitMs)
    expect(first.steps.filter((step) => step === 'hideOld')).toHaveLength(1)
  })

  it('stops, doing nothing more, once the globe is destroyed', () => {
    const fade = mapTypeFade()
    const { map, steps, load } = fakeMap()

    fade.start('satellite', map)
    fade.destroy()
    load()
    vi.advanceTimersByTime(mapTypeWaitMs + mapTypeFadeMs)
    expect(steps).toEqual(['imagery 0 over 0', 'showBoth'])
    expect(fade.running()).toBe(false)
  })
})
