import { describe, expect, it } from 'vitest'
import { clearCenter } from './panelClearance'

// A panel across the bottom of an 800 × 600 globe, from y 460 down, inset from the sides.
const panel = { left: 100, top: 460, right: 700, bottom: 590 }

describe('clearCenter', () => {
  const globe = { left: 0, top: 0, right: 800, bottom: 600 }

  it('is the middle of the page with no panel open', () => {
    expect(clearCenter(globe, null)).toEqual({ x: 400, y: 300 })
  })

  it('is the middle of the page above the panel, across its whole width', () => {
    expect(clearCenter(globe, panel)).toEqual({ x: 400, y: 230 })
  })

  it('is the middle of the page when a panel leaves nothing above it', () => {
    expect(clearCenter(globe, { left: 0, top: 0, right: 800, bottom: 600 })).toEqual({ x: 400, y: 300 })
  })

  it('works on the page, wherever the globe is on it', () => {
    const lower = { left: 50, top: 100, right: 850, bottom: 700 }

    expect(clearCenter(lower, { left: 150, top: 560, right: 750, bottom: 690 })).toEqual({ x: 450, y: 330 })
  })
})
