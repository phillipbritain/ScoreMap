import { describe, expect, it } from 'vitest'
import { firstVisitSettings } from '../settings/viewerSettings'
import { furthestOutZoom, maxZoom } from '../globe/zoomLevels'
import { canZoom, nextPopover, toggled } from './railControls'

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
    // Zoom 2 is the furthest out at the equator, but the globe goes further out this far north.
    expect(canZoom({ longitude: 0, latitude, zoom: 2 }).out).toBe(true)
  })

  it('counts a zoom a hair off a limit as at it', () => {
    expect(canZoom({ longitude: 0, latitude: 0, zoom: maxZoom - 0.001 }).in).toBe(false)
    expect(canZoom({ longitude: 0, latitude: 0, zoom: furthestOutZoom(0) + 0.001 }).out).toBe(false)
  })
})

describe('toggled', () => {
  it('switches Live only, and says so', () => {
    const { settings, toast } = toggled(firstVisitSettings, 'liveOnly')
    expect(settings).toEqual({ ...firstVisitSettings, liveOnly: true })
    expect(toast).toBe('Live only: on')
  })

  it('switches Show Disrupted games, and says so', () => {
    const { settings, toast } = toggled(firstVisitSettings, 'showDisrupted')
    expect(settings).toEqual({ ...firstVisitSettings, showDisrupted: false })
    expect(toast).toBe('Show Disrupted games: off')
  })
})

describe('nextPopover', () => {
  it('opens a popover from its button', () => {
    expect(nextPopover(null, { press: 'leagues' })).toBe('leagues')
  })

  it('closes a popover from its own button', () => {
    expect(nextPopover('colours', { press: 'colours' })).toBeNull()
  })

  it('opens one popover at a time: opening one closes the other', () => {
    expect(nextPopover('leagues', { press: 'colours' })).toBe('colours')
    expect(nextPopover('colours', { press: 'leagues' })).toBe('leagues')
  })

  it('closes on Escape or a click outside', () => {
    expect(nextPopover('leagues', 'escape')).toBeNull()
    expect(nextPopover('colours', 'outside')).toBeNull()
    expect(nextPopover(null, 'outside')).toBeNull()
  })
})
