import { describe, expect, it } from 'vitest'
import type { Game } from '../games/game'
import { scoreCard } from './scoreCard'

const arrowhead: Game = {
  id: '401',
  league: 'NFL',
  sport: 'American football',
  startTime: '2026-10-04T17:00:00+00:00',
  status: 'Live',
  delayed: false,
  disruption: null,
  endTime: null,
  home: { abbreviation: 'KC', fullName: 'Kansas City Chiefs', logoUrl: 'https://a.espncdn.com/kc.png', score: 21 },
  away: { abbreviation: 'BUF', fullName: 'Buffalo Bills', logoUrl: 'https://a.espncdn.com/buf.png', score: 17 },
  clock: '4:12',
  period: 3,
  venue: { name: 'Arrowhead', city: 'Kansas City', country: 'USA', latitude: 39.0489, longitude: -94.4839, timeZone: 'America/Chicago' },
  broadcasters: [],
  streamLinks: [],
}

describe('scoreCard', () => {
  it('shows both teams with logo, abbreviation and score, away first, plus the clock line', () => {
    expect(scoreCard(arrowhead)).toEqual({
      gameId: '401',
      status: 'Live',
      away: { abbreviation: 'BUF', logoUrl: 'https://a.espncdn.com/buf.png', score: '17' },
      home: { abbreviation: 'KC', logoUrl: 'https://a.espncdn.com/kc.png', score: '21' },
      clockLine: '4:12',
    })
  })

  it('leaves scores blank and shows no clock line before an Upcoming game starts', () => {
    const upcoming: Game = {
      ...arrowhead,
      status: 'Upcoming',
      clock: null,
      period: null,
      home: { ...arrowhead.home, score: null },
      away: { ...arrowhead.away, score: null },
    }

    expect(scoreCard(upcoming)).toMatchObject({
      status: 'Upcoming',
      away: { score: '' },
      home: { score: '' },
      clockLine: '',
    })
  })

  it('shows "Delayed" in place of the clock for a delayed game', () => {
    expect(scoreCard({ ...arrowhead, delayed: true }).clockLine).toBe('Delayed')
  })

  it("shows a Final game's final line in its sport's style", () => {
    expect(scoreCard({ ...arrowhead, status: 'Final', clock: 'Final/OT' }).clockLine).toBe('Final/OT')
  })

  it('shows which kind of disruption in place of the clock for a Disrupted game', () => {
    const suspended: Game = { ...arrowhead, status: 'Disrupted', disruption: 'Suspended', clock: null }

    expect(scoreCard(suspended)).toMatchObject({ status: 'Disrupted', clockLine: 'Suspended' })
  })
})
