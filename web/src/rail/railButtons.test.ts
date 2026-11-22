import { describe, expect, it } from 'vitest'
import { shownRailButtons } from './railButtons'

describe('shownRailButtons', () => {
  const names = (touch: boolean) => shownRailButtons(touch).map(({ name }) => name)

  it('leaves out the camera buttons on a touchscreen, which pinches to zoom', () => {
    expect(names(true)).toEqual(['Leagues', 'Events', 'Orbit', 'Display Settings', 'More'])
  })

  it('shows every button with a mouse', () => {
    expect(names(false)).toEqual(['Zoom in', 'Zoom out', 'Home', 'Leagues', 'Events', 'Orbit', 'Display Settings', 'More'])
  })
})
