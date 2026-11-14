import { describe, expect, it } from 'vitest'
import { furthestOutZoom, maxZoom, minZoom } from '../globe/zoomLevels'
import { canZoom, morePress, nextPopover } from './railControls'

describe('canZoom', () => {
  it('zooms either way between the limits', () => {
    expect(canZoom({ longitude: 0, latitude: 0, zoom: 5 })).toEqual({ in: true, out: true })
  })

  it('stops zooming in at the furthest in the globe goes', () => {
    expect(canZoom({ longitude: 0, latitude: 0, zoom: maxZoom }).in).toBe(false)
  })

  it('stops zooming out at the furthest out the globe goes at the view’s latitude', () => {
    const latitude = 60
    expect(canZoom({ longitude: 0, latitude, zoom: furthestOutZoom(latitude) }).out).toBe(false)
    // The furthest out is measured at the equator: the globe goes further out this far north.
    expect(canZoom({ longitude: 0, latitude, zoom: minZoom }).out).toBe(true)
  })

  it('stops at the zoom limits it is given', () => {
    const limits = { minZoom: 1, startZoom: 1, maxZoom: 8, satelliteMaxZoom: 10 }
    expect(canZoom({ longitude: 0, latitude: 0, zoom: 8 }, limits).in).toBe(false)
    expect(canZoom({ longitude: 0, latitude: 0, zoom: 1 }, limits).out).toBe(false)
    expect(canZoom({ longitude: 0, latitude: 0, zoom: maxZoom - 1 }, limits).in).toBe(false)
    expect(canZoom({ longitude: 0, latitude: 0, zoom: 1.5 }, limits).out).toBe(true)
  })

  it('counts a zoom a hair off a limit as at it', () => {
    expect(canZoom({ longitude: 0, latitude: 0, zoom: maxZoom - 0.001 }).in).toBe(false)
    expect(canZoom({ longitude: 0, latitude: 0, zoom: furthestOutZoom(0) + 0.001 }).out).toBe(false)
  })
})

describe('nextPopover', () => {
  it('opens a popover from its button', () => {
    expect(nextPopover(null, { press: 'leagues' })).toBe('leagues')
  })

  it('closes a popover from its own button', () => {
    expect(nextPopover('display', { press: 'display' })).toBeNull()
  })

  it('opens one popover at a time: opening one closes the other', () => {
    expect(nextPopover('leagues', { press: 'display' })).toBe('display')
    expect(nextPopover('display', { press: 'leagues' })).toBe('leagues')
    expect(nextPopover('leagues', { press: 'games' })).toBe('games')
  })

  it('closes on Escape or a click outside', () => {
    expect(nextPopover('leagues', 'escape')).toBeNull()
    expect(nextPopover('display', 'outside')).toBeNull()
    expect(nextPopover(null, 'outside')).toBeNull()
  })
})

describe('the More button', () => {
  it('opens More, closing any other popover', () => {
    expect(nextPopover(null, morePress(null))).toBe('more')
    expect(nextPopover('leagues', morePress('leagues'))).toBe('more')
  })

  it('opens the Feedback panel from More, in its place', () => {
    expect(nextPopover('more', { press: 'feedback' })).toBe('feedback')
  })

  it('closes More, or the Feedback panel opened from it', () => {
    expect(nextPopover('more', morePress('more'))).toBeNull()
    expect(nextPopover('feedback', morePress('feedback'))).toBeNull()
  })
})
