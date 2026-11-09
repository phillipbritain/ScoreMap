import { describe, expect, it } from 'vitest'
import { cardRadius, cardZoom, fittedZoomSettings, furthestOutZoom, hasCard, minZoom, minZoomView, pinLayout, unfittedZoom, zoomSettings } from './zoomLevels'

// Pins and pin clusters kept 35 pixels apart, as the built-in theme's widest pin clusters are.
const spacing = 35

describe('pinLayout', () => {
  it('shows small pins zoomed out further than a country, as far out as the globe goes', () => {
    expect(pinLayout(minZoom, spacing, cardZoom).size).toBe('small')
    expect(pinLayout(furthestOutZoom(60), spacing, cardZoom).size).toBe('small')
  })

  it('shows score cards once a country fills the screen', () => {
    expect(pinLayout(2.9, spacing, cardZoom).size).toBe('small')
    expect(pinLayout(3, spacing, cardZoom).size).toBe('card')
    expect(pinLayout(7, spacing, cardZoom).size).toBe('card')
  })

  it('clusters small pins closer than the spacing', () => {
    expect(pinLayout(2, spacing, cardZoom).clusterRadius).toBe(35)
  })

  it("shrinks the radius past a whole zoom level, where MapLibre still shows that level's clusters", () => {
    // Halfway to the next level, pins are about 1.4 times as far apart on screen as when clustered.
    expect(pinLayout(2.5, spacing, cardZoom).clusterRadius).toBe(Math.round(35 / Math.SQRT2))
    // In steps, rounded down, so it errs towards clustering and doesn't change every frame.
    expect(pinLayout(2.6, spacing, cardZoom).clusterRadius).toBe(pinLayout(2.5, spacing, cardZoom).clusterRadius)
    expect(pinLayout(2.99, spacing, cardZoom).clusterRadius).toBeGreaterThan(35 / 2)
  })
})

describe('furthestOutZoom', () => {
  it('is the minimum zoom at the equator, and lower towards the poles for the same size of globe on screen', () => {
    expect(furthestOutZoom(0)).toBe(minZoom)
    expect(furthestOutZoom(60)).toBeCloseTo(minZoom - 1)
    expect(furthestOutZoom(-60)).toBeCloseTo(minZoom - 1)
  })
})

describe('fittedZoomSettings', () => {
  // The globe's size on screen, in pixels across, at a zoom.
  const globeAcross = (zoom: number) => (512 * 2 ** zoom) / Math.PI
  const laptop = fittedZoomSettings(zoomSettings, { width: 1440, height: minZoomView })
  const phone = fittedZoomSettings(zoomSettings, { width: 390, height: 844 })
  // How much of the view's shorter side the globe fills at a zoom.
  const filling = (zoom: number, shorter: number) => globeAcross(zoom) / shorter

  it('keeps the settings and card zoom as they are for a laptop-sized view or larger', () => {
    expect(laptop).toEqual(unfittedZoom)
    expect(fittedZoomSettings(zoomSettings, { width: 2560, height: 1440 })).toEqual(unfittedZoom)
    expect(unfittedZoom).toEqual({ ...zoomSettings, cardZoom })
  })

  it('lets a phone zoom further out, until the globe fills it as it fills a laptop', () => {
    expect(phone.minZoom).toBeLessThan(minZoom)
    expect(filling(phone.minZoom, 390)).toBeCloseTo(filling(laptop.minZoom, minZoomView))
  })

  it('shows score cards on a phone from further out, with the globe as big on screen as on a laptop', () => {
    expect(phone.cardZoom).toBeLessThan(cardZoom)
    expect(filling(phone.cardZoom, 390)).toBeCloseTo(filling(laptop.cardZoom, minZoomView))
    // Still just past the furthest out, so small pins and pin clusters show zoomed fully out.
    expect(pinLayout(phone.minZoom, spacing, phone.cardZoom).size).toBe('small')
    expect(pinLayout(phone.cardZoom, spacing, phone.cardZoom).size).toBe('card')
    expect(phone.cardZoom - phone.minZoom).toBeCloseTo(laptop.cardZoom - laptop.minZoom)
  })

  it('starts a phone, and takes it Home, as far out as a laptop for the size of its screen', () => {
    expect(filling(phone.startZoom, 390)).toBeCloseTo(filling(laptop.startZoom, minZoomView))
    expect(phone.startZoom).toBeGreaterThan(phone.cardZoom)
  })

  it('leaves the furthest in as it is', () => {
    expect(phone.maxZoom).toBe(zoomSettings.maxZoom)
  })

  it('fits a phone the same turned either way', () => {
    expect(fittedZoomSettings(zoomSettings, { width: 844, height: 390 })).toEqual(phone)
  })

  it('leaves a view with no size yet alone', () => {
    expect(fittedZoomSettings(zoomSettings, { width: 0, height: 0 })).toEqual(unfittedZoom)
  })
})

describe('hasCard', () => {
  const kansas = { longitude: -97, latitude: 39 }

  it('gives a card to a game within the card radius of the centre of the view', () => {
    expect(hasCard(kansas, kansas)).toBe(true)
    expect(hasCard(kansas, { longitude: -74, latitude: 40.7 })).toBe(true) // New York
    expect(hasCard(kansas, { longitude: -122.3, latitude: 47.6 })).toBe(true) // Seattle
  })

  it('leaves a game farther out as a small pin', () => {
    expect(hasCard(kansas, { longitude: -0.1, latitude: 51.5 })).toBe(false) // London
    expect(hasCard(kansas, { longitude: -157.9, latitude: 21.3 })).toBe(false) // Honolulu
  })

  it('measures the radius along the globe, the same in every direction', () => {
    const equator = { longitude: 0, latitude: 0 }
    expect(hasCard(equator, { longitude: cardRadius, latitude: 0 })).toBe(true)
    expect(hasCard(equator, { longitude: 0, latitude: -cardRadius })).toBe(true)
    expect(hasCard(equator, { longitude: cardRadius + 0.5, latitude: 0 })).toBe(false)
    expect(hasCard(equator, { longitude: 0, latitude: cardRadius + 0.5 })).toBe(false)
  })
})
