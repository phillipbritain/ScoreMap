/** A point on the globe, in degrees. */
export interface GlobePoint {
  longitude: number
  latitude: number
}

/** Degrees to radians. */
export const radians = Math.PI / 180

/** The angle between two points, seen from the globe's centre, in degrees. */
export function degreesApart(a: GlobePoint, b: GlobePoint): number {
  // The haversine formula, which stays accurate for points close together.
  const dLat = (b.latitude - a.latitude) * radians
  const dLon = (b.longitude - a.longitude) * radians
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(dLon / 2) ** 2
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / radians
}

/** The distance between two points along the ground, in kilometres. */
export function kmApart(a: GlobePoint, b: GlobePoint): number {
  return degreesApart(a, b) * radians * earthRadiusKm
}
const earthRadiusKm = 6371
