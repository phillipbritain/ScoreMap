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
  /** A group's (a cluster's or a crowd's) opacity, when it shows as this status. */
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
 * A group (a cluster, or a crowd of score cards) is a dark disc like a HUD score card, outlined and
 * lit in its status colour: this fill, an outline this wide, and a glow this much of its opacity.
 */
export const groupFill = 'rgba(6, 12, 24, 0.88)'
export const groupOutline = 1.5
export const groupGlowOpacity = 0.45

/** The selected game's small pin ring and score card outline. */
export const selectionColor = '#2f80ed'

/** The selected game's score card draws above every other card, and crowds above all, so a count is never hidden. */
export const selectedStacking = Math.max(...Object.values(statusLooks).map((look) => look.stacking)) + 1
export const crowdStacking = selectedStacking + 1

/**
 * How far across the widest small pin (a Live one) shows. Its glow is blurred to nothing at its
 * edge, so only about the inner 60% of it shows.
 */
export const smallPinWidth = Math.round(2 * 0.6 * Math.max(...Object.values(statusLooks).map((look) => look.glowRadius)))

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
  // A match needs a fallback; every status has its own arm, so it's never used.
  return [
    'match',
    status === 'pin' ? pinStatus : clusterStatus,
    ...statusProminence.flatMap((s) => [s, value(statusLooks[s])]),
    value(statusLooks.Final),
  ] as ExpressionSpecification
}

/**
 * Writes the looks to CSS custom properties on the page's root, for score cards, crowds and trails:
 * --live-color and --live-group-opacity for Live, and so on, --group-fill and --group-outline, and
 * --selection-color.
 */
export function applyStatusLook(root: { style: Pick<CSSStyleDeclaration, 'setProperty'> }): void {
  for (const [status, look] of Object.entries(statusLooks)) {
    const name = status.toLowerCase()
    root.style.setProperty(`--${name}-color`, look.color)
    root.style.setProperty(`--${name}-group-opacity`, String(look.groupOpacity))
  }
  root.style.setProperty('--group-fill', groupFill)
  root.style.setProperty('--group-outline', `${groupOutline}px`)
  root.style.setProperty('--selection-color', selectionColor)
}
