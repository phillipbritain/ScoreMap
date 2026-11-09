import { describe, expect, it } from 'vitest'
import { foreshortening, horizonFade, horizonFadeBand, type GlobeView } from './horizon'

// Looking straight down on 0°, 0° from about as far as zoom 3 on a laptop screen, where the horizon
// is about 72° away.
const view: GlobeView = { center: { longitude: 0, latitude: 0 }, cameraDistance: 3.3 }
const east = (degrees: number) => ({ longitude: degrees, latitude: 0 })

describe('foreshortening', () => {
  it('is 1 at the center of the view, 0 at the horizon and below 0 beyond it', () => {
    expect(foreshortening(view, view.center)).toBeCloseTo(1, 6)
    const horizon = (Math.acos(1 / view.cameraDistance) * 180) / Math.PI
    expect(foreshortening(view, east(horizon))).toBeCloseTo(0, 6)
    expect(foreshortening(view, east(horizon + 5))).toBeLessThan(0)
  })

  it('is the same whichever way from the center a point is', () => {
    const center = { longitude: -75, latitude: 45 }
    const from = { ...view, center }
    expect(foreshortening(from, { longitude: -75, latitude: 75 })).toBeCloseTo(foreshortening(from, { longitude: -75, latitude: 15 }), 6)
  })
})

describe('horizonFade', () => {
  it('shows whole what faces the viewer, and nothing near or past the horizon', () => {
    expect(horizonFade(view, view.center)).toBe(1)
    expect(horizonFade(view, east(30))).toBe(1)
    expect(horizonFade(view, east(60))).toBe(0)
    expect(horizonFade(view, east(120))).toBe(0)
  })

  it('fades out in between, as the globe turns it away', () => {
    const fades = [40, 42, 44, 46, 48, 50].map((degrees) => horizonFade(view, east(degrees)))
    for (let i = 1; i < fades.length; i++) expect(fades[i]).toBeLessThan(fades[i - 1])
    expect(fades.some((fade) => fade > 0 && fade < 1)).toBe(true)
  })

  it('fades from as foreshortened as the band says', () => {
    const { shown, gone } = horizonFadeBand
    const at = (target: number) => {
      let degrees = 0
      while (foreshortening(view, east(degrees)) > target) degrees += 0.01
      return east(degrees)
    }
    expect(horizonFade(view, at(shown))).toBeCloseTo(1, 1)
    expect(horizonFade(view, at(gone))).toBeCloseTo(0, 1)
  })

  it('comes nearer the center of the view zoomed in, where the horizon is nearer', () => {
    const zoomedIn: GlobeView = { ...view, cameraDistance: 1.6 }
    expect(horizonFade(view, east(35))).toBe(1)
    expect(horizonFade(zoomedIn, east(35))).toBe(0)
  })
})
