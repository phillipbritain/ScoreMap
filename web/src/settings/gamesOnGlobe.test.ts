import { describe, expect, it } from 'vitest'
import type { Game, GameStatus } from '../games/game'
import { gamesOnGlobe } from './gamesOnGlobe'
import { firstVisitSettings } from './viewerSettings'

// 10:00 AM Eastern on Sunday 15 November 2026.
const now = Date.parse('2026-11-15T15:00:00Z')
const eastern = 'America/New_York'
const minutes = 60_000

function game(id: string, status: GameStatus, startsIn: number, league = 'NFL'): Game {
  return {
    id,
    league,
    sport: 'Football',
    startTime: new Date(now + startsIn * minutes).toISOString(),
    status,
    delayed: false,
    endTime: null,
    contest: {
      kind: 'sides',
      home: { abbreviation: 'HOM', fullName: 'Home', logoUrl: null, score: null, rank: null, record: null, conference: null },
      away: { abbreviation: 'AWY', fullName: 'Away', logoUrl: null, score: null, rank: null, record: null, conference: null },
    },
    clock: null,
    period: null,
    hot: false,
    venue: { name: null, city: null, region: null, country: null, latitude: 0, longitude: 0, timeZone: null, photo: null, court: null },
    streamLinks: [],
    note: null,
    situation: null,
    keyEvents: [],
    topEvent: false,
    scoreline: null,
    espnUrl: null,
  }
}

const ids = (games: readonly Game[]) => games.map((g) => g.id)
const onGlobe = (games: Game[], settings = firstVisitSettings) => ids(gamesOnGlobe(games, settings, now, eastern))

describe('gamesOnGlobe', () => {
  it('fills a globe with few games on with an Upcoming game starting in 3 hours', () => {
    expect(onGlobe([game('live', 'Live', -60), game('kickoff', 'Upcoming', 180)])).toEqual(['live', 'kickoff'])
  })
  it('tops up to 12 games with the soonest-starting Upcoming games', () => {
    const live = Array.from({ length: 9 }, (_, i) => game(`live-${i}`, 'Live', -60))
    const later = game('4:25', 'Upcoming', 325)
    const soon = [game('1:00-a', 'Upcoming', 180), game('1:00-b', 'Upcoming', 180), game('2:00', 'Upcoming', 240)]

    expect(onGlobe([...live, later, ...soon])).toEqual([...ids(live), '1:00-a', '1:00-b', '2:00'])
  })

  it('shows no Upcoming game more than 30 minutes off once 12 games are on', () => {
    const live = Array.from({ length: 12 }, (_, i) => game(`live-${i}`, 'Live', -60))

    expect(onGlobe([...live, game('kickoff', 'Upcoming', 180)])).toEqual(ids(live))
  })

  it('always shows an Upcoming game starting within 30 minutes, and a Final game, as games on now', () => {
    const live = Array.from({ length: 12 }, (_, i) => game(`live-${i}`, 'Live', -60))
    const games = [...live, game('soon', 'Upcoming', 30), game('late', 'Upcoming', -5), game('finished', 'Final', -200)]

    expect(onGlobe(games)).toEqual(ids(games))
  })

  it('counts the games on now that the viewer\'s leagues show, not those it hides', () => {
    const hidden = Array.from({ length: 12 }, (_, i) => game(`nba-${i}`, 'Live', -60, 'NBA'))
    const settings = { ...firstVisitSettings, hiddenLeagues: ['NBA'] }

    expect(onGlobe([...hidden, game('kickoff', 'Upcoming', 180)], settings)).toEqual(['kickoff'])
  })

  it('fills in no game starting more than 6 hours off', () => {
    expect(onGlobe([game('evening', 'Upcoming', 6 * 60 + 1), game('afternoon', 'Upcoming', 6 * 60)])).toEqual(['afternoon'])
  })
  it("fills in no game starting on the viewer's next day, though within 6 hours", () => {
    // 9:00 PM Eastern: a game at 11:30 PM is today, one at 12:30 AM tomorrow.
    const evening = Date.parse('2026-11-16T02:00:00Z')
    const at = (id: string, inMinutes: number) => ({ ...game(id, 'Upcoming', 0), startTime: new Date(evening + inMinutes * minutes).toISOString() })

    expect(ids(gamesOnGlobe([at('tonight', 150), at('tomorrow', 210)], firstVisitSettings, evening, eastern))).toEqual(['tonight'])
    // In London it's already 2:00 AM on the 16th, so both are that day.
    expect(ids(gamesOnGlobe([at('tonight', 150), at('tomorrow', 210)], firstVisitSettings, evening, 'Europe/London'))).toEqual([
      'tonight',
      'tomorrow',
    ])
  })

  it('shows no Upcoming game at all with Only show live events on, but keeps Final games', () => {
    const settings = { ...firstVisitSettings, onlyLiveEvents: true }
    const games = [game('live', 'Live', -60), game('soon', 'Upcoming', 10), game('kickoff', 'Upcoming', 180), game('finished', 'Final', -200)]

    expect(onGlobe(games, settings)).toEqual(['live', 'finished'])
  })
})
