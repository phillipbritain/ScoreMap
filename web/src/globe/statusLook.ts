import type { ExpressionSpecification } from 'maplibre-gl'
import type { GameStatus } from '../games/game'
import { statusKey, type Theme } from '../theme/theme'

/**
 * How a game's status shows on the globe. Live stands out most, Upcoming is dimmer, Final fades and
 * Disrupted is greyed out, alike on small pins, score cards, pin clusters and card clusters. Each
 * status's look comes from the theme, gathered here from where it sits there: its colour from the
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
export const stacking: Readonly<Record<GameStatus, number>> = { Live: 2, Upcoming: 1, Final: 0, Disrupted: 0 }

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

/** The selected game's score card draws above every other card. */
export const selectedStacking = Math.max(...Object.values(stacking)) + 1

/**
 * How far across the widest small pin shows, by the widest glow in the theme. Its glow is blurred to
 * nothing at its edge, so only about the inner 60% of it shows.
 */
export function smallPinWidth(theme: Theme): number {
  return Math.round(2 * 0.6 * Math.max(...Object.values(theme.components.Pin).map((look) => look.glow.radius)))
}

/** Statuses from most to least prominent: Live, then Upcoming, then Final, and Disrupted last. */
export const statusProminence: readonly GameStatus[] = ['Live', 'Upcoming', 'Final', 'Disrupted']

/**
 * The status a group of games shows as (a pin cluster or a card cluster): the most prominent
 * among them, so Disrupted only when all its games are.
 */
export function groupStatus(statuses: readonly GameStatus[]): GameStatus {
  return statusProminence.find((s) => statuses.includes(s)) ?? 'Disrupted'
}

/** The status a feature has of its own: a pin's game's, a trail's game's, or a card cluster's (see groupStatus). */
const ownStatus: ExpressionSpecification = ['get', 'status']
const countOf = (s: GameStatus): ExpressionSpecification => ['+', ['case', ['==', ownStatus, s], 1, 0]]

/** The counts of each status the pin source keeps for a pin cluster, which pinClusterStatus reads. */
export const pinClusterStatusCounts = Object.fromEntries(
  statusProminence.slice(0, -1).map((s) => [s.toLowerCase(), countOf(s)]),
) as Record<string, ExpressionSpecification>

/** groupStatus as a style expression, for a pin cluster from its counts (see pinClusterStatusCounts). */
export const pinClusterStatus: ExpressionSpecification = [
  'case',
  ...statusProminence.slice(0, -1).flatMap((s) => [['>', ['get', s.toLowerCase()], 0], s]),
  'Disrupted',
] as ExpressionSpecification

/**
 * A style value from the look, in this theme, of the status a feature shows as: its own (ownStatus),
 * or a pin cluster's from its counts (pinClusterStatus).
 */
export function byStatus(
  theme: Theme,
  status: 'own' | 'pinCluster',
  value: (look: StatusLook) => number | string | ExpressionSpecification,
): ExpressionSpecification {
  // A match needs a fallback; every status has its own arm, so it's never used.
  return [
    'match',
    status === 'own' ? ownStatus : pinClusterStatus,
    ...statusProminence.flatMap((s) => [s, value(statusLook(theme, s))]),
    value(statusLook(theme, 'Final')),
  ] as ExpressionSpecification
}
