import { describe, expect, it } from 'vitest'
import type { Game, GameSides, GameStatus } from '../games/game'
import { cardRank, nearCenter } from './cardRank'

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
  hot: false,
  venue: { name: 'Arrowhead', city: 'Kansas City', region: 'Missouri', country: 'USA', latitude: 39, longitude: -94, timeZone: 'America/Chicago', photo: null, court: null },
  streamLinks: [],
  note: null,
  situation: null,
  keyEvents: [],
  topEvent: false,
  scoreline: null,
  espnUrl: null,
  ...changes,
})
const ranked = (home: number | null, away: number | null): GameSides => ({ ...sides, home: { ...sides.home, rank: home }, away: { ...sides.away, rank: away } })
const status = (status: GameStatus) => game({ status })

/** The games, best first, each near the middle of the screen or not as given (not, unless given). */
const byRank = (games: Record<string, Game | [Game, boolean]>) =>
  Object.entries(games)
    .map(([name, given]) => [name, Array.isArray(given) ? cardRank(...given) : cardRank(given, false)] as const)
    .sort(([, a], [, b]) => a - b)
    .map(([name]) => name)

describe('cardRank', () => {
  it('puts hot games first, then other Live games, then Upcoming and Final', () => {
    expect(byRank({ final: status('Final'), upcoming: status('Upcoming'), live: game(), hot: game({ hot: true }) })).toEqual([
      'hot',
      'live',
      'upcoming',
      'final',
    ])
  })

  it('puts every game near the middle of the screen before the rest, each side in that order', () => {
    expect(
      byRank({
        hot: game({ hot: true }),
        live: game(),
        centeredFinal: [status('Final'), true],
        centeredHot: [game({ hot: true }), true],
      }),
    ).toEqual(['centeredHot', 'centeredFinal', 'hot', 'live'])
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
    expect(byRank({ rankedLive: game({ contest: ranked(1, 2) }), hot: game({ hot: true }) })).toEqual(['hot', 'rankedLive'])
    expect(byRank({ rankedFinal: [game({ status: 'Final', contest: ranked(1, 2) }), true], upcoming: [status('Upcoming'), true] })).toEqual([
      'upcoming',
      'rankedFinal',
    ])
  })
})

describe('nearCenter', () => {
  it("counts a venue within a fifth of the screen's shorter side of its middle", () => {
    // 1280 by 800: within 160 px of (640, 400).
    expect(nearCenter(640, 400, 1280, 800)).toBe(true)
    expect(nearCenter(640 + 160, 400, 1280, 800)).toBe(true)
    expect(nearCenter(640, 400 - 161, 1280, 800)).toBe(false)
    // 390 by 844: within 78 px of (195, 422).
    expect(nearCenter(195 + 78, 422, 390, 844)).toBe(true)
    expect(nearCenter(195 + 79, 422, 390, 844)).toBe(false)
  })
})
