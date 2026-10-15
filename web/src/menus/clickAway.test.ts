import { describe, expect, it } from 'vitest'
import { isClickAway } from './clickAway'

describe('isClickAway', () => {
  const away = { x: 100, y: 100, away: true }

  it('closes a menu on a click away from it', () => {
    expect(isClickAway(away, { x: 102, y: 99, away: true })).toBe(true)
  })

  it('keeps it open while the globe is dragged', () => {
    expect(isClickAway(away, { x: 160, y: 100, away: true })).toBe(false)
  })

  it('keeps it open for a click in it, or one that went down or came up in it', () => {
    expect(isClickAway({ ...away, away: false }, { ...away, away: false })).toBe(false)
    expect(isClickAway({ ...away, away: false }, away)).toBe(false)
    expect(isClickAway(away, { ...away, away: false })).toBe(false)
  })

  it('keeps it open for a click with no press seen', () => {
    expect(isClickAway(null, away)).toBe(false)
  })
})
