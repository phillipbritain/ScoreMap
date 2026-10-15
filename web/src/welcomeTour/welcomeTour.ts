import { isLeagueOn, withAllLeagues, type League, type ViewerSettings } from '../settings/viewerSettings'

/**
 * The welcome tour (see GLOSSARY.md): how far a viewer has got through it, and the events that move it
 * on. Its steps are Welcome, Your controls and Click a score card; once finished it never comes back.
 * There is no event to close it: each step moves on only with its own choice or button.
 */
export type TourProgress = 'welcome' | 'controls' | 'scoreCard' | 'finished'

/** What the viewer chose to see on Welcome. */
export type TourChoice = 'topEvents' | 'everything' | 'myLeagues'

export type TourEvent =
  /** Welcome → Your controls. My leagues fires it from its picker's "Show these". */
  | { kind: 'chose'; choice: TourChoice }
  /** Your controls → Click a score card. */
  | { kind: 'next' }
  /** Click a score card → finished, by its Done or by opening the lit card's game. */
  | { kind: 'done' }
  | { kind: 'gameOpened' }

/** Each step, with the events that move it on and where they lead. */
const moves: Record<TourProgress, Partial<Record<TourEvent['kind'], TourProgress>>> = {
  welcome: { chose: 'controls' },
  controls: { next: 'scoreCard' },
  scoreCard: { done: 'finished', gameOpened: 'finished' },
  finished: {},
}

/** The progress after an event: an event that isn't the current step's changes nothing. */
export function tourProgressAfter(progress: TourProgress, event: TourEvent): TourProgress {
  return moves[progress][event.kind] ?? progress
}

/**
 * The viewer settings after a choice on Welcome, as Leagues on the rail would set them: Top Events
 * turns "Top Events" on; Everything turns it off with every league on; My leagues turns it off with
 * every league off, for its picker to switch on with the rail's own sport and league switches
 * (withSport, withLeague). Colours, "Live only" and "Show Disrupted games" are left as they were.
 */
export function settingsForChoice(settings: ViewerSettings, choice: TourChoice, leagues: readonly League[]): ViewerSettings {
  if (choice === 'topEvents') return { ...settings, topEventsOnly: true }
  return { ...withAllLeagues(settings, leagues, choice === 'everything'), topEventsOnly: false }
}

/** Whether My leagues' "Show these" can be pressed: only once a league is on, so the globe isn't left empty. */
export function canShowPicks(settings: ViewerSettings, leagues: readonly League[]): boolean {
  return leagues.some((league) => isLeagueOn(settings, league.name))
}
