import { describe, expect, it } from 'vitest'
import type { Camera } from './camera'
import { homeCamera, startCamera } from './startCamera'
import { furthestOutZoom, zoomSettings } from './zoomLevels'

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

  it('opens a first visit at the start zoom', () => {
    const tokyo = startCamera(null, { timeZone: 'Asia/Tokyo', locale: 'ja-JP' })
    expect(tokyo.zoom).toBe(furthestOutZoom(tokyo.latitude, zoomSettings.startZoom))
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

  it('looks over the Atlantic when neither time zone nor locale hints at a region', () => {
    expect(startCamera(null, { timeZone: 'UTC', locale: 'en' })).toEqual({
      longitude: -40,
      latitude: 30,
      zoom: furthestOutZoom(30, zoomSettings.startZoom),
    })
    expect(startCamera(null, { timeZone: 'Etc/GMT+3', locale: 'not a locale!' }).longitude).toBe(-40)
  })
})

describe('homeCamera', () => {
  it('is the view a first visit opens on, wherever the globe was left', () => {
    const place = { timeZone: 'Europe/London', locale: 'en-GB' }
    expect(homeCamera(place)).toEqual(startCamera(null, place))
  })

  it('opens at the start zoom, made up for the latitude as the furthest out is', () => {
    const home = homeCamera({ timeZone: 'America/New_York', locale: 'en-US' }, { minZoom: 2, startZoom: 4, maxZoom: 13 })
    expect(home.zoom).toBe(furthestOutZoom(home.latitude, 4))
  })

  it('never starts further out than the furthest out', () => {
    const home = homeCamera({ timeZone: 'America/New_York', locale: 'en-US' }, { minZoom: 3, startZoom: 1, maxZoom: 13 })
    expect(home.zoom).toBe(furthestOutZoom(home.latitude, 3))
  })

  it("is the viewer's region, at the start zoom", () => {
    const home = homeCamera({ timeZone: 'America/New_York', locale: 'en-US' })
    expectCentredIn(home, easternUs)
    expect(home.zoom).toBe(furthestOutZoom(home.latitude, zoomSettings.startZoom))
  })
})
