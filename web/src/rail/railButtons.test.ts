import { describe, expect, it } from 'vitest'
import { shownRailButtons } from './railButtons'

describe('shownRailButtons', () => {
  const names = (touch: boolean) => shownRailButtons(touch).map(({ name }) => name)

  it('keeps Home and leaves out the zoom buttons on a touchscreen', () => {
    expect(names(true)).toEqual(['Home', 'Leagues', 'Events', 'Display Settings', 'More'])
  })

  it('shows every button with a mouse', () => {
    expect(names(false)).toEqual(['Zoom in', 'Zoom out', 'Home', 'Leagues', 'Events', 'Display Settings', 'More'])
  })
})
