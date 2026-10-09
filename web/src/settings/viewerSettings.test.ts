import { describe, expect, it } from 'vitest'
import {
  firstVisitSettings,
  isLeagueOn,
  leaguesBySport,
  sportSwitch,
  withAllLeagues,
  withLeague,
  withSport,
} from './viewerSettings'

const nfl = { name: 'NFL', sport: 'American football' }
const ncaaf = { name: 'NCAA Football', sport: 'American football' }
const nba = { name: 'NBA', sport: 'Basketball' }
const mls = { name: 'MLS', sport: 'Soccer' }
const epl = { name: 'Premier League', sport: 'Soccer' }

describe('leaguesBySport', () => {
  it('groups leagues under their sport, keeping the configured order', () => {
    expect(leaguesBySport([nfl, ncaaf, nba, mls, epl])).toEqual([
      { sport: 'American football', leagues: [nfl, ncaaf] },
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

  it('leaves "Live only" alone', () => {
    const settings = { ...firstVisitSettings, liveOnly: true }

    expect(withLeague(settings, 'NFL', false).liveOnly).toBe(true)
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

describe('all-leagues switch', () => {
  const leagues = [nfl, ncaaf, nba, mls, epl]

  it('switches every league off, keeping the other settings', () => {
    const settings = { ...firstVisitSettings, liveOnly: true }
    const off = withAllLeagues(settings, leagues, false)

    expect(leagues.filter((league) => isLeagueOn(off, league.name))).toEqual([])
    expect(off.liveOnly).toBe(true)
  })

  it('switches every league back on, including ones switched off one by one', () => {
    const someOff = withLeague(withSport(firstVisitSettings, { sport: 'Soccer', leagues: [mls, epl] }, false), 'NFL', false)
    const on = withAllLeagues(someOff, leagues, true)

    expect(leagues.every((league) => isLeagueOn(on, league.name))).toBe(true)
  })
})
