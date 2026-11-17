import { describe, expect, it } from 'vitest'
import { thumbPlace } from './scrollThumb'

describe("the app's scrollbar", () => {
  it('shows nothing when everything fits', () => {
    expect(thumbPlace(0, 400, 400)).toBeNull()
    expect(thumbPlace(0, 400, 300)).toBeNull()
  })

  it('is as long as the share on show, at the top before scrolling', () => {
    expect(thumbPlace(0, 400, 1000)).toEqual({ top: 0, height: 160 })
  })

  it('reaches the foot of the area once scrolled to the end, measured from the top of what scrolls', () => {
    // Scrolled 600 of 600: the bar's foot at the area's foot, 600 + 400 down what scrolls.
    expect(thumbPlace(600, 400, 1000)).toEqual({ top: 840, height: 160 })
  })

  it('is halfway down its room when scrolled halfway', () => {
    expect(thumbPlace(300, 400, 1000)).toEqual({ top: 420, height: 160 })
  })

  it('stays long enough to see on a very long list', () => {
    expect(thumbPlace(0, 200, 100_000)?.height).toBe(24)
  })
})
