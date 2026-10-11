// PROTOTYPE, throw away: how far a score card may travel from its venue before joining a card cluster.
// Four variants on the real map, switchable via `?variant=` and the floating bar (CardReachSwitcher).

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
}

export const reachVariants: ReachVariant[] = [
  { key: 'Now', name: 'Now: 160 px, trails avoid names', reach: () => 160, onScreen: false, trailsCross: 'none', namesOverTrails: false },
  { key: 'B', name: 'B: 400 px, trails avoid names', reach: () => 400, onScreen: true, trailsCross: 'none', namesOverTrails: true },
  { key: 'Ba', name: 'B + (a): trails cross their own city name', reach: () => 400, onScreen: true, trailsCross: 'own', namesOverTrails: true },
  { key: 'Bb', name: 'B + (b): trails cross any name', reach: () => 400, onScreen: true, trailsCross: 'any', namesOverTrails: true },
]

export function currentReachVariant(): ReachVariant {
  const key = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('variant')
  return reachVariants.find((variant) => variant.key === key) ?? reachVariants[0]
}

/** What the last layout came to, for the switcher to show. */
export const reachStats = { reach: 0, cards: 0, clustered: 0, clusters: 0, longestTrail: 0 }
