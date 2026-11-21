import type { ExpressionSpecification } from 'maplibre-gl'
import type { GameStatus } from '../games/game'
import { isHexColor, mixColors } from '../theme/palette'
import { statusKey, type Theme } from '../theme/theme'

/**
 * How a game's status shows on the globe. Live stands out most, Upcoming is dimmer and Final fades,
 * alike on small pins, score cards and card clusters. Each
 * status's look comes from the theme, gathered here from where it sits there: its color from the
 * palette, the small pin's core and glow from the Pin component, a cluster's opacity from Cluster and a
 * score card's fade and glow from ScoreCard. What isn't look stays here: which status draws on top, the
 * order of prominence, and how a cluster picks its status. Map layers read the look through style
 * expressions (see byStatus), and the page's CSS through the theme's custom properties (see applyTheme).
 */
export interface StatusLook {
  color: string
  core: Theme['components']['Pin']['live']['core']
  glow: Theme['components']['Pin']['live']['glow']
  clusterOpacity: number
  card: Theme['components']['ScoreCard']['live']
  /** Which draws on top where pins or score cards overlap: highest first. */
  stacking: number
}

/** Which status draws on top where pins or score cards overlap: highest first. */
export const stacking: Readonly<Record<GameStatus, number>> = { Live: 2, Upcoming: 1, Final: 0 }

/** A status's look, from the theme. */
export function statusLook(theme: Theme, status: GameStatus): StatusLook {
  const key = statusKey(status)
  const { Pin, Cluster, ScoreCard } = theme.components
  const { fade, glow } = ScoreCard[key]
  return {
    color: theme.palette[key].main,
    ...Pin[key],
    clusterOpacity: Cluster[key].opacity,
    card: { fade, glow },
    stacking: stacking[status],
  }
}

/**
 * A game's color as its status dims it on its small pin, venue dot or venue cluster, and trail
 * (Pin's `dim`): mixed toward the background's paper, solid rather than see-through, as a score
 * card fades (ADR-0012: status shows by brightness, color stands for the game's sport or league).
 */
export function dimmedColor(theme: Theme, color: string, status: GameStatus): string {
  const dim = theme.components.Pin[statusKey(status)].dim
  const paper = theme.palette.background.paper
  // A color the theme gives directly, not as #rrggbb, can't be mixed, so it stays as it is.
  return dim === 0 || !isHexColor(color) || !isHexColor(paper) ? color : mixColors(color, paper, dim)
}

/** The selected game's score card draws above every other card. */
export const selectedStacking = Math.max(...Object.values(stacking)) + 1

/**
 * How far across the widest small pin shows, by the widest glow in the theme. Its glow is blurred to
 * nothing at its edge, so only about the inner 60% of it shows.
 */
export function smallPinWidth(theme: Theme): number {
  const { live, upcoming, final } = theme.components.Pin
  return Math.round(2 * 0.6 * Math.max(...[live, upcoming, final].map((look) => look.glow.radius)))
}

/** Statuses from most to least prominent: Live, then Upcoming, and Final last. */
export const statusProminence: readonly GameStatus[] = ['Live', 'Upcoming', 'Final']

/**
 * The status a group of games shows as (a card cluster or venue cluster): the most prominent
 * among them, so Final only when all its games are.
 */
export function groupStatus(statuses: readonly GameStatus[]): GameStatus {
  return statusProminence.find((s) => statuses.includes(s)) ?? 'Final'
}

/** The status a feature has of its own: a pin's game's, a trail's game's, or a card cluster's (see groupStatus). */
const ownStatus: ExpressionSpecification = ['get', 'status']
/** A style value from the look, in this theme, of the status a feature shows as (ownStatus). */
export function byStatus(theme: Theme, value: (look: StatusLook) => number | string | ExpressionSpecification): ExpressionSpecification {
  // A match needs a fallback; every status has its own arm, so it's never used.
  return [
    'match',
    ownStatus,
    ...statusProminence.flatMap((s) => [s, value(statusLook(theme, s))]),
    value(statusLook(theme, 'Final')),
  ] as ExpressionSpecification
}
