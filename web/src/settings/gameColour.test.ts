import { describe, expect, it } from 'vitest'
import type { GameStatus } from '../games/game'
import builtIn from '../theme/builtInTheme.json'
import { resolveTheme, type Theme } from '../theme/theme'
import { gameColour, textOn } from './gameColour'
import { firstVisitSettings, hasColours, withoutColours, withSportColour } from './viewerSettings'

/** A theme whose statuses each have a colour of their own, unlike any a viewer picks below. */
function testTheme(): Theme {
  const json = structuredClone(builtIn) as Record<string, any>
  json.palette.live.main = '#ff0000'
  json.palette.upcoming.main = '#00ff00'
  json.palette.final.main = '#0000ff'
  json.palette.disrupted.main = '#808080'
  const result = resolveTheme(json)
  if (!result.ok) throw new Error(result.problems.join('\n'))
  return result.theme
}

const theme = testTheme()
const nflGame = (status: GameStatus) => ({ league: 'NFL', sport: 'Football', status })

describe('gameColour', () => {
  it("is the theme's colour for the game's status when the viewer has picked none", () => {
    expect(gameColour(firstVisitSettings, nflGame('Live'), theme)).toBe('#ff0000')
    expect(gameColour(firstVisitSettings, nflGame('Upcoming'), theme)).toBe('#00ff00')
    expect(gameColour(firstVisitSettings, nflGame('Final'), theme)).toBe('#0000ff')
  })

  it("is the colour the viewer picked for the game's sport, whatever its status", () => {
    const settings = withSportColour(firstVisitSettings, 'Football', '#123456')

    expect(gameColour(settings, nflGame('Live'), theme)).toBe('#123456')
    expect(gameColour(settings, nflGame('Upcoming'), theme)).toBe('#123456')
    expect(gameColour(settings, nflGame('Final'), theme)).toBe('#123456')
  })

  it("leaves other sports' games in the theme's colours", () => {
    const settings = withSportColour(firstVisitSettings, 'Basketball', '#123456')

    expect(gameColour(settings, nflGame('Live'), theme)).toBe('#ff0000')
  })

  it("is always the theme's Disrupted colour for a Disrupted game", () => {
    const settings = withSportColour(firstVisitSettings, 'Football', '#123456')

    expect(gameColour(settings, nflGame('Disrupted'), theme)).toBe('#808080')
  })

  it("goes back to the theme's colour when the sport's colour is cleared, leaving other sports' colours", () => {
    const picked = withSportColour(withSportColour(firstVisitSettings, 'Football', '#123456'), 'Basketball', '#abcdef')
    const cleared = withSportColour(picked, 'Football', null)

    expect(gameColour(cleared, nflGame('Live'), theme)).toBe('#ff0000')
    expect(gameColour(cleared, { league: 'NBA', sport: 'Basketball', status: 'Live' }, theme)).toBe('#abcdef')
    expect(hasColours(cleared)).toBe(true)
  })

  it('changes a picked colour when another is picked for the same sport', () => {
    const settings = withSportColour(withSportColour(firstVisitSettings, 'Football', '#123456'), 'Football', '#654321')

    expect(gameColour(settings, nflGame('Live'), theme)).toBe('#654321')
  })

  it('is written on in whichever of the theme\'s text colours, light or dark, stands out from it more', () => {
    const light = theme.palette.text.primary
    const dark = theme.palette.background.paper

    expect(textOn('#fff8c0', theme)).toBe(dark)
    expect(textOn('#ffff00', theme)).toBe(dark)
    expect(textOn('#200040', theme)).toBe(light)
    expect(textOn('#c00000', theme)).toBe(light)
  })

  it("puts every game back in the theme's colours on \"Reset colours\", keeping the other settings", () => {
    const picked = withSportColour(
      withSportColour({ ...firstVisitSettings, liveOnly: true }, 'Football', '#123456'),
      'Basketball',
      '#abcdef',
    )
    const reset = withoutColours(picked)

    expect(gameColour(reset, nflGame('Live'), theme)).toBe('#ff0000')
    expect(gameColour(reset, { league: 'NBA', sport: 'Basketball', status: 'Live' }, theme)).toBe('#ff0000')
    expect(hasColours(reset)).toBe(false)
    expect(reset.liveOnly).toBe(true)
  })
})
