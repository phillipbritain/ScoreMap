import { describe, expect, it } from 'vitest'
import { shouldSpin, spunLongitude } from './slowSpin'

const idle = { slowSpin: true, gameSelected: false, interacting: false }

describe('shouldSpin', () => {
  it('spins when slow spin is on, nothing is selected and the viewer is not interacting', () => {
    expect(shouldSpin(idle)).toBe(true)
  })

  it('never spins when slow spin is off', () => {
    expect(shouldSpin({ ...idle, slowSpin: false })).toBe(false)
  })

  it('pauses while a game panel is open', () => {
    expect(shouldSpin({ ...idle, gameSelected: true })).toBe(false)
  })

  it('pauses while the viewer drags or zooms', () => {
    expect(shouldSpin({ ...idle, interacting: true })).toBe(false)
  })
})

describe('spunLongitude', () => {
  it('turns the globe the way the Earth turns, a few degrees a second', () => {
    const after = spunLongitude(10, 1000)

    expect(after).toBeLessThan(10)
    expect(after).toBeGreaterThan(5)
  })

  it('takes minutes, not seconds, to go all the way round', () => {
    const degreesPerSecond = 10 - spunLongitude(10, 1000)

    expect(360 / degreesPerSecond).toBeGreaterThanOrEqual(120)
  })

  it('wraps around the date line', () => {
    const after = spunLongitude(-179, 1000)

    expect(after).toBeGreaterThan(170)
    expect(after).toBeLessThanOrEqual(180)
  })
})
