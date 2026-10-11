// PROTOTYPE, throw away: how far a score card may travel from its venue before joining a card cluster.
// Four variants on the real map, switchable via `?variant=` and the floating bar (CardReachSwitcher).

export interface ReachVariant {
  key: string
  name: string
  /** How far a card may be moved, in pixels, on a map this size. */
  reach: (width: number, height: number) => number
  /** Whether a moved card must stay wholly on screen. */
  onScreen: boolean
}

export const reachVariants: ReachVariant[] = [
  { key: 'Now', name: 'Now: 160 px', reach: () => 160, onScreen: false },
  { key: 'A', name: 'A: no limit', reach: (width, height) => Math.hypot(width, height), onScreen: true },
  { key: 'B', name: 'B: 400 px', reach: () => 400, onScreen: true },
  { key: 'C', name: 'C: half the map height', reach: (_, height) => height / 2, onScreen: true },
]

export function currentReachVariant(): ReachVariant {
  const key = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('variant')
  return reachVariants.find((variant) => variant.key === key) ?? reachVariants[0]
}

/** What the last layout came to, for the switcher to show. */
export const reachStats = { reach: 0, cards: 0, clustered: 0, clusters: 0, longestTrail: 0 }
