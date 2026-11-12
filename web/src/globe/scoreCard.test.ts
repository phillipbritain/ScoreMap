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
  streamLinks: [],
  note: null,
  situation: null,
  lastScore: null,
  keyEvents: [],
  topEvent: false,
  scoreline: null,
  espnUrl: null,
}
const sides = arrowhead.contest as GameSides

describe('scoreCard', () => {
  it('shows both teams with logo, abbreviation and score, away on top, plus the clock line', () => {
    expect(scoreCard(arrowhead)).toEqual({
      gameId: '401',
      status: 'Live',
      top: { label: 'BUF', logoUrl: 'https://a.espncdn.com/buf.png', score: '17' },
      bottom: { label: 'KC', logoUrl: 'https://a.espncdn.com/kc.png', score: '21' },
      clockLine: '4:12',
      flames: false,
    })
  })

  it('shows a tennis match with the home side on top', () => {
    const card = scoreCard({ ...arrowhead, sport: 'Tennis' })

    expect([card.top.label, card.bottom.label]).toEqual(['KC', 'BUF'])
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

    expect(scoreCard(upcoming)).toMatchObject({
      status: 'Upcoming',
      top: { score: '' },
      bottom: { score: '' },
      clockLine: '',
    })
  })

  it('shows "Delayed" in place of the clock for a delayed game', () => {
    expect(scoreCard({ ...arrowhead, delayed: true }).clockLine).toBe('Delayed')
  })

  it("shows a Final game's final line in its sport's style", () => {
    expect(scoreCard({ ...arrowhead, status: 'Final', clock: 'Final/OT' }).clockLine).toBe('Final/OT')
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
          { position: 1, name: 'Kyle Larson', shortName: 'K. Larson', flagUrl: usa, score: null },
          { position: 2, name: 'William Byron', shortName: 'W. Byron', flagUrl: usa, score: null },
          { position: 3, name: 'Ryan Blaney', shortName: 'R. Blaney', flagUrl: usa, score: null },
        ],
      },
    }

    it('shows the top two entrants by position, with no score, and the lap', () => {
      expect(scoreCard(talladega)).toMatchObject({
        top: { label: '1 K. Larson', logoUrl: usa, score: '' },
        bottom: { label: '2 W. Byron', logoUrl: usa, score: '' },
        clockLine: 'Lap 189',
      })
    })

    it("shows a golf tournament's top two with their scores to par, a tie marked", () => {
      const mexicoOpen: Game = {
        ...talladega,
        sport: 'Golf',
        clock: 'R2 · Thru 14',
        contest: {
          kind: 'field',
          entries: [
            { position: 1, name: 'Ben Griffin', shortName: 'B. Griffin', flagUrl: usa, score: '-12' },
            { position: 2, name: 'Kihei Akina', shortName: 'K. Akina', flagUrl: usa, score: '-11' },
            { position: 2, name: 'Andrew Novak', shortName: 'A. Novak', flagUrl: usa, score: '-11' },
          ],
        },
      }

      expect(scoreCard(mexicoOpen)).toMatchObject({
        top: { label: '1 B. Griffin', logoUrl: usa, score: '-12' },
        bottom: { label: 'T2 K. Akina', logoUrl: usa, score: '-11' },
        clockLine: 'R2 · Thru 14',
      })
    })

    it("shows the race's name before its field is listed", () => {
      const upcoming: Game = { ...talladega, status: 'Upcoming', clock: null, contest: { kind: 'field', entries: [] } }

      expect(scoreCard(upcoming)).toMatchObject({
        top: { label: 'NASCAR Cup Series at Talladega', logoUrl: null, score: '' },
        bottom: { label: '', logoUrl: null, score: '' },
      })
    })
  })
})

describe('scoreCard for a fight card', () => {
  const usa = 'https://a.espncdn.com/i/teamlogos/countries/500/usa.png'
  const bra = 'https://a.espncdn.com/i/teamlogos/countries/500/bra.png'
  const side = (name: string, shortName: string, flagUrl: string, winner = false) => ({ name, shortName, flagUrl, record: '20-4-0', winner })
  const main = {
    id: 'main',
    first: side('Jon Jones', 'J. Jones', usa),
    second: side('Stipe Miocic', 'S. Miocic', usa),
    weightClass: 'Heavyweight',
    scheduledRounds: 5,
    status: 'Upcoming' as const,
    round: null,
    clock: null,
    method: null,
  }
  const coMain = {
    ...main,
    id: 'co-main',
    first: side('Charles Oliveira', 'C. Oliveira', bra),
    second: side('Michael Chandler', 'M. Chandler', usa),
    scheduledRounds: 3,
    status: 'Live' as const,
    round: 2,
  }
  const ufc309: Game = {
    ...arrowhead,
    sport: 'MMA',
    league: 'UFC',
    note: 'UFC 309: Jones vs. Miocic',
    clock: 'R2',
    contest: { kind: 'bouts', bouts: [main, coMain] },
  }

  it('shows the bout on now as two sides, with their flags and no score, and its round', () => {
    expect(scoreCard(ufc309)).toMatchObject({
      top: { label: 'C. Oliveira', logoUrl: bra, score: '' },
      bottom: { label: 'M. Chandler', logoUrl: usa, score: '' },
      clockLine: 'R2',
    })
  })

  it('shows the main event and the card start time in the viewer’s time zone before it starts', () => {
    const upcoming: Game = {
      ...ufc309,
      status: 'Upcoming',
      clock: null,
      contest: { kind: 'bouts', bouts: [main, { ...coMain, status: 'Upcoming', round: null }] },
    }

    expect(scoreCard(upcoming)).toMatchObject({
      top: { label: 'J. Jones' },
      bottom: { label: 'S. Miocic' },
      clockLine: new Date(upcoming.startTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    })
  })

  it("shows the main event's winner once the card is over", () => {
    const finished = { ...main, status: 'Final' as const, round: 3, clock: '1:28', method: 'KO/TKO', second: { ...main.second, winner: true } }
    const final: Game = {
      ...ufc309,
      status: 'Final',
      clock: 'KO/TKO · R3',
      contest: { kind: 'bouts', bouts: [finished, { ...coMain, status: 'Final', method: 'Decision' }] },
    }

    expect(scoreCard(final)).toMatchObject({
      top: { label: 'J. Jones', score: '' },
      bottom: { label: 'S. Miocic', score: 'W' },
      clockLine: 'KO/TKO · R3',
    })
  })
})

describe("a score card's header text", () => {
  // A dark card with light text, its header strongly tinted with the game's color.
  const theme = themeWith((json) => {
    Object.assign(json.components.ScoreCard, { fill: '#101828', text: '#eeeeee' })
    json.components.ScoreCard.header.tint = 0.8
  })

  it("is the card's text on a header tinted with a dark color", () => {
    expect(headerText('#123456', theme)).toBe('#eeeeee')
  })

  it("is the card's fill on a header tinted with a pale color, so it stays readable", () => {
    expect(headerText('#fff8c0', theme)).toBe('#101828')
    expect(headerText('#ffff00', theme)).toBe('#101828')
  })
})
