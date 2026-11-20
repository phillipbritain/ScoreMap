import { describe, expect, it } from 'vitest'
import {
  firstVisitSettings,
  leaguesFilterGames,
  isLeagueOn,
  leaguesBySport,
  sportSwitch,
  withAllLeagues,
  withMapType,
  withLeague,
  withSport,
  withAllConferences,
  withConference,
} from './viewerSettings'

const nfl = { name: 'NFL', sport: 'Football', conferences: [] }
const ncaaf = { name: 'NCAA Football', sport: 'Football', conferences: [] }
const nba = { name: 'NBA', sport: 'Basketball', conferences: [] }
const mls = { name: 'MLS', sport: 'Soccer', conferences: [] }
const epl = { name: 'Premier League', sport: 'Soccer', conferences: [] }

describe('leaguesBySport', () => {
  it('groups leagues under their sport, keeping the configured order', () => {
    expect(leaguesBySport([nfl, ncaaf, nba, mls, epl])).toEqual([
      { sport: 'Football', leagues: [nfl, ncaaf] },
      { sport: 'Basketball', leagues: [nba] },
      { sport: 'Soccer', leagues: [mls, epl] },
    ])
  })
})

describe('league switch', () => {
  it('is on for every league on a first visit', () => {
    expect(isLeagueOn(firstVisitSettings, 'NFL')).toBe(true)
  })

  it('switches a league off and back on', () => {
    const off = withLeague(firstVisitSettings, 'NFL', false)
    expect(isLeagueOn(off, 'NFL')).toBe(false)
    expect(isLeagueOn(off, 'NBA')).toBe(true)

    expect(isLeagueOn(withLeague(off, 'NFL', true), 'NFL')).toBe(true)
  })

  it('leaves "Top Events" alone', () => {
    const settings = { ...firstVisitSettings, topEventsOnly: true }

    expect(withLeague(settings, 'NFL', false).topEventsOnly).toBe(true)
  })
})

describe('whole-sport switch', () => {
  const soccer = { sport: 'Soccer', leagues: [mls, epl] }

  it('is on when all its leagues are on', () => {
    expect(sportSwitch(firstVisitSettings, soccer)).toBe('on')
  })

  it('is mixed when only some of its leagues are on', () => {
    expect(sportSwitch(withLeague(firstVisitSettings, 'MLS', false), soccer)).toBe('mixed')
  })

  it('switches every league in the sport off, and leaves other sports alone', () => {
    const off = withSport(firstVisitSettings, soccer, false)

    expect(sportSwitch(off, soccer)).toBe('off')
    expect(isLeagueOn(off, 'NFL')).toBe(true)
  })

  it('switches every league in the sport back on, even from mixed', () => {
    const mixed = withLeague(firstVisitSettings, 'MLS', false)

    expect(sportSwitch(withSport(mixed, soccer, true), soccer)).toBe('on')
  })
})

describe('map type switch', () => {
  it('starts on the plain map', () => {
    expect(firstVisitSettings.mapType).toBe('plain')
  })

  it('switches to satellite and back, keeping the other settings', () => {
    const settings = { ...firstVisitSettings, hiddenLeagues: ['NBA'] }
    const satellite = withMapType(settings, 'satellite')

    expect(satellite).toEqual({ ...settings, mapType: 'satellite' })
    expect(withMapType(satellite, 'plain')).toEqual(settings)
  })
})

describe('all-leagues switch', () => {
  const leagues = [nfl, ncaaf, nba, mls, epl]

  it('switches every league off, keeping the other settings', () => {
    const settings = { ...firstVisitSettings, topEventsOnly: true }
    const off = withAllLeagues(settings, leagues, false)

    expect(leagues.filter((league) => isLeagueOn(off, league.name))).toEqual([])
    expect(off.topEventsOnly).toBe(true)
  })

  it('switches every league back on, including ones switched off one by one', () => {
    const someOff = withLeague(withSport(firstVisitSettings, { sport: 'Soccer', leagues: [mls, epl] }, false), 'NFL', false)
    const on = withAllLeagues(someOff, leagues, true)

    expect(leagues.every((league) => isLeagueOn(on, league.name))).toBe(true)
  })
})

describe('conferences', () => {
  it('chooses a conference in a league, keeping those already chosen', () => {
    const settings = withConference(withConference(firstVisitSettings, 'NCAA Football', 'SEC', true), 'NCAA Football', 'ACC', true)

    expect(settings.chosenConferences).toEqual({ 'NCAA Football': ['SEC', 'ACC'] })
  })

  it('keeps each league\'s choice apart', () => {
    const settings = withConference(withConference(firstVisitSettings, 'NCAA Football', 'SEC', true), "NCAA Men's Basketball", 'ACC', true)

    expect(settings.chosenConferences).toEqual({ 'NCAA Football': ['SEC'], "NCAA Men's Basketball": ['ACC'] })
  })

  it('unchooses a conference, and forgets the league once none is left', () => {
    const both = { ...firstVisitSettings, chosenConferences: { 'NCAA Football': ['SEC', 'ACC'] } }

    expect(withConference(both, 'NCAA Football', 'SEC', false).chosenConferences).toEqual({ 'NCAA Football': ['ACC'] })
    expect(withConference(withConference(both, 'NCAA Football', 'SEC', false), 'NCAA Football', 'ACC', false).chosenConferences).toEqual({})
  })

  it('goes back to all conferences in a league, leaving other leagues as they were', () => {
    const settings = { ...firstVisitSettings, chosenConferences: { 'NCAA Football': ['SEC'], "NCAA Men's Basketball": ['ACC'] } }

    expect(withAllConferences(settings, 'NCAA Football').chosenConferences).toEqual({ "NCAA Men's Basketball": ['ACC'] })
  })
})

describe('leaguesFilterGames', () => {
  const sec = { name: 'NCAA Football', sport: 'Football', conferences: ['SEC', 'ACC'] }
  const leagues = [nfl, sec, nba]

  it('is false with every league on and all its conferences', () => {
    expect(leaguesFilterGames(firstVisitSettings, leagues)).toBe(false)
  })

  it('is true with Top Events on', () => {
    expect(leaguesFilterGames({ ...firstVisitSettings, topEventsOnly: true }, leagues)).toBe(true)
  })

  it('is true with a league switched off', () => {
    expect(leaguesFilterGames(withLeague(firstVisitSettings, 'NBA', false), leagues)).toBe(true)
  })

  it('is true with a league narrowed to some of its conferences', () => {
    expect(leaguesFilterGames(withConference(firstVisitSettings, 'NCAA Football', 'SEC', true), leagues)).toBe(true)
  })

  it('is false again with the league back on all its conferences', () => {
    const narrowed = withConference(firstVisitSettings, 'NCAA Football', 'SEC', true)
    expect(leaguesFilterGames(withAllConferences(narrowed, 'NCAA Football'), leagues)).toBe(false)
  })

  it('ignores a switched-off league that is no longer in the list', () => {
    expect(leaguesFilterGames(withLeague(firstVisitSettings, 'XFL', false), leagues)).toBe(false)
  })

  it("ignores Only show live games, which isn't in Leagues", () => {
    expect(leaguesFilterGames({ ...firstVisitSettings, onlyLiveGames: true }, leagues)).toBe(false)
  })
})
