import { describe, expect, it } from 'vitest'
import {
  cardRadius,
  cardZoom,
  centerLatitude,
  fittedZoomSettings,
  furthestOutZoom,
  hasCard,
  cityNamesFrom,
  maxZoom,
  minZoom,
  minZoomView,
  pinLayout,
  pinSize,
  unfittedZoom,
  zoomAt,
  zoomAtEquator,
  zoomForMapType,
  zoomSettings,
} from './zoomLevels'

// Pins and pin clusters kept 35 pixels apart, as the built-in theme's widest pin clusters are.
const spacing = 35

/** MapLibre's camera at this zoom, centered on the equator. */
const atEquator = (zoom: number) => ({ zoom, latitude: 0 })

describe('pinLayout', () => {
  it('shows small pins zoomed out further than a country, as far out as the globe goes', () => {
    expect(pinLayout(atEquator(minZoom), spacing, cardZoom).size).toBe('small')
    expect(pinLayout({ zoom: furthestOutZoom(60), latitude: 60 }, spacing, cardZoom).size).toBe('small')
  })

  it('shows score cards once a country fills the screen', () => {
    expect(pinLayout(atEquator(2.9), spacing, cardZoom).size).toBe('small')
    expect(pinLayout(atEquator(3), spacing, cardZoom).size).toBe('card')
    expect(pinLayout(atEquator(7), spacing, cardZoom).size).toBe('card')
  })

  it('clusters small pins closer than the spacing', () => {
    expect(pinLayout(atEquator(2), spacing, cardZoom).clusterRadius).toBe(35)
  })

  it("shrinks the radius past a whole zoom level, where MapLibre still shows that level's clusters", () => {
    // Halfway to the next level, pins are about 1.4 times as far apart on screen as when clustered.
    expect(pinLayout(atEquator(2.5), spacing, cardZoom).clusterRadius).toBe(Math.round(35 / Math.SQRT2))
    // In steps, rounded down, so it errs toward clustering and doesn't change every frame.
    expect(pinLayout(atEquator(2.6), spacing, cardZoom).clusterRadius).toBe(pinLayout(atEquator(2.5), spacing, cardZoom).clusterRadius)
    expect(pinLayout(atEquator(2.99), spacing, cardZoom).clusterRadius).toBeGreaterThan(35 / 2)
  })
})

describe('pinSize', () => {
  // MapLibre's globe's radius on screen, in pixels, at a zoom with the view centered at a latitude:
  // bigger away from the equator at the same zoom.
  const globeRadius = ({ zoom, latitude }: { zoom: number; latitude: number }) =>
    (512 * 2 ** zoom) / (2 * Math.PI) / Math.cos((latitude * Math.PI) / 180)
  const europe = 50

  it('gives the same answer wherever the globe is turned, for the same size of globe on screen', () => {
    for (const atEquatorZoom of [minZoom, cardZoom - 0.05, cardZoom, cardZoom + 0.05, 5]) {
      const sizes = [0, 30, europe, -60, 80].map((latitude) => {
        const camera = { zoom: zoomAt(latitude, atEquatorZoom), latitude }
        expect(globeRadius(camera)).toBeCloseTo(globeRadius(atEquator(atEquatorZoom)))
        return pinSize(camera, cardZoom)
      })
      expect(new Set(sizes).size, `at ${atEquatorZoom}`).toBe(1)
    }
  })

  it('keeps small pins when a globe zoomed out just short of cards is turned from Europe to the equator', () => {
    // Turning the globe keeps it the same size on screen, which raises MapLibre's zoom past the card zoom.
    const overEurope = { zoom: zoomAt(europe, cardZoom - 0.05), latitude: europe }
    const overEquator = { zoom: cardZoom - 0.05, latitude: 0 }
    expect(overEquator.zoom).toBeGreaterThan(overEurope.zoom + 0.5)
    expect(pinSize(overEurope, cardZoom)).toBe('small')
    expect(pinSize(overEquator, cardZoom)).toBe('small')
  })

  it('shows score cards only once zoomed in to the card zoom, at any latitude', () => {
    for (const latitude of [0, europe, -35]) {
      expect(pinSize({ zoom: zoomAt(latitude, cardZoom - 0.01), latitude }, cardZoom)).toBe('small')
      expect(pinSize({ zoom: zoomAt(latitude, cardZoom), latitude }, cardZoom)).toBe('card')
    }
  })

  it('clusters small pins by MapLibre’s own zoom, wherever the globe is turned', () => {
    expect(pinLayout({ zoom: 2.5, latitude: europe }, spacing, cardZoom).clusterRadius).toBe(pinLayout(atEquator(2.5), spacing, cardZoom).clusterRadius)
  })
})

describe('zoomAt and zoomAtEquator', () => {
  it('are the same at the equator', () => {
    expect(zoomAt(0, cardZoom)).toBe(cardZoom)
    expect(zoomAtEquator(atEquator(cardZoom))).toBe(cardZoom)
  })

  it('lower MapLibre’s zoom away from the equator, a level by 60°, and convert back', () => {
    expect(zoomAt(60, cardZoom)).toBeCloseTo(cardZoom - 1)
    expect(zoomAt(-60, cardZoom)).toBeCloseTo(cardZoom - 1)
    expect(zoomAtEquator({ zoom: cardZoom - 1, latitude: 60 })).toBeCloseTo(cardZoom)
    expect(zoomAtEquator({ zoom: zoomAt(37, 4.2), latitude: 37 })).toBeCloseTo(4.2)
  })
})

describe('cityNamesFrom', () => {
  it('names cities at every zoom when score cards show, as MapLibre takes a minimum zoom of 0 as none', () => {
    expect(cityNamesFrom('card')).toBe(0)
  })

  it('names none when small pins show, from past the furthest in', () => {
    expect(cityNamesFrom('small')).toBeGreaterThan(maxZoom)
  })
})

describe('centerLatitude', () => {
  const laptop = { height: 800, fov: 36.87 }

  it('is the place’s own latitude with the place in the middle of the view', () => {
    expect(centerLatitude(50, 0, cardZoom, laptop)).toBe(50)
  })

  it('lies south of a place lifted above the middle of the view, and north of one dropped below it', () => {
    expect(centerLatitude(50, -200, cardZoom, laptop)).toBeLessThan(50)
    expect(centerLatitude(50, 200, cardZoom, laptop)).toBeGreaterThan(50)
    expect(50 - centerLatitude(50, -200, cardZoom, laptop)).toBeCloseTo(centerLatitude(50, 200, cardZoom, laptop) - 50)
  })

  it('moves by about the globe’s degrees per pixel for a small lift, and by more toward the globe’s rim', () => {
    const degreesPerPixel = 360 / (512 * 2 ** cardZoom)
    expect(50 - centerLatitude(50, -1, cardZoom, laptop)).toBeCloseTo(degreesPerPixel, 4)
    expect(50 - centerLatitude(50, -300, cardZoom, laptop)).toBeGreaterThan(300 * degreesPerPixel)
  })

  it('moves by as many degrees at any latitude, for the same size of globe', () => {
    expect(50 - centerLatitude(50, -200, cardZoom, laptop)).toBeCloseTo(10 - centerLatitude(10, -200, cardZoom, laptop))
  })

  it('stays within the latitudes MapLibre centers the view at', () => {
    expect(centerLatitude(-80, -400, 2, laptop)).toBeGreaterThanOrEqual(-85.06)
  })
})

describe('furthestOutZoom', () => {
  it('is the minimum zoom at the equator, and lower toward the poles for the same size of globe on screen', () => {
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
    expect(pinLayout(atEquator(phone.minZoom), spacing, phone.cardZoom).size).toBe('small')
    expect(pinLayout(atEquator(phone.cardZoom), spacing, phone.cardZoom).size).toBe('card')
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

describe('zoomForMapType', () => {
  const limits = { minZoom: 2, startZoom: 4, maxZoom: 11, satelliteMaxZoom: 15, cardZoom: 3 }

  it('zooms in as far as the plain map goes on the plain map', () => {
    expect(zoomForMapType(limits, 'plain')).toEqual(limits)
  })

  it('zooms further in on the satellite map, the rest as on the plain map', () => {
    expect(zoomForMapType(limits, 'satellite')).toEqual({ ...limits, maxZoom: 15 })
  })

  it('lets the satellite map zoom in further than the plain map', () => {
    expect(zoomSettings.satelliteMaxZoom).toBeGreaterThan(zoomSettings.maxZoom)
  })
})

describe('hasCard', () => {
  const kansas = { longitude: -97, latitude: 39 }

  it('gives a card to a game within the card radius of the center of the view', () => {
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
