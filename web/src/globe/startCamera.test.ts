import { describe, expect, it } from 'vitest'
import type { Camera } from './camera'
import { startCamera } from './startCamera'

/** Checks the camera is centred inside a box drawn around a region on a map. */
function expectCentredIn(camera: Camera, box: { west: number; east: number; south: number; north: number }) {
  expect(camera.longitude).toBeGreaterThanOrEqual(box.west)
  expect(camera.longitude).toBeLessThanOrEqual(box.east)
  expect(camera.latitude).toBeGreaterThanOrEqual(box.south)
  expect(camera.latitude).toBeLessThanOrEqual(box.north)
}

const easternUs = { west: -90, east: -68, south: 30, north: 45 }

describe('startCamera', () => {
  it('reopens a returning visitor where they left the globe', () => {
    const left = { longitude: 139.7, latitude: 35.7, zoom: 4.2 }

    expect(startCamera(left, { timeZone: 'America/New_York', locale: 'en-US' })).toEqual(left)
  })

  it("centres a first visit on the viewer's region from their time zone", () => {
    expectCentredIn(startCamera(null, { timeZone: 'America/New_York', locale: 'en-US' }), easternUs)
  })

  it('zooms a first visit in closer than the whole-world view', () => {
    const regional = startCamera(null, { timeZone: 'Asia/Tokyo', locale: 'ja-JP' })
    const noHint = startCamera(null, { timeZone: 'UTC', locale: 'en' })

    expect(regional.zoom).toBeGreaterThan(noHint.zoom)
  })

  it('finds the region for time zones on other continents', () => {
    expectCentredIn(startCamera(null, { timeZone: 'Asia/Tokyo', locale: 'ja-JP' }), {
      west: 129,
      east: 146,
      south: 30,
      north: 45,
    })
    expectCentredIn(startCamera(null, { timeZone: 'Europe/London', locale: 'en-GB' }), {
      west: -8,
      east: 2,
      south: 50,
      north: 59,
    })
    expectCentredIn(startCamera(null, { timeZone: 'Australia/Sydney', locale: 'en-AU' }), {
      west: 140,
      east: 154,
      south: -38,
      north: -28,
    })
  })

  it("falls back to the continent in the time zone's name for less common zones", () => {
    expectCentredIn(startCamera(null, { timeZone: 'Europe/Vilnius', locale: 'lt-LT' }), {
      west: -10,
      east: 40,
      south: 36,
      north: 70,
    })
  })

  it("uses the locale's country when the time zone says nothing about place", () => {
    expectCentredIn(startCamera(null, { timeZone: 'UTC', locale: 'en-GB' }), {
      west: -8,
      east: 2,
      south: 50,
      north: 59,
    })
  })

  it('shows the whole world when neither time zone nor locale hints at a region', () => {
    expect(startCamera(null, { timeZone: 'UTC', locale: 'en' })).toEqual({ longitude: -40, latitude: 30, zoom: 1.5 })
    expect(startCamera(null, { timeZone: 'Etc/GMT+3', locale: 'not a locale!' }).zoom).toBe(1.5)
  })
})
