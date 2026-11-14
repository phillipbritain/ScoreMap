import { describe, expect, it } from 'vitest'
import type { Game, GameVenue } from './game'
import { placedGames } from './placedGames'

function game(id: string, venue: Partial<GameVenue> = {}): Game {
  return {
    id,
    league: 'NFL',
    sport: 'Football',
    startTime: '2026-10-04T17:00:00+00:00',
    status: 'Live',
    delayed: false,
    endTime: null,
    contest: {
      kind: 'sides',
      home: { abbreviation: 'KC', fullName: 'Kansas City Chiefs', logoUrl: null, score: '21', rank: null, record: null, conference: null },
      away: { abbreviation: 'BUF', fullName: 'Buffalo Bills', logoUrl: null, score: '17', rank: null, record: null, conference: null },
    },
    clock: null,
    period: null,
    clutchTime: false,
    hot: false,
    venue: {
      name: 'GEHA Field at Arrowhead Stadium',
      city: 'Kansas City',
      region: 'Missouri',
      country: 'USA',
      latitude: 39.0489,
      longitude: -94.4839,
      timeZone: 'America/Chicago',
      photo: null,
      court: null,
      ...venue,
    },
    streamLinks: [],
    note: null,
    situation: null,
    lastScore: null,
    keyEvents: [],
    topEvent: false,
    scoreline: null,
    espnUrl: null,
  }
}

/** A game whose venue lookup is pending, or found nothing: the server sends no position. */
const unplaced = (id: string) => game(id, { latitude: null, longitude: null, timeZone: null })

describe('placedGames', () => {
  it('keeps the games whose venues are placed, in order', () => {
    const games = [game('A'), game('B', { latitude: 51.6043, longitude: -0.0664 })]

    expect(placedGames(games)).toEqual(games)
  })

  it('leaves out a game whose venue is not placed yet, or never will be', () => {
    expect(placedGames([game('A'), unplaced('B'), game('C')]).map((g) => g.id)).toEqual(['A', 'C'])
  })

  it('keeps a game placed at 0°, 0°, which is a real position', () => {
    expect(placedGames([game('A', { latitude: 0, longitude: 0 })]).map((g) => g.id)).toEqual(['A'])
  })

  it('keeps a game placed with no time zone known', () => {
    expect(placedGames([game('A', { timeZone: null })]).map((g) => g.id)).toEqual(['A'])
  })
})
