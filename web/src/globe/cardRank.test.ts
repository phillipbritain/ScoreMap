import { describe, expect, it } from 'vitest'
import type { Game, GameSides, GameStatus } from '../games/game'
import { cardRank } from './cardRank'

const sides: GameSides = {
  kind: 'sides',
  home: { abbreviation: 'KC', fullName: 'Kansas City Chiefs', logoUrl: null, score: '21', rank: null, record: null, conference: null },
  away: { abbreviation: 'BUF', fullName: 'Buffalo Bills', logoUrl: null, score: '3', rank: null, record: null, conference: null },
}
const game = (changes: Partial<Game> = {}): Game => ({
  id: '401',
  league: 'NFL',
  sport: 'Football',
  startTime: '2026-10-04T17:00:00+00:00',
  status: 'Live',
  delayed: false,
  endTime: null,
  contest: sides,
  clock: '4:12',
  period: 3,
  clutchTime: false,
  hot: false,
  venue: { name: 'Arrowhead', city: 'Kansas City', region: 'Missouri', country: 'USA', latitude: 39, longitude: -94, timeZone: 'America/Chicago', photo: null, court: null },
  streamLinks: [],
  note: null,
  situation: null,
  lastScore: null,
  keyEvents: [],
  topEvent: false,
  scoreline: null,
  espnUrl: null,
  ...changes,
})
const scores = (home: string | null, away: string | null): GameSides => ({ ...sides, home: { ...sides.home, score: home }, away: { ...sides.away, score: away } })
const ranked = (home: number | null, away: number | null): GameSides => ({ ...sides, home: { ...sides.home, rank: home }, away: { ...sides.away, rank: away } })
const status = (status: GameStatus) => game({ status })

/** The games, best first. */
const byRank = (games: Record<string, Game>) => Object.entries(games).sort(([, a], [, b]) => cardRank(a) - cardRank(b)).map(([name]) => name)

describe('cardRank', () => {
  it('puts hot games first, then clutch time, then close Live games, other Live games, Upcoming and Final', () => {
    expect(
      byRank({
        final: status('Final'),
        upcoming: status('Upcoming'),
        live: game(),
        close: game({ contest: scores('21', '17') }),
        clutch: game({ sport: 'Basketball', clutchTime: true, contest: scores('90', '70') }),
        hot: game({ hot: true }),
      }),
    ).toEqual(['hot', 'clutch', 'close', 'live', 'upcoming', 'final'])
  })

  it('counts a game close within 8 points in football and basketball, and within 1 elsewhere', () => {
    const close = cardRank(game({ contest: scores('1', '0') }))
    const notClose = cardRank(game())

    expect(cardRank(game({ contest: scores('29', '21') }))).toBe(close)
    expect(cardRank(game({ contest: scores('30', '21') }))).toBe(notClose)
    expect(cardRank(game({ sport: 'Basketball', contest: scores('80', '72') }))).toBe(close)
    expect(cardRank(game({ sport: 'Hockey', contest: scores('2', '1') }))).toBe(close)
    expect(cardRank(game({ sport: 'Hockey', contest: scores('3', '1') }))).toBe(notClose)
  })

  it("doesn't count a game close before both sides have a score, nor one with no sides", () => {
    const notClose = cardRank(game())

    expect(cardRank(game({ contest: scores(null, null) }))).toBe(notClose)
    expect(cardRank(game({ sport: 'Cricket', contest: scores('186/6', '180/9') }))).toBe(notClose)
    expect(cardRank(game({ sport: 'Golf', contest: { kind: 'field', entries: [] } }))).toBe(notClose)
  })

  it('brings games with ranked teams forward, the higher ranked the sooner, but never past a better kind of game', () => {
    expect(
      byRank({
        unranked: game(),
        twentyFifth: game({ contest: ranked(25, null) }),
        first: game({ contest: ranked(1, null) }),
        both: game({ contest: ranked(1, 2) }),
      }),
    ).toEqual(['both', 'first', 'twentyFifth', 'unranked'])
    expect(cardRank(game({ contest: { ...ranked(1, 2), home: { ...ranked(1, 2).home, score: '21' } } }))).toBeGreaterThan(
      cardRank(game({ contest: scores('21', '17') })),
    )
  })
})
