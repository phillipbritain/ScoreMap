import { describe, expect, it } from 'vitest'
import type { GameStatus } from '../games/game'
import { themeWith } from '../theme/testTheme'
import { gameColour } from './gameColour'
import { firstVisitSettings, hasColours, withLeagueColour, withoutColours, withSportColour } from './viewerSettings'

/** A theme whose statuses each have a colour of their own, unlike any a viewer picks below. */
const theme = themeWith((json) => {
  json.palette.live.main = '#ff0000'
  json.palette.upcoming.main = '#00ff00'
  json.palette.final.main = '#0000ff'
  json.palette.disrupted.main = '#808080'
})
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

  it("is the colour the viewer picked for the game's league, over its sport's", () => {
    const settings = withLeagueColour(withSportColour(firstVisitSettings, 'Football', '#123456'), 'NFL', '#abcdef')

    expect(gameColour(settings, nflGame('Live'), theme)).toBe('#abcdef')
    expect(gameColour(settings, { league: 'NCAA Football', sport: 'Football', status: 'Live' }, theme)).toBe('#123456')
  })

  it("goes back to its sport's colour when a league's colour is cleared, and to the theme's with neither", () => {
    const picked = withLeagueColour(withSportColour(firstVisitSettings, 'Football', '#123456'), 'NFL', '#abcdef')
    const leagueCleared = withLeagueColour(picked, 'NFL', null)
    const bothCleared = withSportColour(leagueCleared, 'Football', null)

    expect(gameColour(leagueCleared, nflGame('Live'), theme)).toBe('#123456')
    expect(gameColour(bothCleared, nflGame('Live'), theme)).toBe('#ff0000')
    expect(hasColours(bothCleared)).toBe(false)
  })

  it("is the league's colour with no colour for its sport, and always the Disrupted colour when Disrupted", () => {
    const settings = withLeagueColour(firstVisitSettings, 'NFL', '#abcdef')

    expect(gameColour(settings, nflGame('Final'), theme)).toBe('#abcdef')
    expect(gameColour(settings, nflGame('Disrupted'), theme)).toBe('#808080')
    expect(hasColours(settings)).toBe(true)
  })

  it("puts every game back in the theme's colours on \"Reset colours\", keeping the other settings", () => {
    const picked = withSportColour(
      withSportColour({ ...firstVisitSettings, liveOnly: true }, 'Football', '#123456'),
      'Basketball',
      '#abcdef',
    )
    const reset = withoutColours(withLeagueColour(picked, 'NFL', '#fedcba'))

    expect(gameColour(reset, nflGame('Live'), theme)).toBe('#ff0000')
    expect(gameColour(reset, { league: 'NBA', sport: 'Basketball', status: 'Live' }, theme)).toBe('#ff0000')
    expect(hasColours(reset)).toBe(false)
    expect(reset.liveOnly).toBe(true)
  })
})
