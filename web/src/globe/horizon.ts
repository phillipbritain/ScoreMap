import { LngLat, type LngLatLike, type Map as MapLibreMap } from 'maplibre-gl'

/**
 * True when a place is on the far side of the globe from the viewer, behind its horizon. MapLibre
 * hides what it draws there itself; this is for what goes over the map (score cards) or is laid out
 * around what it draws (place names). It's MapLibre's own check, the one that fades markers there.
 */
export function isBehindGlobe(map: MapLibreMap, lngLat: LngLatLike): boolean {
  return map._camera.transform.isLocationOccluded(LngLat.convert(lngLat))
}
