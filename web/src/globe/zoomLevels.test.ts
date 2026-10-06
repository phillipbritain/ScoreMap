import { describe, expect, it } from 'vitest'
import { furthestOutZoom, minZoom, pinLayout } from './zoomLevels'

describe('pinLayout', () => {
  it('shows small pins zoomed out further than a country', () => {
    expect(pinLayout(1.5).size).toBe('small')
  })

  it('shows score cards once a country fills the screen', () => {
    expect(pinLayout(2.9).size).toBe('small')
    expect(pinLayout(3).size).toBe('card')
    expect(pinLayout(7).size).toBe('card')
  })

  it('clusters score cards over a wider radius than small pins, since cards take more room', () => {
    expect(pinLayout(7).clusterRadius).toBeGreaterThan(pinLayout(1.5).clusterRadius)
  })

  it('clusters pins only when they would overlap: closer than a small pin or a card is wide', () => {
    expect(pinLayout(2).clusterRadius).toBe(18)
    expect(pinLayout(6).clusterRadius).toBe(106)
  })

  it("shrinks the radius past a whole zoom level, where MapLibre still shows that level's clusters", () => {
    // Halfway to the next level, pins are about 1.4 times as far apart on screen as when clustered.
    expect(pinLayout(6.5).clusterRadius).toBe(Math.round(106 / Math.SQRT2))
    expect(pinLayout(2.5).clusterRadius).toBe(Math.round(18 / Math.SQRT2))
    // In steps, rounded down, so it errs towards clustering and doesn't change every frame.
    expect(pinLayout(6.6).clusterRadius).toBe(pinLayout(6.5).clusterRadius)
    expect(pinLayout(6.99).clusterRadius).toBeGreaterThan(106 / 2)
  })
})

describe('furthestOutZoom', () => {
  it('is the minimum zoom at the equator, and lower towards the poles for the same size of globe on screen', () => {
    expect(furthestOutZoom(0)).toBe(minZoom)
    expect(furthestOutZoom(60)).toBeCloseTo(minZoom - 1)
    expect(furthestOutZoom(-60)).toBeCloseTo(minZoom - 1)
  })
})
