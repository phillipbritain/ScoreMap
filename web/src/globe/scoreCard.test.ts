import { describe, expect, it } from 'vitest'
import type { Game, GameSides } from '../games/game'
import { themeWith } from '../theme/testTheme'
import { headerText, scoreCard } from './scoreCard'

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
    home: { abbreviation: 'KC', fullName: 'Kansas City Chiefs', logoUrl: 'https://a.espncdn.com/kc.png', score: '21', rank: null, record: null },
    away: { abbreviation: 'BUF', fullName: 'Buffalo Bills', logoUrl: 'https://a.espncdn.com/buf.png', score: '17', rank: null, record: null },
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
const sides = arrowhead.contest as GameSides

describe('scoreCard', () => {
  it('shows both teams with logo, abbreviation and score, away on top, plus the clock line', () => {
    expect(scoreCard(arrowhead, false)).toEqual({
      gameId: '401',
      status: 'Live',
      top: { abbreviation: 'BUF', logoUrl: 'https://a.espncdn.com/buf.png', score: '17' },
      bottom: { abbreviation: 'KC', logoUrl: 'https://a.espncdn.com/kc.png', score: '21' },
      clockLine: '4:12',
      flames: false,
    })
  })

  it('shows a tennis match with the home side on top', () => {
    const card = scoreCard({ ...arrowhead, sport: 'Tennis' }, false)

    expect([card.top.abbreviation, card.bottom.abbreviation]).toEqual(['KC', 'BUF'])
  })

  it('shows flames when the game shows them', () => {
    expect(scoreCard(arrowhead, true).flames).toBe(true)
  })

  it('leaves scores blank and shows no clock line before an Upcoming game starts', () => {
    const upcoming: Game = {
      ...arrowhead,
      status: 'Upcoming',
      clock: null,
      period: null,
      contest: {
        kind: 'sides',
        home: { ...sides.home, score: null },
        away: { ...sides.away, score: null },
      },
    }

    expect(scoreCard(upcoming, false)).toMatchObject({
      status: 'Upcoming',
      top: { score: '' },
      bottom: { score: '' },
      clockLine: '',
    })
  })

  it('shows "Delayed" in place of the clock for a delayed game', () => {
    expect(scoreCard({ ...arrowhead, delayed: true }, false).clockLine).toBe('Delayed')
  })

  it("shows a Final game's final line in its sport's style", () => {
    expect(scoreCard({ ...arrowhead, status: 'Final', clock: 'Final/OT' }, false).clockLine).toBe('Final/OT')
  })

  it('shows which kind of disruption in place of the clock for a Disrupted game', () => {
    const suspended: Game = { ...arrowhead, status: 'Disrupted', disruption: 'Suspended', clock: null }

    expect(scoreCard(suspended, false)).toMatchObject({ status: 'Disrupted', clockLine: 'Suspended' })
  })

  describe('for a race', () => {
    const usa = 'https://a.espncdn.com/i/teamlogos/countries/500/usa.png'
    const talladega: Game = {
      ...arrowhead,
      sport: 'Racing',
      league: 'NASCAR Cup Series',
      note: 'NASCAR Cup Series at Talladega',
      clock: 'Lap 189',
      contest: {
        kind: 'field',
        entries: [
          { position: 1, name: 'Kyle Larson', shortName: 'K. Larson', flagUrl: usa },
          { position: 2, name: 'William Byron', shortName: 'W. Byron', flagUrl: usa },
          { position: 3, name: 'Ryan Blaney', shortName: 'R. Blaney', flagUrl: usa },
        ],
      },
    }

    it('shows the top two entrants by position, with no score, and the lap', () => {
      expect(scoreCard(talladega, false)).toMatchObject({
        top: { abbreviation: '1 K. Larson', logoUrl: usa, score: '' },
        bottom: { abbreviation: '2 W. Byron', logoUrl: usa, score: '' },
        clockLine: 'Lap 189',
      })
    })

    it("shows the race's name before its field is listed", () => {
      const upcoming: Game = { ...talladega, status: 'Upcoming', clock: null, contest: { kind: 'field', entries: [] } }

      expect(scoreCard(upcoming, false)).toMatchObject({
        top: { abbreviation: 'NASCAR Cup Series at Talladega', logoUrl: null, score: '' },
        bottom: { abbreviation: '', logoUrl: null, score: '' },
      })
    })
  })
})

describe("a score card's header text", () => {
  // A dark card with light text, its header strongly tinted with the game's colour.
  const theme = themeWith((json) => {
    Object.assign(json.components.ScoreCard, { fill: '#101828', text: '#eeeeee' })
    json.components.ScoreCard.header.tint = 0.8
    Object.assign(json.components.ScoreCard.disrupted, { fill: '#202020', text: '#909090' })
  })

  it("is the card's text on a header tinted with a dark colour", () => {
    expect(headerText('#123456', 'Live', theme)).toBe('#eeeeee')
  })

  it("is the card's fill on a header tinted with a pale colour, so it stays readable", () => {
    expect(headerText('#fff8c0', 'Live', theme)).toBe('#101828')
    expect(headerText('#ffff00', 'Final', theme)).toBe('#101828')
  })

  it("is a Disrupted card's own text or fill", () => {
    expect(headerText('#123456', 'Disrupted', theme)).toBe('#909090')
    expect(headerText('#ffffff', 'Disrupted', theme)).toBe('#202020')
  })
})
