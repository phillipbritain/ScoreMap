import type { ExpressionSpecification } from 'maplibre-gl'
import type { GameStatus } from '../games/game'

/**
 * How a game's status shows on the globe. Live stands out most, Upcoming is dimmer, Final fades and
 * Disrupted is greyed out, alike on small pins, clusters, score cards and crowds. Map layers read
 * these through style expressions (see byStatus), and the page's CSS through custom properties (see
 * applyStatusLook).
 */
interface StatusLook {
  color: string
  /** Which draws on top where pins or score cards overlap: highest first. */
  stacking: number
  /** A small pin's radius and the width of its white outline, in pixels, and how opaque each is. */
  pinRadius: number
  pinOutline: number
  pinOpacity: number
  pinOutlineOpacity: number
  /** A group's (a cluster's or a crowd's) outline and opacity, when it shows as this status. */
  groupOutline: number
  groupOpacity: number
}

export const statusLooks: Record<GameStatus, StatusLook> = {
  Live: {
    color: '#e4572e',
    stacking: 2,
    pinRadius: 7,
    pinOutline: 2,
    pinOpacity: 1,
    pinOutlineOpacity: 1,
    groupOutline: 2.5,
    groupOpacity: 1,
  },
  Upcoming: {
    color: '#f2a541',
    stacking: 1,
    pinRadius: 5,
    pinOutline: 1.5,
    pinOpacity: 0.8,
    pinOutlineOpacity: 1,
    groupOutline: 1.5,
    groupOpacity: 0.85,
  },
  Final: {
    color: '#8a8f98',
    stacking: 0,
    pinRadius: 4,
    pinOutline: 1.5,
    pinOpacity: 0.55,
    pinOutlineOpacity: 0.55,
    groupOutline: 1.5,
    groupOpacity: 0.6,
  },
  Disrupted: {
    color: '#c3c6cc',
    stacking: 0,
    pinRadius: 4,
    pinOutline: 1.5,
    pinOpacity: 0.6,
    pinOutlineOpacity: 0.6,
    groupOutline: 1.5,
    groupOpacity: 0.6,
  },
}

/** The selected game's small pin ring and score card outline. */
export const selectionColor = '#2f80ed'

/** The selected game's score card draws above every other card, and crowds above all, so a count is never hidden. */
export const selectedStacking = Math.max(...Object.values(statusLooks).map((look) => look.stacking)) + 1
export const crowdStacking = selectedStacking + 1

/** The widest small pin, outline included: a Live one. */
export const smallPinWidth = Math.max(...Object.values(statusLooks).map((look) => 2 * (look.pinRadius + look.pinOutline)))

/** Statuses from most to least prominent: Live, then Upcoming, then Final, and Disrupted last. */
export const statusProminence: readonly GameStatus[] = ['Live', 'Upcoming', 'Final', 'Disrupted']

/**
 * The status a group of games shows as (a cluster, or a crowd of score cards): the most prominent
 * among them, so Disrupted only when all its games are.
 */
export function groupStatus(statuses: readonly GameStatus[]): GameStatus {
  return statusProminence.find((s) => statuses.includes(s)) ?? 'Disrupted'
}

const pinStatus: ExpressionSpecification = ['get', 'status']
const countOf = (s: GameStatus): ExpressionSpecification => ['+', ['case', ['==', pinStatus, s], 1, 0]]

/** The counts of each status the pin source keeps for a cluster, which clusterStatus reads. */
export const clusterStatusCounts = Object.fromEntries(
  statusProminence.slice(0, -1).map((s) => [s.toLowerCase(), countOf(s)]),
) as Record<string, ExpressionSpecification>

/** groupStatus as a style expression, for a cluster from its counts (see clusterStatusCounts). */
export const clusterStatus: ExpressionSpecification = [
  'case',
  ...statusProminence.slice(0, -1).flatMap((s) => [['>', ['get', s.toLowerCase()], 0], s]),
  'Disrupted',
] as ExpressionSpecification

/** A style value from the look of the status a pin (pinStatus) or a cluster (clusterStatus) shows as. */
export function byStatus(
  status: 'pin' | 'cluster',
  value: (look: StatusLook) => number | string,
): ExpressionSpecification {
  return [
    'match',
    status === 'pin' ? pinStatus : clusterStatus,
    'Live',
    value(statusLooks.Live),
    'Upcoming',
    value(statusLooks.Upcoming),
    'Disrupted',
    value(statusLooks.Disrupted),
    value(statusLooks.Final),
  ]
}

/**
 * Writes the looks to CSS custom properties on the page's root, for score cards, crowds and trails:
 * --live-color, --live-group-outline and --live-group-opacity for Live, and so on, and --selection-color.
 */
export function applyStatusLook(root: { style: Pick<CSSStyleDeclaration, 'setProperty'> }): void {
  for (const [status, look] of Object.entries(statusLooks)) {
    const name = status.toLowerCase()
    root.style.setProperty(`--${name}-color`, look.color)
    root.style.setProperty(`--${name}-group-outline`, `${look.groupOutline}px`)
    root.style.setProperty(`--${name}-group-opacity`, String(look.groupOpacity))
  }
  root.style.setProperty('--selection-color', selectionColor)
}
