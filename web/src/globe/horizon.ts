import {
  LngLat,
  type ExpressionSpecification,
  type GeoJSONFeature,
  type LngLatLike,
  type Map as MapLibreMap,
} from 'maplibre-gl'
import { degreesApart, radians, type GlobePoint } from './geo'

/**
 * True when a place is on the far side of the globe from the viewer, behind its horizon. MapLibre
 * hides what it draws there itself; this is for what goes over the map (score cards) or is laid out
 * around what it draws (place names). It's MapLibre's own check, the one that fades markers there.
 */
export function isBehindGlobe(map: MapLibreMap, lngLat: LngLatLike): boolean {
  return map._camera.transform.isLocationOccluded(LngLat.convert(lngLat))
}

/**
 * Where the viewer looks at the globe from: the point at the center of the view, and how far the
 * camera is from the globe's center, in globe radii. The globe is never tilted, so the camera is
 * straight above the center of the view.
 */
export interface GlobeView {
  center: GlobePoint
  cameraDistance: number
}

/** The map's view of the globe now. */
export function globeView(map: MapLibreMap): GlobeView {
  const { lng: longitude, lat: latitude } = map.getCenter()
  const transform = map._camera.transform
  // MapLibre's globe radius in pixels (its getGlobeRadiusPixels), and the camera that far and the
  // center-of-view distance from the globe's center.
  const radius = transform.worldSize / (2 * Math.PI) / Math.cos(Math.min(Math.abs(latitude), 85) * radians)
  return { center: { longitude, latitude }, cameraDistance: 1 + transform.cameraToCenterDistance / radius }
}

/**
 * How much a small patch of the globe at `point` is squashed on screen by facing away from the
 * viewer: 1 facing them square on, falling to 0 at the horizon and below it beyond. It's the cosine
 * of the angle between the ground there and the line to the camera.
 */
export function foreshortening({ center, cameraDistance: d }: GlobeView, point: GlobePoint): number {
  const toCenter = Math.cos(degreesApart(center, point) * radians)
  return (d * toCenter - 1) / Math.sqrt(d * d - 2 * d * toCenter + 1)
}

/**
 * Between what foreshortening (see foreshortening) place names, small pins and pin clusters fade
 * out toward the horizon: shown whole down to `shown`, gone from `gone`. Squashed further, they'd
 * crowd into an unreadable pile along the globe's edge. Looking straight down at zoom 3 that's from
 * about 40° to 50° from the center of the view, as far as score cards reach (see cardRadius) and a
 * little past it; zoomed in, where less of the globe shows, it comes nearer the center.
 */
export const horizonFadeBand = { shown: 0.6, gone: 0.4 } as const

/**
 * How much of a place name, small pin or pin cluster at `point` shows, from 1 (all of it) to 0
 * (none), as it nears the horizon (see horizonFadeBand).
 */
export function horizonFade(view: GlobeView, point: GlobePoint): number {
  const { shown, gone } = horizonFadeBand
  return Math.max(0, Math.min(1, (foreshortening(view, point) - gone) / (shown - gone)))
}

/** Whether a place name, small pin or pin cluster at `point` has faded out entirely near the horizon. */
export function fadedOut(map: MapLibreMap, [longitude, latitude]: [number, number]): boolean {
  return horizonFade(globeView(map), { longitude, latitude }) === 0
}

/** The feature state holding how much of a feature shows near the horizon (see fadeNearHorizon). */
const fadeState = 'horizonFade'

/** An opacity times how much of the feature shows near the horizon (all of it until fadeNearHorizon says). */
export function fadedByHorizon(opacity: number | ExpressionSpecification = 1): ExpressionSpecification {
  return ['*', opacity, ['coalesce', ['feature-state', fadeState], 1]]
}

// A change in fade smaller than this isn't worth setting.
const fadeStep = 0.02

/**
 * Fades the features of these GeoJSON sources as they near the horizon, frame by frame (see
 * horizonFade), through a feature state their layers' opacities read (see fadedByHorizon), but for
 * those `whole` says to show whole in this view. Each feature, a pin cluster included, needs an id.
 * A feature in tiles new this frame shows whole for the frame. Returns a function that stops it.
 */
export function fadeNearHorizon(
  map: MapLibreMap,
  sources: readonly string[],
  whole: (source: string, id: string | number, view: GlobeView) => boolean = () => false,
): () => void {
  // The fade last set on each feature, by source.
  const set = new Map<string, Map<string | number, number>>(sources.map((source) => [source, new Map()]))
  const fade = () => {
    const view = globeView(map)
    for (const source of sources) {
      if (!map.getSource(source)) continue
      const was = set.get(source)!
      for (const feature of map.querySourceFeatures(source) as GeoJSONFeature[]) {
        const id = feature.id
        if (id === undefined || feature.geometry.type !== 'Point') continue
        const [longitude, latitude] = feature.geometry.coordinates
        const now = whole(source, id, view) ? 1 : horizonFade(view, { longitude, latitude })
        const before = was.get(id)
        if (before !== undefined && (before === now || (Math.abs(before - now) < fadeStep && now !== 0 && now !== 1))) continue
        was.set(id, now)
        map.setFeatureState({ source, id }, { [fadeState]: now })
      }
    }
  }
  // A new style has fresh sources, with no feature state.
  const forget = () => {
    for (const was of set.values()) was.clear()
  }
  map.on('render', fade)
  map.on('style.load', forget)
  return () => {
    map.off('render', fade)
    map.off('style.load', forget)
  }
}
