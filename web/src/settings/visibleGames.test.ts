import { describe, expect, it } from 'vitest'
import type { Game, GameStatus } from '../games/game'
import { firstVisitSettings } from './viewerSettings'
import { noPinsMessage, visibleGames } from './visibleGames'

function game(id: string, league: string, sport: string, status: GameStatus = 'Live'): Game {
  return {
    id,
    league,
    sport,
    startTime: '2026-10-04T17:00:00+00:00',
    status,
    delayed: false,
    disruption: null,
    endTime: null,
    home: { abbreviation: 'HOM', fullName: 'Home', logoUrl: null, score: null },
    away: { abbreviation: 'AWY', fullName: 'Away', logoUrl: null, score: null },
    clock: null,
    period: null,
    clutchTime: false,
    venue: { name: null, city: null, country: null, latitude: 0, longitude: 0, timeZone: null, photo: null },
    broadcasters: [],
    streamLinks: [],
  }
}

const nfl = game('nfl', 'NFL', 'Football')
const nba = game('nba', 'NBA', 'Basketball')
const epl = game('epl', 'Premier League', 'Soccer')

describe('visibleGames', () => {
  it('shows every game on a first visit', () => {
    expect(visibleGames([nfl, nba, epl], firstVisitSettings)).toEqual([nfl, nba, epl])
  })

  it('hides the games of a league switched off', () => {
    const settings = { ...firstVisitSettings, hiddenLeagues: ['NBA'] }

    expect(visibleGames([nfl, nba, epl], settings)).toEqual([nfl, epl])
  })

  it('hides Upcoming and Final games when "Live only" is on', () => {
    const upcoming = game('upcoming', 'NFL', 'Football', 'Upcoming')
    const final = game('final', 'NFL', 'Football', 'Final')
    const settings = { ...firstVisitSettings, liveOnly: true }

    expect(visibleGames([upcoming, nfl, final], settings)).toEqual([nfl])
  })

  it('shows Disrupted games on a first visit', () => {
    const postponed = game('postponed', 'NFL', 'Football', 'Disrupted')

    expect(visibleGames([nfl, postponed], firstVisitSettings)).toEqual([nfl, postponed])
  })

  it('hides Disrupted games when "Show Disrupted games" is off', () => {
    const postponed = game('postponed', 'NFL', 'Football', 'Disrupted')
    const upcoming = game('upcoming', 'NFL', 'Football', 'Upcoming')
    const settings = { ...firstVisitSettings, showDisrupted: false }

    expect(visibleGames([nfl, postponed, upcoming], settings)).toEqual([nfl, upcoming])
  })

  it('applies "Live only" and league switches together', () => {
    const liveNba = nba
    const upcomingNfl = game('upcoming', 'NFL', 'Football', 'Upcoming')
    const settings = { ...firstVisitSettings, hiddenLeagues: ['NBA'], liveOnly: true }

    expect(visibleGames([nfl, liveNba, upcomingNfl, epl], settings)).toEqual([nfl, epl])
  })
})

describe('noPinsMessage', () => {
  it('says nothing while some games are visible', () => {
    expect(noPinsMessage([nfl, nba], [nfl])).toBeNull()
  })

  it('says nothing before the first games arrive from the server', () => {
    expect(noPinsMessage(null, [])).toBeNull()
  })

  it('says so when games exist but none match the settings', () => {
    expect(noPinsMessage([nfl, nba], [])).toBe('No games match your settings.')
  })

  it('says so when there are no games at all', () => {
    expect(noPinsMessage([], [])).toBe('No games right now.')
  })
})
