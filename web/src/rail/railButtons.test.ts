import { describe, expect, it } from 'vitest'
import { shownRailButtons } from './railButtons'

describe('shownRailButtons', () => {
  const names = (touch: boolean) => shownRailButtons(touch).map(({ name }) => name)

  it('leaves out the camera buttons on a touchscreen, which pinches to zoom', () => {
    expect(names(true)).toEqual(['Leagues', 'Display Settings', 'Map Type', 'Events', 'More'])
  })

  it('shows every button with a mouse', () => {
    expect(names(false)).toEqual(['Zoom in', 'Zoom out', 'Home', 'Leagues', 'Display Settings', 'Map Type', 'Events', 'More'])
  })
})
