import { describe, expect, it } from 'vitest'
import type { Game } from './game'
import { gameLabel } from './gameLabel'

const arrowhead: Game = {
  id: '401',
  league: 'NFL',
  sport: 'Football',
  startTime: '2026-10-04T17:00:00+00:00',
  status: 'Live',
  delayed: false,
  disruption: null,
  endTime: null,
  contest: {
    kind: 'sides',
    home: { abbreviation: 'KC', fullName: 'Kansas City Chiefs', logoUrl: null, score: '21', rank: null, record: null },
    away: { abbreviation: 'BUF', fullName: 'Buffalo Bills', logoUrl: null, score: '17', rank: null, record: null },
  },
  clock: '4:12',
  period: 3,
  clutchTime: false,
  hot: false,
  venue: { name: 'Arrowhead', city: 'Kansas City', region: 'Missouri', country: 'USA', latitude: 39.0489, longitude: -94.4839, timeZone: 'America/Chicago', photo: null, court: null },
  broadcasters: [],
  streamLinks: [],
  note: null,
  attendance: null,
  odds: null,
  situation: null,
  lastScore: null,
  keyEvents: [],
  topEvent: false,
  scoreline: null,
}

describe('gameLabel', () => {
  it('names a two-sided game away team first, as its card shows it', () => {
    const label = gameLabel(arrowhead)

    expect(label.indexOf('Buffalo Bills')).toBeGreaterThanOrEqual(0)
    expect(label.indexOf('Buffalo Bills')).toBeLessThan(label.indexOf('Kansas City Chiefs'))
  })

  it('names a fight card by its note and the bout it shows, the bout on now', () => {
    const side = (name: string) => ({ name, shortName: name, flagUrl: null, record: null, winner: false })
    const main = {
      id: 'main',
      first: side('Jon Jones'),
      second: side('Stipe Miocic'),
      weightClass: 'Heavyweight',
      scheduledRounds: 5,
      status: 'Upcoming' as const,
      round: null,
      clock: null,
      method: null,
    }
    const coMain = { ...main, id: 'co-main', first: side('Charles Oliveira'), second: side('Michael Chandler'), status: 'Live' as const, round: 2 }
    const ufc309: Game = { ...arrowhead, sport: 'MMA', league: 'UFC', note: 'UFC 309: Jones vs. Miocic', clock: 'R2', contest: { kind: 'bouts', bouts: [main, coMain] } }

    const label = gameLabel(ufc309)

    expect(label).toContain('UFC 309: Jones vs. Miocic')
    expect(label).toContain('Charles Oliveira vs Michael Chandler')
    expect(label).not.toContain('Jon Jones')
  })

  it('names a field by its note, else its venue', () => {
    const talladega: Game = {
      ...arrowhead,
      sport: 'Racing',
      league: 'NASCAR Cup Series',
      note: 'NASCAR Cup Series at Talladega',
      clock: 'Lap 189',
      venue: { ...arrowhead.venue, name: 'Talladega Superspeedway' },
      contest: { kind: 'field', entries: [{ position: 1, name: 'Kyle Larson', shortName: 'K. Larson', flagUrl: null, score: null }] },
    }

    expect(gameLabel(talladega)).toContain('NASCAR Cup Series at Talladega')
    expect(gameLabel({ ...talladega, note: null })).toContain('Talladega Superspeedway')
  })

  it('names a tennis match home side first, as its card shows it', () => {
    const match: Game = {
      ...arrowhead,
      league: 'ATP',
      sport: 'Tennis',
      contest: {
        kind: 'sides',
        home: { abbreviation: 'SIN', fullName: 'Jannik Sinner', logoUrl: null, score: '1', rank: null, record: null },
        away: { abbreviation: 'ALC', fullName: 'Carlos Alcaraz', logoUrl: null, score: '0', rank: null, record: null },
      },
    }

    const label = gameLabel(match)

    expect(label.indexOf('Jannik Sinner')).toBeGreaterThanOrEqual(0)
    expect(label.indexOf('Jannik Sinner')).toBeLessThan(label.indexOf('Carlos Alcaraz'))
  })
})
