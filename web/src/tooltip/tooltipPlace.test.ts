import { describe, expect, it } from 'vitest'
import { tooltipPlace } from './tooltipPlace'

const screen = { width: 800, height: 600 }
const tooltip = { width: 100, height: 30 }

describe('tooltipPlace', () => {
  it('centres a tooltip above what it’s for', () => {
    expect(tooltipPlace({ left: 300, top: 200, width: 40, height: 20 }, tooltip, screen)).toEqual({ left: 270, top: 162, side: 'above' })
  })

  it('puts it below where there’s no room above', () => {
    expect(tooltipPlace({ left: 300, top: 20, width: 40, height: 20 }, tooltip, screen)).toEqual({ left: 270, top: 48, side: 'below' })
  })

  it('keeps it on the screen at either side', () => {
    expect(tooltipPlace({ left: 0, top: 200, width: 20, height: 20 }, tooltip, screen).left).toBe(8)
    expect(tooltipPlace({ left: 780, top: 200, width: 20, height: 20 }, tooltip, screen).left).toBe(692)
  })

  it('puts it level on the left where asked, as for a rail button at the screen’s top right', () => {
    expect(tooltipPlace({ left: 752, top: 12, width: 36, height: 36 }, tooltip, screen, 'left')).toEqual({ left: 644, top: 15, side: 'left' })
  })

  it('keeps it on the screen top and bottom when on the left', () => {
    expect(tooltipPlace({ left: 752, top: 0, width: 36, height: 10 }, tooltip, screen, 'left').top).toBe(8)
  })

  it('goes above instead where there’s no room on the left', () => {
    expect(tooltipPlace({ left: 50, top: 200, width: 40, height: 20 }, tooltip, screen, 'left').side).toBe('above')
  })
})
