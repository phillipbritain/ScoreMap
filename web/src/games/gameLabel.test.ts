import { describe, expect, it } from 'vitest'
import type { Game } from './game'
import { gameLabel, gameMatchup, matchesSearch } from './gameLabel'

const arrowhead: Game = {
  id: '401',
  league: 'NFL',
  sport: 'Football',
  startTime: '2026-10-04T17:00:00+00:00',
  status: 'Live',
  delayed: false,
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
  situation: null,
  lastScore: null,
  keyEvents: [],
  topEvent: false,
  scoreline: null,
  espnUrl: null,
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

describe('gameMatchup', () => {
  it('names the two sides, top first, with no score or clock', () => {
    expect(gameMatchup(arrowhead)).toBe('Buffalo Bills vs Kansas City Chiefs')
  })

  it('names a fight card by its event, else the bout it shows', () => {
    const side = (name: string) => ({ name, shortName: name, flagUrl: null, record: null, winner: false })
    const bout = { id: 'b', first: side('Jon Jones'), second: side('Stipe Miocic'), weightClass: null, scheduledRounds: 5, status: 'Live' as const, round: 2, clock: null, method: null }
    const card: Game = { ...arrowhead, note: 'UFC 309: Jones vs. Miocic', contest: { kind: 'bouts', bouts: [bout] } }

    expect(gameMatchup(card)).toBe('UFC 309: Jones vs. Miocic')
    expect(gameMatchup({ ...card, note: null })).toBe('Jon Jones vs Stipe Miocic')
  })

  it('names a field by its event, else its venue', () => {
    const race: Game = { ...arrowhead, note: 'Daytona 500', contest: { kind: 'field', entries: [] } }

    expect(gameMatchup(race)).toBe('Daytona 500')
    expect(gameMatchup({ ...race, note: null })).toBe('Arrowhead')
  })
})

describe('matchesSearch', () => {
  it('matches every game on an empty search', () => {
    expect(matchesSearch(arrowhead, '  ')).toBe(true)
  })

  it('finds a game by a team, its abbreviation, the league or where it is, whatever the case', () => {
    for (const query of ['chiefs', 'BUF', 'nfl', 'arrowhead', 'kansas city', 'missouri']) {
      expect(matchesSearch(arrowhead, query), query).toBe(true)
    }
  })

  it('needs every word to match, in any order', () => {
    expect(matchesSearch(arrowhead, 'bills chiefs')).toBe(true)
    expect(matchesSearch(arrowhead, 'chiefs raiders')).toBe(false)
  })

  it('ignores accents either way', () => {
    const munich: Game = { ...arrowhead, venue: { ...arrowhead.venue, city: 'München' } }

    expect(matchesSearch(munich, 'munchen')).toBe(true)
    expect(matchesSearch({ ...arrowhead, venue: { ...arrowhead.venue, city: 'Munchen' } }, 'münchen')).toBe(true)
  })

  it('finds a field game by an entrant and a fight card by any fighter', () => {
    const race: Game = { ...arrowhead, contest: { kind: 'field', entries: [{ position: 1, name: 'Kyle Larson', shortName: 'K. Larson', flagUrl: null, score: null }] } }
    const side = (name: string) => ({ name, shortName: name, flagUrl: null, record: null, winner: false })
    const bout = { id: 'b', first: side('Jon Jones'), second: side('Stipe Miocic'), weightClass: null, scheduledRounds: 5, status: 'Final' as const, round: null, clock: null, method: null }
    const card: Game = { ...arrowhead, contest: { kind: 'bouts', bouts: [{ ...bout, status: 'Live', id: 'a', first: side('Alex Pereira'), second: side('Khalil Rountree') }, bout] } }

    expect(matchesSearch(race, 'larson')).toBe(true)
    expect(matchesSearch(card, 'miocic')).toBe(true)
  })
})
