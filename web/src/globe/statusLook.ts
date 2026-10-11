import type { ExpressionSpecification } from 'maplibre-gl'
import type { GameStatus } from '../games/game'

/**
 * How a game's status shows on the globe. Live stands out most, Upcoming is dimmer, Final fades and
 * Disrupted is greyed out, alike on small pins, score cards, pin clusters and card clusters. Map layers read
 * these through style expressions (see byStatus), and the page's CSS through custom properties (see
 * applyStatusLook).
 */
interface StatusLook {
  color: string
  /** Which draws on top where pins or score cards overlap: highest first. */
  stacking: number
  /**
   * A small pin is a bright core in a soft glow of the status colour, like a city's lights seen
   * from orbit. The core's radius, colour and opacity, and the width of the ring of status colour
   * around it, in pixels.
   */
  coreRadius: number
  coreColor: string
  coreOpacity: number
  coreRing: number
  /** The glow's radius in pixels, out to where it has faded to nothing, and how opaque it is at its middle. */
  glowRadius: number
  glowOpacity: number
  /** A cluster's opacity, pin or card, when it shows as this status. */
  groupOpacity: number
}

export const statusLooks: Record<GameStatus, StatusLook> = {
  Live: {
    color: '#e4572e',
    stacking: 2,
    // Hottest at the middle.
    coreRadius: 3.5,
    coreColor: '#ffd9c8',
    coreOpacity: 1,
    coreRing: 1.5,
    glowRadius: 15,
    glowOpacity: 0.7,
    groupOpacity: 1,
  },
  Upcoming: {
    color: '#f2a541',
    stacking: 1,
    coreRadius: 3,
    coreColor: '#f2a541',
    coreOpacity: 0.8,
    coreRing: 0,
    glowRadius: 10,
    glowOpacity: 0.45,
    groupOpacity: 0.85,
  },
  Final: {
    color: '#8a8f98',
    stacking: 0,
    coreRadius: 2.5,
    coreColor: '#8a8f98',
    coreOpacity: 0.55,
    coreRing: 0,
    glowRadius: 7,
    glowOpacity: 0.25,
    groupOpacity: 0.6,
  },
  Disrupted: {
    color: '#c3c6cc',
    stacking: 0,
    coreRadius: 2.5,
    coreColor: '#c3c6cc',
    coreOpacity: 0.6,
    coreRing: 0,
    glowRadius: 7,
    glowOpacity: 0.25,
    groupOpacity: 0.6,
  },
}

/**
 * A cluster, pin or card, is a dark disc like a score card, outlined and
 * lit in its status colour: this fill, an outline this wide, and a glow this much of its opacity.
 */
export const groupFill = 'rgba(6, 12, 24, 0.88)'
export const groupOutline = 1.5
export const groupGlowOpacity = 0.45

/** The selected game's small pin ring and score card outline. */
export const selectionColor = '#2f80ed'

/** The selected game's score card draws above every other card. */
export const selectedStacking = Math.max(...Object.values(statusLooks).map((look) => look.stacking)) + 1

/**
 * How far across the widest small pin (a Live one) shows. Its glow is blurred to nothing at its
 * edge, so only about the inner 60% of it shows.
 */
export const smallPinWidth = Math.round(2 * 0.6 * Math.max(...Object.values(statusLooks).map((look) => look.glowRadius)))

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
 * A style value from the look of the status a feature shows as: its own (ownStatus), or a pin
 * cluster's from its counts (pinClusterStatus).
 */
export function byStatus(
  status: 'own' | 'pinCluster',
  value: (look: StatusLook) => number | string,
): ExpressionSpecification {
  // A match needs a fallback; every status has its own arm, so it's never used.
  return [
    'match',
    status === 'own' ? ownStatus : pinClusterStatus,
    ...statusProminence.flatMap((s) => [s, value(statusLooks[s])]),
    value(statusLooks.Final),
  ] as ExpressionSpecification
}

/**
 * Writes the looks to CSS custom properties on the page's root, for score cards: --live-color for
 * Live, and so on, and --selection-color.
 */
export function applyStatusLook(root: { style: Pick<CSSStyleDeclaration, 'setProperty'> }): void {
  for (const [status, look] of Object.entries(statusLooks)) root.style.setProperty(`--${status.toLowerCase()}-color`, look.color)
  root.style.setProperty('--selection-color', selectionColor)
}
