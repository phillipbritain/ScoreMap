import type { Feature, Point } from 'geojson'

/**
 * How far apart games at the same spot are spread, in metres. Past `clusterMaxZoom` (14) pins no
 * longer cluster; at zoom 15 this is well over a score card's width (about 110 px at roughly
 * 2.4 m per pixel), so each game gets a card of its own without the fan-out drifting far from the venue.
 */
export const colocatedSeparationMetres = 400

const metresPerDegree = 111_320

/**
 * Spreads games that share exact coordinates (a doubleheader, a tournament venue, games placed by
 * the same home city or the last-resort 0,0) evenly around a small circle centred on that spot, so
 * clusters can split and each game can be selected. Games alone at their spot stay exactly where they
 * are. The order around the circle follows the game id, so a game keeps its place from one update to
 * the next whatever order the games arrive in.
 */
export function fanOutColocated<P extends { gameId: string }>(
  features: readonly Feature<Point, P>[],
): Feature<Point, P>[] {
  const groups = new Map<string, Feature<Point, P>[]>()
  for (const feature of features) {
    const key = feature.geometry.coordinates.join(',')
    groups.set(key, [...(groups.get(key) ?? []), feature])
  }

  const moved = new Map<Feature<Point, P>, [number, number]>()
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const [lng, lat] = group[0].geometry.coordinates
    const radius = colocatedSeparationMetres / (2 * Math.sin(Math.PI / group.length))
    const metresPerDegreeLng = metresPerDegree * Math.max(Math.cos((lat * Math.PI) / 180), 0.01)
    const ordered = [...group].sort((a, b) => (a.properties.gameId < b.properties.gameId ? -1 : 1))
    ordered.forEach((feature, i) => {
      const bearing = (2 * Math.PI * i) / group.length
      moved.set(feature, [
        lng + (radius * Math.sin(bearing)) / metresPerDegreeLng,
        lat + (radius * Math.cos(bearing)) / metresPerDegree,
      ])
    })
  }

  return features.map((feature) => {
    const coordinates = moved.get(feature)
    return coordinates ? { ...feature, geometry: { ...feature.geometry, coordinates } } : feature
  })
}
