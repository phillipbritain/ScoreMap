import type { ScreenBox } from '../globe/panelClearance'
import { isLeagueOn, withAllLeagues, withLeague, type League, type ViewerSettings } from '../settings/viewerSettings'
import { middleOf } from './tourArrow'

/**
 * The welcome tour (see GLOSSARY.md): how far a viewer has got through it, and the events that move it
 * on. Its steps are Welcome, Your controls and Click a score card; once finished it comes back only
 * when the viewer asks for it again, from More on the rail. Closing it, at any step, finishes it too.
 */
export type TourProgress = 'welcome' | 'controls' | 'scoreCard' | 'finished'

/** What the viewer chose to see on Welcome. */
export type TourChoice = 'topEvents' | 'everything' | 'myLeagues'

export type TourEvent =
  /** Welcome → Your controls. My leagues fires it from its picker's "Show these". */
  | { kind: 'chose'; choice: TourChoice }
  /** Your controls → Click a score card. */
  | { kind: 'next' }
  /** Click a score card → finished, by its Done button. Pressing the lit card opens its game's panel and leaves the step showing. */
  | { kind: 'done' }
  /** Any step → finished, by the panel's × or Escape. */
  | { kind: 'closed' }
  /** Finished → Welcome, by "Welcome tour" in More on the rail. */
  | { kind: 'again' }

/** Each step, with the events that move it on and where they lead. */
const moves: Record<TourProgress, Partial<Record<TourEvent['kind'], TourProgress>>> = {
  welcome: { chose: 'controls', closed: 'finished' },
  controls: { next: 'scoreCard', closed: 'finished' },
  scoreCard: { done: 'finished', closed: 'finished' },
  finished: { again: 'welcome' },
}

/** Whether something (saved progress, read back) is one of the tour's steps. */
export function isTourProgress(value: unknown): value is TourProgress {
  return typeof value === 'string' && Object.hasOwn(moves, value)
}

/** The progress after an event: an event that isn't the current step's changes nothing. */
export function tourProgressAfter(progress: TourProgress, event: TourEvent): TourProgress {
  return moves[progress][event.kind] ?? progress
}

/**
 * The viewer settings after a choice on Welcome, as Leagues on the rail would set them: Top Events
 * turns "Top Events" on; Everything turns it off with every league on; My leagues turns it off with
 * every league off, for its picker (the rail's own LeaguePicker) to switch on (see settingsForPicks).
 * Display Settings are left as they were.
 */
export function settingsForChoice(settings: ViewerSettings, choice: TourChoice, leagues: readonly League[]): ViewerSettings {
  if (choice === 'topEvents') return { ...settings, topEventsOnly: true }
  return { ...withAllLeagues(settings, leagues, choice === 'everything'), topEventsOnly: false }
}

/** A score card on screen, for Click a score card to pick from. */
export interface CardOnScreen {
  gameId: string
  box: ScreenBox
}

/** Room a card picked by Click a score card keeps from the panel, so its spotlight and arrow fit. */
export const cardPickMargin = 16

/**
 * The score card Click a score card points at: of the cards wholly on the screen that the panel
 * leaves clear by a margin, the one nearest the middle of the screen; or none.
 * The panel is its box on screen.
 */
export function scoreCardToTry(cards: readonly CardOnScreen[], panel: ScreenBox, screen: ScreenBox): string | null {
  const middle = middleOf(screen)
  let nearest: { gameId: string; distance: number } | null = null
  for (const { gameId, box } of cards) {
    if (!within(box, screen) || overlaps(box, grown(panel, cardPickMargin))) continue
    const { x, y } = middleOf(box)
    const distance = Math.hypot(x - middle.x, y - middle.y)
    if (!nearest || distance < nearest.distance) nearest = { gameId, distance }
  }
  return nearest?.gameId ?? null
}

function within(box: ScreenBox, outer: ScreenBox): boolean {
  return box.left >= outer.left && box.top >= outer.top && box.right <= outer.right && box.bottom <= outer.bottom
}

function overlaps(a: ScreenBox, b: ScreenBox): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function grown(box: ScreenBox, by: number): ScreenBox {
  return { left: box.left - by, top: box.top - by, right: box.right + by, bottom: box.bottom + by }
}

/** Whether My leagues' "Show these" can be pressed: only once a league is on, so the globe isn't left empty. */
export function canShowPicks(settings: ViewerSettings, leagues: readonly League[]): boolean {
  return leagues.some((league) => isLeagueOn(settings, league.name))
}

/**
 * What My leagues' picker holds until "Show these" applies it: the leagues switched on, by name, and the
 * conferences chosen in each league, as ViewerSettings.chosenConferences holds them. It starts with none
 * (noPicks), every league off and showing all its conferences.
 */
export interface TourPicks {
  leagues: readonly string[]
  conferences: ViewerSettings['chosenConferences']
}

export const noPicks: TourPicks = { leagues: [], conferences: {} }

/**
 * The viewer settings My leagues' picker shows, and "Show these" applies: My leagues (settingsForChoice),
 * with only the picked leagues on and the picked conferences chosen, in place of any chosen before, so
 * they're saved just as conferences chosen in Leagues on the rail are.
 */
export function settingsForPicks(settings: ViewerSettings, picks: TourPicks, leagues: readonly League[]): ViewerSettings {
  const picked = picks.leagues.reduce(
    (current, league) => withLeague(current, league, true),
    settingsForChoice(settings, 'myLeagues', leagues),
  )
  return { ...picked, chosenConferences: picks.conferences }
}

/** The picks a change in My leagues' picker leaves, read back from the settings it changed. */
export function picksFrom(settings: ViewerSettings, leagues: readonly League[]): TourPicks {
  return {
    leagues: leagues.filter((league) => isLeagueOn(settings, league.name)).map((league) => league.name),
    conferences: settings.chosenConferences,
  }
}
