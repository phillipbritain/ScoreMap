import { describe, expect, it } from 'vitest'
import {
  firstVisitSettings,
  isLeagueOn,
  withConference,
  withLeague,
  type ViewerSettings,
} from '../settings/viewerSettings'
import {
  canShowPicks,
  isTourProgress,
  middleClearsEventPanel,
  moveAndZoomWords,
  noPicks,
  picksFrom,
  scoreCardToTry,
  settingsForChoice,
  settingsForPicks,
  progressAfterReload,
  tourLocksTabs,
  tourProgressAfter,
  type TourEvent,
  type TourProgress,
} from './welcomeTour'

describe('welcome tour progress', () => {
  it.each<[TourProgress, TourEvent, TourProgress]>([
    ['welcome', { kind: 'chose', choice: 'topEvents' }, 'controls'],
    ['welcome', { kind: 'chose', choice: 'everything' }, 'controls'],
    ['welcome', { kind: 'chose', choice: 'myLeagues' }, 'controls'],
    ['controls', { kind: 'next' }, 'scoreCard'],
    ['scoreCard', { kind: 'gameOpened' }, 'eventPanel'],
    ['eventPanel', { kind: 'next' }, 'panelTabs'],
    ['panelTabs', { kind: 'next' }, 'panelWatch'],
    ['panelWatch', { kind: 'next' }, 'allSet'],
    ['panelTabs', { kind: 'closed' }, 'finished'],
    ['panelWatch', { kind: 'closed' }, 'finished'],
    ['eventPanel', { kind: 'closed' }, 'finished'],
    ['allSet', { kind: 'done' }, 'finished'],
    ['allSet', { kind: 'closed' }, 'finished'],
    ['welcome', { kind: 'closed' }, 'finished'],
    ['controls', { kind: 'closed' }, 'finished'],
    ['scoreCard', { kind: 'closed' }, 'finished'],
    ['finished', { kind: 'again' }, 'welcome'],
    ['controls', { kind: 'again' }, 'welcome'],
    ['scoreCard', { kind: 'again' }, 'welcome'],
    ['eventPanel', { kind: 'again' }, 'welcome'],
    ['allSet', { kind: 'again' }, 'welcome'],
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
    ['scoreCard', { kind: 'done' }],
    ['eventPanel', { kind: 'gameOpened' }],
    ['eventPanel', { kind: 'done' }],
    ['allSet', { kind: 'gameOpened' }],
    ['allSet', { kind: 'next' }],
  ])("stays at %s on %j, another step's event", (progress, event) => {
    expect(tourProgressAfter(progress, event)).toBe(progress)
  })

  it.each<TourEvent>([
    { kind: 'chose', choice: 'topEvents' },
    { kind: 'next' },
    { kind: 'done' },
    { kind: 'gameOpened' },
    { kind: 'closed' },
  ])('stays finished on %j', (event) => {
    expect(tourProgressAfter('finished', event)).toBe('finished')
  })
})

describe('tourLocksTabs', () => {
  it('locks the event panel\'s tabs on The event panel, before Game details', () => {
    expect(tourLocksTabs('eventPanel')).toBe(true)
  })

  it.each<TourProgress | null>(['panelTabs', 'panelWatch', 'allSet', 'finished', null])('leaves them usable at %s', (progress) => {
    expect(tourLocksTabs(progress)).toBe(false)
  })
})

describe('progressAfterReload', () => {
  it.each<TourProgress>(['welcome', 'controls', 'scoreCard', 'finished'])(
    'carries on at %s',
    (progress) => {
      expect(progressAfterReload(progress)).toBe(progress)
    },
  )

  it.each<TourProgress>(['eventPanel', 'panelTabs', 'panelWatch'])(
    'goes back from %s to Click a score card, as the panel it lights is no longer open',
    (progress) => {
      expect(progressAfterReload(progress)).toBe('scoreCard')
    },
  )

  it('finishes the tour from All set, straight into the live games', () => {
    expect(progressAfterReload('allSet')).toBe('finished')
  })
})

describe('isTourProgress', () => {
  it.each(['welcome', 'controls', 'scoreCard', 'eventPanel', 'panelTabs', 'panelWatch', 'allSet', 'finished'])('takes %s as a step', (progress) => {
    expect(isTourProgress(progress)).toBe(true)
  })

  it.each<unknown>(['halfway', 'Welcome', '', 3, null, undefined, ['welcome']])('takes %j as no step', (progress) => {
    expect(isTourProgress(progress)).toBe(false)
  })
})

const nfl = { name: 'NFL', sport: 'Football', conferences: [] }
const nba = { name: 'NBA', sport: 'Basketball', conferences: [] }
const mls = { name: 'MLS', sport: 'Soccer', conferences: [] }
const ncaaf = { name: 'NCAA Football', sport: 'Football', conferences: ['SEC', 'ACC', 'Big Ten'] }
const leagues = [nfl, nba, mls, ncaaf]

/** Settings a viewer might have before choosing: some leagues off, colors picked. */
const before: ViewerSettings = {
  ...firstVisitSettings,
  hiddenLeagues: ['NBA'],
  sportColors: { Football: '#123456' },
  leagueColors: { MLS: '#abcdef' },
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
    '%s leaves Display Settings as they were',
    (choice) => {
      const after = settingsForChoice(before, choice, leagues)

      expect(after.sportColors).toEqual({ Football: '#123456' })
      expect(after.leagueColors).toEqual({ MLS: '#abcdef' })
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

describe("My leagues' picks", () => {
  /** A change made in the picker, as LeaguePicker hands it back, read into the picks. */
  const change = (picks: typeof noPicks, edit: (settings: ViewerSettings) => ViewerSettings) =>
    picksFrom(edit(settingsForPicks(before, picks, leagues)), leagues)

  it('start with every league off, showing all their conferences', () => {
    const shown = settingsForPicks({ ...before, chosenConferences: { 'NCAA Football': ['ACC'] } }, noPicks, leagues)

    expect(leagues.some((league) => isLeagueOn(shown, league.name))).toBe(false)
    expect(shown.chosenConferences).toEqual({})
  })

  it('apply the leagues picked and the conferences chosen, as the rail saves them', () => {
    let picks = change(noPicks, (settings) => withLeague(settings, 'NCAA Football', true))
    picks = change(picks, (settings) => withConference(settings, 'NCAA Football', 'SEC', true))
    picks = change(picks, (settings) => withConference(settings, 'NCAA Football', 'Big Ten', true))
    const applied = settingsForPicks(before, picks, leagues)

    expect(leagues.filter((league) => isLeagueOn(applied, league.name)).map((league) => league.name)).toEqual(['NCAA Football'])
    expect(applied.chosenConferences).toEqual(
      withConference(withConference(firstVisitSettings, 'NCAA Football', 'SEC', true), 'NCAA Football', 'Big Ten', true)
        .chosenConferences,
    )
    expect(applied.topEventsOnly).toBe(false)
    expect(applied.sportColors).toEqual({ Football: '#123456' })
  })

  it('in place of conferences chosen before the tour', () => {
    const picks = change(noPicks, (settings) => withLeague(settings, 'NCAA Football', true))

    expect(settingsForPicks({ ...before, chosenConferences: { 'NCAA Football': ['ACC'] } }, picks, leagues).chosenConferences).toEqual({})
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

describe("where All set sits over the event panel on a desktop", () => {
  it('sits in the middle of a tall screen, clear of the event panel', () => {
    expect(middleClearsEventPanel(800, 168, 224)).toBe(true)
  })

  it('sits right above the event panel where the middle would run into it', () => {
    expect(middleClearsEventPanel(600, 168, 224)).toBe(false)
  })
})

describe('how Your controls says to move and zoom the globe', () => {
  it('says pinch to zoom on a touchscreen, without a scroll wheel', () => {
    const words = moveAndZoomWords(true)

    expect(words).toMatch(/drag/i)
    expect(words).toMatch(/pinch/i)
    expect(words).not.toMatch(/scroll/i)
  })

  it('says drag and scroll with a mouse', () => {
    const words = moveAndZoomWords(false)

    expect(words).toMatch(/drag/i)
    expect(words).toMatch(/scroll/i)

  })
})
