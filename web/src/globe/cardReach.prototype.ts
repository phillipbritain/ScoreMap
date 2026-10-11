import type { PinsAndNames } from './pinsAndNames.prototype'

// PROTOTYPE, throw away: how far a score card may travel from its venue before joining a card cluster.
// Variants on the real map, switchable via `?variant=` and the floating bar (CardReachSwitcher).

export interface ReachVariant {
  key: string
  name: string
  /** How far a card may be moved, in pixels, on a map this size. */
  reach: (width: number, height: number) => number
  /** Whether a moved card must stay wholly on screen. */
  onScreen: boolean
  /** Which city names a trail may cross: none (unless the name covers its venue), its own city's, or any. */
  trailsCross: 'none' | 'own' | 'any'
  /** Whether trails are drawn beneath the map's names (a line layer) rather than over them (SVG). */
  namesOverTrails: boolean
  /** What gives way where a pin overlaps a name (see pinsAndNames.prototype). */
  pinsAndNames: PinsAndNames
}

const bb = { reach: () => 400, onScreen: true, trailsCross: 'any', namesOverTrails: true } as const
export const reachVariants: ReachVariant[] = [
  { key: 'Now', name: 'Now: as on main', reach: () => 160, onScreen: false, trailsCross: 'none', namesOverTrails: false, pinsAndNames: 'today' },
  { key: 'Bb', name: 'Bb: pins over names, as today', ...bb, pinsAndNames: 'today' },
  { key: 'Bb-a', name: 'Bb + (a): names draw over pins', ...bb, pinsAndNames: 'a' },
  { key: 'Bb-b', name: 'Bb + (b): names move aside, or hide', ...bb, pinsAndNames: 'b' },
  { key: 'Bb-c', name: 'Bb + (c): names move aside, else draw over', ...bb, pinsAndNames: 'c' },
]

export function currentReachVariant(): ReachVariant {
  const key = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('variant')
  return reachVariants.find((variant) => variant.key === key) ?? reachVariants[0]
}

/** What the last layout came to, for the switcher to show. */
export const reachStats = { reach: 0, cards: 0, clustered: 0, clusters: 0, longestTrail: 0 }
