import { describe, expect, it } from 'vitest'
import type { Game, GameStatus } from '../games/game'
import { firstVisitSettings } from './viewerSettings'
import { noPinsMessage, visibleGames } from './visibleGames'

function game(
  id: string,
  league: string,
  sport: string,
  status: GameStatus = 'Live',
  topEvent = false,
  conferences: [string | null, string | null] = [null, null],
): Game {
  return {
    id,
    league,
    sport,
    startTime: '2026-10-04T17:00:00+00:00',
    status,
    delayed: false,
    endTime: null,
    contest: {
      kind: 'sides',
      home: { abbreviation: 'HOM', fullName: 'Home', logoUrl: null, score: null, rank: null, record: null, conference: conferences[0] },
      away: { abbreviation: 'AWY', fullName: 'Away', logoUrl: null, score: null, rank: null, record: null, conference: conferences[1] },
    },
    clock: null,
    period: null,
    clutchTime: false,
    hot: false,
    venue: { name: null, city: null, region: null, country: null, latitude: 0, longitude: 0, timeZone: null, photo: null, court: null },
    streamLinks: [],
    note: null,
    situation: null,
    lastScore: null,
    keyEvents: [],
    topEvent,
    scoreline: null,
    espnUrl: null,
  }
}

const nfl = game('nfl', 'NFL', 'Football')
const nba = game('nba', 'NBA', 'Basketball')
const epl = game('epl', 'Premier League', 'Soccer')

describe('visibleGames', () => {
  it('shows every game on a first visit, Upcoming, Live and Final', () => {
    const upcoming = game('upcoming', 'NFL', 'Football', 'Upcoming')
    const final = game('final', 'NBA', 'Basketball', 'Final')

    expect(visibleGames([nfl, upcoming, nba, final, epl], firstVisitSettings)).toEqual([nfl, upcoming, nba, final, epl])
  })

  it('hides the games of a league switched off', () => {
    const settings = { ...firstVisitSettings, hiddenLeagues: ['NBA'] }

    expect(visibleGames([nfl, nba, epl], settings)).toEqual([nfl, epl])
  })

  it('shows only top events, in every league, when Top Events is on', () => {
    const topNfl = game('top-nfl', 'NFL', 'Football', 'Live', true)
    const topNba = game('top-nba', 'NBA', 'Basketball', 'Live', true)
    const settings = { ...firstVisitSettings, topEventsOnly: true, hiddenLeagues: ['NBA'] }

    expect(visibleGames([nfl, topNfl, nba, topNba, epl], settings)).toEqual([topNfl, topNba])
  })

  describe('with conferences chosen in a league', () => {
    const secGame = game('sec', 'NCAA Football', 'Football', 'Live', false, ['SEC', 'SEC'])
    const accGame = game('acc', 'NCAA Football', 'Football', 'Live', false, ['ACC', 'ACC'])
    const secVsOutsider = game('sec-fcs', 'NCAA Football', 'Football', 'Live', false, [null, 'SEC'])
    const bigTenGame = game('b1g', 'NCAA Football', 'Football', 'Live', false, ['Big Ten', 'Big Ten'])
    const basketballGame = game('mbb', "NCAA Men's Basketball", 'Basketball', 'Live', false, ['Big East', 'Big East'])

    it("shows only the league's games with a team in a chosen conference, either side", () => {
      const settings = { ...firstVisitSettings, chosenConferences: { 'NCAA Football': ['SEC', 'ACC'] } }

      expect(visibleGames([secGame, accGame, secVsOutsider, bigTenGame], settings)).toEqual([secGame, accGame, secVsOutsider])
    })

    it("leaves other leagues' games alone", () => {
      const settings = { ...firstVisitSettings, chosenConferences: { 'NCAA Football': ['SEC'] } }

      expect(visibleGames([bigTenGame, basketballGame, nfl], settings)).toEqual([basketballGame, nfl])
    })

    it('shows every game in a league with no conferences chosen', () => {
      const settings = { ...firstVisitSettings, chosenConferences: { 'NCAA Football': [] } }

      expect(visibleGames([secGame, bigTenGame], settings)).toEqual([secGame, bigTenGame])
    })

    it('hides the league altogether when it is switched off', () => {
      const settings = { ...firstVisitSettings, hiddenLeagues: ['NCAA Football'], chosenConferences: { 'NCAA Football': ['SEC'] } }

      expect(visibleGames([secGame, nfl], settings)).toEqual([nfl])
    })

    it('ignores them on Top Events', () => {
      const topBigTen = game('top-b1g', 'NCAA Football', 'Football', 'Live', true, ['Big Ten', 'Big Ten'])
      const settings = { ...firstVisitSettings, topEventsOnly: true, chosenConferences: { 'NCAA Football': ['SEC'] } }

      expect(visibleGames([secGame, topBigTen], settings)).toEqual([topBigTen])
    })
  })

})

describe('noPinsMessage', () => {
  it('says nothing while some games are visible', () => {
    expect(noPinsMessage([nfl, nba], [nfl], firstVisitSettings)).toBeNull()
  })

  it('says nothing before the first games arrive from the server', () => {
    expect(noPinsMessage(null, [], firstVisitSettings)).toBeNull()
  })

  it('says so when games exist but none match the settings', () => {
    expect(noPinsMessage([nfl, nba], [], firstVisitSettings)).toBe('No games match your settings.')
  })

  it('says there are no top events when Top Events is on and ESPN lists none of the games', () => {
    expect(noPinsMessage([nfl, nba], [], { ...firstVisitSettings, topEventsOnly: true })).toBe('No top events right now.')
  })

  it('says so when there are no games at all', () => {
    expect(noPinsMessage([], [], firstVisitSettings)).toBe('No games right now.')
  })
})
