import type { Feature, Point } from 'geojson'

/** Where to place one game's score card. */
export interface CardPin {
  gameId: string
  lngLat: [number, number]
}

/**
 * Picks the individual pins (not pin clusters) out of features queried from the pin source,
 * once per game: a source query returns a pin again for every map tile it falls in.
 */
export function cardPins(features: readonly Feature<Point>[]): CardPin[] {
  const pins = new Map<string, CardPin>()
  for (const { geometry, properties } of features) {
    if (properties?.cluster) continue
    const gameId = properties?.gameId
    if (typeof gameId !== 'string' || pins.has(gameId)) continue
    const [lng, lat] = geometry.coordinates
    pins.set(gameId, { gameId, lngLat: [lng, lat] })
  }
  return [...pins.values()]
}
