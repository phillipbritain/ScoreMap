import type { ScreenBox } from '../globe/panelClearance'
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

/** A score card on screen, for Click a score card to pick from. */
export interface CardOnScreen {
  gameId: string
  box: ScreenBox
}

/** Room a card picked by Click a score card keeps from the panel, so its spotlight and arrow fit. */
export const cardPickMargin = 16

/**
 * The score card Click a score card points at: of the cards wholly on the screen that the panel
 * leaves clear by a margin, the one nearest the middle of the screen; or none, for the example card.
 * The panel is its box on screen (a centred panel, or a phone's bottom sheet).
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

function middleOf(box: ScreenBox): { x: number; y: number } {
  return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 }
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
