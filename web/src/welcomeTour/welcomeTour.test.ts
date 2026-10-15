import { describe, expect, it } from 'vitest'
import { firstVisitSettings, isLeagueOn, withLeague, type ViewerSettings } from '../settings/viewerSettings'
import { canShowPicks, scoreCardToTry, settingsForChoice, tourProgressAfter, type TourEvent, type TourProgress } from './welcomeTour'

describe('welcome tour progress', () => {
  it.each<[TourProgress, TourEvent, TourProgress]>([
    ['welcome', { kind: 'chose', choice: 'topEvents' }, 'controls'],
    ['welcome', { kind: 'chose', choice: 'everything' }, 'controls'],
    ['welcome', { kind: 'chose', choice: 'myLeagues' }, 'controls'],
    ['controls', { kind: 'next' }, 'scoreCard'],
    ['scoreCard', { kind: 'done' }, 'finished'],
    ['scoreCard', { kind: 'gameOpened' }, 'finished'],
  ])('moves from %s on %j to %s', (progress, event, after) => {
    expect(tourProgressAfter(progress, event)).toBe(after)
  })

  it.each<[TourProgress, TourEvent]>([
    ['welcome', { kind: 'next' }],
    ['welcome', { kind: 'done' }],
    ['welcome', { kind: 'gameOpened' }],
    ['controls', { kind: 'chose', choice: 'everything' }],
    ['controls', { kind: 'done' }],
    ['controls', { kind: 'gameOpened' }],
    ['scoreCard', { kind: 'chose', choice: 'topEvents' }],
    ['scoreCard', { kind: 'next' }],
  ])("stays at %s on %j, another step's event", (progress, event) => {
    expect(tourProgressAfter(progress, event)).toBe(progress)
  })

  it.each<TourEvent>([
    { kind: 'chose', choice: 'topEvents' },
    { kind: 'next' },
    { kind: 'done' },
    { kind: 'gameOpened' },
  ])('stays finished on %j', (event) => {
    expect(tourProgressAfter('finished', event)).toBe('finished')
  })
})

const nfl = { name: 'NFL', sport: 'Football' }
const nba = { name: 'NBA', sport: 'Basketball' }
const mls = { name: 'MLS', sport: 'Soccer' }
const leagues = [nfl, nba, mls]

/** Settings a viewer might have before choosing: some leagues off, colours picked, "Live only" on, Disrupted hidden. */
const before: ViewerSettings = {
  ...firstVisitSettings,
  hiddenLeagues: ['NBA'],
  liveOnly: true,
  showDisrupted: false,
  sportColours: { Football: '#123456' },
  leagueColours: { MLS: '#abcdef' },
}

describe('what each Welcome choice does to the viewer settings', () => {
  it('Top Events turns "Top Events" on', () => {
    expect(settingsForChoice(before, 'topEvents', leagues).topEventsOnly).toBe(true)
  })

  it('Everything turns "Top Events" off with every league on', () => {
    const after = settingsForChoice({ ...before, topEventsOnly: true }, 'everything', leagues)

    expect(after.topEventsOnly).toBe(false)
    expect(leagues.every((league) => isLeagueOn(after, league.name))).toBe(true)
  })

  it('My leagues turns "Top Events" off with every league off, for its picker to switch on', () => {
    const after = settingsForChoice({ ...before, topEventsOnly: true }, 'myLeagues', leagues)

    expect(after.topEventsOnly).toBe(false)
    expect(leagues.some((league) => isLeagueOn(after, league.name))).toBe(false)
  })

  it.each(['topEvents', 'everything', 'myLeagues'] as const)(
    '%s leaves colours, "Live only" and "Show Disrupted games" as they were',
    (choice) => {
      const after = settingsForChoice(before, choice, leagues)

      expect(after.liveOnly).toBe(true)
      expect(after.showDisrupted).toBe(false)
      expect(after.sportColours).toEqual({ Football: '#123456' })
      expect(after.leagueColours).toEqual({ MLS: '#abcdef' })
    },
  )

  it("Top Events leaves the league switches as they were, as the rail's does", () => {
    expect(settingsForChoice(before, 'topEvents', leagues).hiddenLeagues).toEqual(['NBA'])
  })
})

describe('"Show these" on the My leagues picker', () => {
  const nothingOn = settingsForChoice(before, 'myLeagues', leagues)

  it("can't be pressed with nothing picked", () => {
    expect(canShowPicks(nothingOn, leagues)).toBe(false)
  })

  it('can be pressed once a league is picked', () => {
    expect(canShowPicks(withLeague(nothingOn, 'NBA', true), leagues)).toBe(true)
  })

  it("can't be pressed before the leagues have loaded", () => {
    expect(canShowPicks(firstVisitSettings, [])).toBe(false)
  })
})

describe("Click a score card's pick", () => {
  // A 1600 x 900 screen, its panel in the middle.
  const screen = { left: 0, top: 0, right: 1600, bottom: 900 }
  const panel = { left: 580, top: 300, right: 1020, bottom: 600 }
  const card = (gameId: string, left: number, top: number) => ({
    gameId,
    box: { left, top, right: left + 120, bottom: top + 70 },
  })

  it('picks the card nearest the middle of the screen of those the panel leaves clear', () => {
    const cards = [card('far', 100, 100), card('near', 400, 420), card('middling', 1200, 150)]
    expect(scoreCardToTry(cards, panel, screen)).toBe('near')
  })

  it('passes over a card under the panel for the next nearest', () => {
    const cards = [card('under', 740, 410), card('beside', 1100, 420)]
    expect(scoreCardToTry(cards, panel, screen)).toBe('beside')
  })

  it('passes over a card within the margin of the panel for the next nearest', () => {
    // Its right edge 5px short of the panel's left.
    const cards = [card('hugging', 455, 420), card('clear', 1150, 420)]
    expect(scoreCardToTry(cards, panel, screen)).toBe('clear')
  })

  it('passes over a card partly off the screen', () => {
    const cards = [card('cut off', 1500, 420), card('whole', 0, 0)]
    expect(scoreCardToTry(cards, panel, screen)).toBe('whole')
  })

  it('picks none when no card is clear of the panel', () => {
    expect(scoreCardToTry([card('under', 740, 410), card('hugging', 455, 420)], panel, screen)).toBeNull()
  })

  it('picks none with no cards', () => {
    expect(scoreCardToTry([], panel, screen)).toBeNull()
  })
})
