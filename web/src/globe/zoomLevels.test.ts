import { describe, expect, it } from 'vitest'
import {
  cardRadius,
  centerLatitude,
  fieldOfView,
  fittedZoomSettings,
  furthestOutFill,
  furthestOutZoom,
  hasCard,
  minZoom,
  minZoomView,
  laptopView,
  pinClusterRadius,
  wholeGlobeZoom,
  zoomAt,
  zoomAtEquator,
  zoomForMapType,
  zoomSettings,
} from './zoomLevels'

// Pins and pin clusters kept 35 pixels apart, as the built-in theme's widest pin clusters are.
const spacing = 35

/** MapLibre's camera at this zoom, centered on the equator. */
const atEquator = (zoom: number) => ({ zoom, latitude: 0 })

// About one country on screen, a zoom to measure with.
const countryZoom = 3

describe('pinClusterRadius', () => {
  it('clusters small pins closer than the spacing', () => {
    expect(pinClusterRadius(2, spacing)).toBe(35)
  })

  it("shrinks the radius past a whole zoom level, where MapLibre still shows that level's clusters", () => {
    // Halfway to the next level, pins are about 1.4 times as far apart on screen as when clustered.
    expect(pinClusterRadius(2.5, spacing)).toBe(Math.round(35 / Math.SQRT2))
    // In steps, rounded down, so it errs toward clustering and doesn't change every frame.
    expect(pinClusterRadius(2.6, spacing)).toBe(pinClusterRadius(2.5, spacing))
    expect(pinClusterRadius(2.99, spacing)).toBeGreaterThan(35 / 2)
  })
})

describe('zoomAt and zoomAtEquator', () => {
  it('are the same at the equator', () => {
    expect(zoomAt(0, countryZoom)).toBe(countryZoom)
    expect(zoomAtEquator(atEquator(countryZoom))).toBe(countryZoom)
  })

  it('lower MapLibre’s zoom away from the equator, a level by 60°, and convert back', () => {
    expect(zoomAt(60, countryZoom)).toBeCloseTo(countryZoom - 1)
    expect(zoomAt(-60, countryZoom)).toBeCloseTo(countryZoom - 1)
    expect(zoomAtEquator({ zoom: countryZoom - 1, latitude: 60 })).toBeCloseTo(countryZoom)
    expect(zoomAtEquator({ zoom: zoomAt(37, 4.2), latitude: 37 })).toBeCloseTo(4.2)
  })
})

describe('centerLatitude', () => {
  const laptop = { height: 800, fov: 36.87 }

  it('is the place’s own latitude with the place in the middle of the view', () => {
    expect(centerLatitude(50, 0, countryZoom, laptop)).toBe(50)
  })

  it('lies south of a place lifted above the middle of the view, and north of one dropped below it', () => {
    expect(centerLatitude(50, -200, countryZoom, laptop)).toBeLessThan(50)
    expect(centerLatitude(50, 200, countryZoom, laptop)).toBeGreaterThan(50)
    expect(50 - centerLatitude(50, -200, countryZoom, laptop)).toBeCloseTo(centerLatitude(50, 200, countryZoom, laptop) - 50)
  })

  it('moves by about the globe’s degrees per pixel for a small lift, and by more toward the globe’s rim', () => {
    const degreesPerPixel = 360 / (512 * 2 ** countryZoom)
    expect(50 - centerLatitude(50, -1, countryZoom, laptop)).toBeCloseTo(degreesPerPixel, 4)
    expect(50 - centerLatitude(50, -300, countryZoom, laptop)).toBeGreaterThan(300 * degreesPerPixel)
  })

  it('moves by as many degrees at any latitude, for the same size of globe', () => {
    expect(50 - centerLatitude(50, -200, countryZoom, laptop)).toBeCloseTo(10 - centerLatitude(10, -200, countryZoom, laptop))
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

describe('wholeGlobeZoom', () => {
  // The globe's width on screen, in pixels, at a zoom in a view this tall: its rim as MapLibre's camera sees it.
  const seenAcross = (zoom: number, height: number) => {
    const camera = (0.5 / Math.tan((fieldOfView * Math.PI) / 360)) * height
    const radius = (512 * 2 ** zoom) / (2 * Math.PI)
    return 2 * camera * Math.tan(Math.asin(radius / (camera + radius)))
  }

  it('is the zoom at which the whole globe is that wide on screen', () => {
    expect(seenAcross(wholeGlobeZoom(312, 844), 844)).toBeCloseTo(312)
    expect(seenAcross(wholeGlobeZoom(640, 800), 800)).toBeCloseTo(640)
  })

  it('zooms further in for the same width in a shorter view, whose camera is nearer the globe', () => {
    expect(wholeGlobeZoom(400, 600)).toBeGreaterThan(wholeGlobeZoom(400, 1200))
  })
})

describe('fittedZoomSettings', () => {
  const laptop = fittedZoomSettings(zoomSettings, laptopView)
  const phone = fittedZoomSettings(zoomSettings, { width: 390, height: 844 })
  // The globe's size on screen, in pixels across, at a zoom (leaving aside the camera's perspective).
  const globeAcross = (zoom: number) => (512 * 2 ** zoom) / Math.PI
  // How much of the view's shorter side the globe fills at a zoom.
  const filling = (zoom: number, shorter: number) => globeAcross(zoom) / shorter

  it('is the app’s zoom settings for a laptop’s browser window', () => {
    expect(laptop).toEqual(zoomSettings)
  })

  it('zooms out until the whole globe fills part of the view’s shorter side, with space around it', () => {
    expect(furthestOutFill).toBeLessThan(1)
    expect(laptop.minZoom).toBe(wholeGlobeZoom(furthestOutFill * 800, 800))
    expect(phone.minZoom).toBe(wholeGlobeZoom(furthestOutFill * 390, 844))
    const monitor = fittedZoomSettings(zoomSettings, { width: 2560, height: 1440 })
    expect(monitor.minZoom).toBe(wholeGlobeZoom(furthestOutFill * 1440, 1440))
  })

  it('lets a phone zoom further out than a laptop', () => {
    expect(phone.minZoom).toBeLessThan(laptop.minZoom)
  })

  it('starts a phone, and takes it Home, as far out as a laptop for the size of its screen', () => {
    expect(filling(phone.startZoom, 390)).toBeCloseTo(filling(laptop.startZoom, minZoomView))
    expect(phone.startZoom).toBeGreaterThan(phone.minZoom)
  })

  it('keeps the start zoom as it is for a laptop-sized view or larger', () => {
    expect(fittedZoomSettings(zoomSettings, { width: 2560, height: 1440 }).startZoom).toBe(zoomSettings.startZoom)
  })

  it('leaves the furthest in as it is', () => {
    expect(phone.maxZoom).toBe(zoomSettings.maxZoom)
  })

  it('fits a phone the same turned either way, but for the camera’s height', () => {
    const turned = fittedZoomSettings(zoomSettings, { width: 844, height: 390 })
    expect(turned.startZoom).toBe(phone.startZoom)
    expect(turned.minZoom).toBe(wholeGlobeZoom(furthestOutFill * 390, 390))
  })

  it('fits a view with no size yet as a laptop’s', () => {
    expect(fittedZoomSettings(zoomSettings, { width: 0, height: 0 })).toEqual(zoomSettings)
  })
})

describe('zoomForMapType', () => {
  const limits = { minZoom: 2, startZoom: 4, maxZoom: 11, satelliteMaxZoom: 15 }

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
