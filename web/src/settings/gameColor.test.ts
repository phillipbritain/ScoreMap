import { describe, expect, it } from 'vitest'
import type { GameStatus } from '../games/game'
import { themeWith } from '../theme/testTheme'
import { gameColor } from './gameColor'
import { firstVisitSettings, hasColors, withLeagueColor, withoutColors, withSportColor } from './viewerSettings'

/** A theme whose statuses each have a color of their own, unlike any a viewer picks below. */
const theme = themeWith((json) => {
  json.palette.live.main = '#ff0000'
  json.palette.upcoming.main = '#00ff00'
  json.palette.final.main = '#0000ff'
})
const nflGame = (status: GameStatus) => ({ league: 'NFL', sport: 'Football', status })

describe('gameColor', () => {
  it("is the theme's color for the game's status when the viewer has picked none", () => {
    expect(gameColor(firstVisitSettings, nflGame('Live'), theme)).toBe('#ff0000')
    expect(gameColor(firstVisitSettings, nflGame('Upcoming'), theme)).toBe('#00ff00')
    expect(gameColor(firstVisitSettings, nflGame('Final'), theme)).toBe('#0000ff')
  })

  it("is the color the viewer picked for the game's sport, whatever its status", () => {
    const settings = withSportColor(firstVisitSettings, 'Football', '#123456')

    expect(gameColor(settings, nflGame('Live'), theme)).toBe('#123456')
    expect(gameColor(settings, nflGame('Upcoming'), theme)).toBe('#123456')
    expect(gameColor(settings, nflGame('Final'), theme)).toBe('#123456')
  })

  it("leaves other sports' games in the theme's colors", () => {
    const settings = withSportColor(firstVisitSettings, 'Basketball', '#123456')

    expect(gameColor(settings, nflGame('Live'), theme)).toBe('#ff0000')
  })

  it("goes back to the theme's color when the sport's color is cleared, leaving other sports' colors", () => {
    const picked = withSportColor(withSportColor(firstVisitSettings, 'Football', '#123456'), 'Basketball', '#abcdef')
    const cleared = withSportColor(picked, 'Football', null)

    expect(gameColor(cleared, nflGame('Live'), theme)).toBe('#ff0000')
    expect(gameColor(cleared, { league: 'NBA', sport: 'Basketball', status: 'Live' }, theme)).toBe('#abcdef')
    expect(hasColors(cleared)).toBe(true)
  })

  it('changes a picked color when another is picked for the same sport', () => {
    const settings = withSportColor(withSportColor(firstVisitSettings, 'Football', '#123456'), 'Football', '#654321')

    expect(gameColor(settings, nflGame('Live'), theme)).toBe('#654321')
  })

  it("is the color the viewer picked for the game's league, over its sport's", () => {
    const settings = withLeagueColor(withSportColor(firstVisitSettings, 'Football', '#123456'), 'NFL', '#abcdef')

    expect(gameColor(settings, nflGame('Live'), theme)).toBe('#abcdef')
    expect(gameColor(settings, { league: 'NCAA Football', sport: 'Football', status: 'Live' }, theme)).toBe('#123456')
  })

  it("goes back to its sport's color when a league's color is cleared, and to the theme's with neither", () => {
    const picked = withLeagueColor(withSportColor(firstVisitSettings, 'Football', '#123456'), 'NFL', '#abcdef')
    const leagueCleared = withLeagueColor(picked, 'NFL', null)
    const bothCleared = withSportColor(leagueCleared, 'Football', null)

    expect(gameColor(leagueCleared, nflGame('Live'), theme)).toBe('#123456')
    expect(gameColor(bothCleared, nflGame('Live'), theme)).toBe('#ff0000')
    expect(hasColors(bothCleared)).toBe(false)
  })

  it("is the league's color with no color for its sport", () => {
    const settings = withLeagueColor(firstVisitSettings, 'NFL', '#abcdef')

    expect(gameColor(settings, nflGame('Final'), theme)).toBe('#abcdef')
    expect(hasColors(settings)).toBe(true)
  })

  it("puts every game back in the theme's colors on \"Reset colors\", keeping the other settings", () => {
    const picked = withSportColor(
      withSportColor({ ...firstVisitSettings, topEventsOnly: true }, 'Football', '#123456'),
      'Basketball',
      '#abcdef',
    )
    const reset = withoutColors(withLeagueColor(picked, 'NFL', '#fedcba'))

    expect(gameColor(reset, nflGame('Live'), theme)).toBe('#ff0000')
    expect(gameColor(reset, { league: 'NBA', sport: 'Basketball', status: 'Live' }, theme)).toBe('#ff0000')
    expect(hasColors(reset)).toBe(false)
    expect(reset.topEventsOnly).toBe(true)
  })
})
