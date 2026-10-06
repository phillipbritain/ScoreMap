import { describe, expect, it } from 'vitest'
import type { Game } from './game'
import { applyChange } from './gameStore'

function game(id: string, homeScore: number | null = null): Game {
  return {
    id,
    league: 'NFL',
    sport: 'American football',
    startTime: '2026-10-04T17:00:00+00:00',
    status: 'Live',
    delayed: false,
    disruption: null,
    endTime: null,
    home: { abbreviation: 'KC', fullName: 'Kansas City Chiefs', logoUrl: null, score: homeScore },
    away: { abbreviation: 'BUF', fullName: 'Buffalo Bills', logoUrl: null, score: homeScore },
    clock: null,
    period: null,
    venue: {
      name: null,
      city: 'Kansas City',
      country: 'USA',
      latitude: 39.0489,
      longitude: -94.4839,
      timeZone: 'America/Chicago',
    },
    broadcasters: [],
    streamLinks: [],
  }
}

describe('applyChange', () => {
  it('adds a game that was added', () => {
    const games = applyChange([game('1')], { kind: 'Added', game: game('2') })

    expect(games.map((g) => g.id)).toEqual(['1', '2'])
  })

  it('removes a game that was removed', () => {
    const games = applyChange([game('1'), game('2')], { kind: 'Removed', game: game('1') })

    expect(games.map((g) => g.id)).toEqual(['2'])
  })

  it.each(['ScoreChanged', 'Started', 'Finished', 'Updated'] as const)(
    'replaces the game in place when it is %s',
    (kind) => {
      const games = applyChange([game('1', 0), game('2', 0)], { kind, game: game('1', 7) })

      expect(games).toEqual([game('1', 7), game('2', 0)])
    },
  )

  it('adds a changed game it did not have, so a missed event cannot lose a pin', () => {
    const games = applyChange([], { kind: 'ScoreChanged', game: game('1', 7) })

    expect(games).toEqual([game('1', 7)])
  })

  it('does not duplicate a game added twice', () => {
    const games = applyChange([game('1', 0)], { kind: 'Added', game: game('1', 3) })

    expect(games).toEqual([game('1', 3)])
  })
})
