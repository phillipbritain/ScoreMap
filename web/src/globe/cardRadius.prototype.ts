// PROTOTYPE, throwaway: score cards only within a fixed arc of the view's centre, small pins (clustered
// among themselves) beyond it. Three radii to compare by eye, switchable with ?variant= (see
// PrototypeSwitcher); "today" is the app as it is, for comparison. Not for main.
import type {
  GeoJSONSource,
  LayerSpecification,
  LngLatLike,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from 'maplibre-gl'
import { LngLat } from 'maplibre-gl'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import type { Game } from '../games/game'
import type { Theme } from '../theme/theme'
import { pinFeatures } from './pinFeatures'
import { pinClusterLayers, pinSourceSpec, smallPinLayers } from './pinLayers'
import { smallPinWidth } from './statusLook'
import { cardZoom, pinLayout, pinSize } from './zoomLevels'

export const variants = [
  { key: 'A', name: '25°', radius: 25 },
  { key: 'B', name: '30°', radius: 30 },
  { key: 'C', name: '40°', radius: 40 },
  { key: 'today', name: 'today: no limit', radius: Infinity },
] as const

export type VariantKey = (typeof variants)[number]['key']

const listeners = new Set<() => void>()

export function currentVariant(): (typeof variants)[number] {
  const key = new URLSearchParams(window.location.search).get('variant') ?? 'B'
  return variants.find((variant) => variant.key === key) ?? variants[1]
}

export function setVariant(key: VariantKey): void {
  const url = new URL(window.location.href)
  url.searchParams.set('variant', key)
  window.history.replaceState(null, '', url)
  for (const listener of listeners) listener()
}

export function onVariantChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const metresPerDegree = (6371008.8 * Math.PI) / 180

/** Whether a venue is within the variant's arc of the view's centre. */
export function withinCardRadius(map: MapLibreMap, lngLat: LngLatLike): boolean {
  const { radius } = currentVariant()
  if (radius === Infinity) return true
  return map.getCenter().distanceTo(LngLat.convert(lngLat)) / metresPerDegree <= radius
}

const ringSource = 'card-radius-ring'

/** A circle of the variant's radius (in degrees of arc) around the view's centre; none for "today". */
function ring(map: MapLibreMap): Feature<LineString> | FeatureCollection {
  const { radius } = currentVariant()
  if (radius === Infinity) return { type: 'FeatureCollection', features: [] }
  const { lng, lat } = map.getCenter()
  const toRad = Math.PI / 180
  const [φ1, λ1, δ] = [lat * toRad, lng * toRad, radius * toRad]
  const coordinates: [number, number][] = []
  for (let i = 0; i <= 180; i++) {
    const θ = (i / 180) * 2 * Math.PI
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ))
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2))
    coordinates.push([λ2 / toRad, φ2 / toRad])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }
}

const outerSource = 'outer-pins'
const prefix = 'outer-'

/**
 * At card zoom, the games beyond the radius as small pins, clustered among themselves, from a source
 * of their own refreshed as the globe turns. Clicking a pin selects its game; clicking a cluster
 * centres the globe on it at the same zoom.
 */
export function addOuterPins(
  map: MapLibreMap,
  theme: Theme,
  games: () => readonly Game[],
  onSelect: (gameId: string) => void,
): void {
  // Clustered as small pins are at zoom 2.99, so pins cluster only when they'd overlap.
  map.addSource(outerSource, { ...pinSourceSpec(pinFeatures([]), pinLayout(cardZoom - 0.01, smallPinWidth(theme))), cluster: true })
  const layers = [...pinClusterLayers(theme), ...smallPinLayers(theme)].map(
    (layer): LayerSpecification => ({ ...layer, id: prefix + layer.id, source: outerSource, minzoom: cardZoom, maxzoom: 24 }),
  )
  for (const layer of layers) map.addLayer(layer)

  // The radius itself, as a ring around the view's centre.
  map.addSource(ringSource, { type: 'geojson', data: ring(map) })
  map.addLayer({
    id: ringSource,
    type: 'line',
    source: ringSource,
    minzoom: cardZoom,
    paint: { 'line-color': '#ff4fd8', 'line-width': 2, 'line-dasharray': [3, 2] },
  })
  let ringKey = ''
  const moveRing = () => {
    const { lng, lat } = map.getCenter()
    const next = `${lng},${lat},${currentVariant().radius}`
    if (next === ringKey) return
    ringKey = next
    map.getSource<GeoJSONSource>(ringSource)?.setData(ring(map))
  }
  map.on('move', moveRing)
  onVariantChange(moveRing)

  let key = ''
  const refresh = () => {
    const outer = pinSize(map.getZoom()) === 'card'
      ? games().filter((game) => !withinCardRadius(map, [game.venue.longitude, game.venue.latitude]))
      : []
    const next = outer.map((game) => game.id).join()
    if (next === key) return
    key = next
    map.getSource<GeoJSONSource>(outerSource)?.setData(pinFeatures(outer))
  }
  map.on('render', refresh)
  onVariantChange(() => {
    refresh()
    map.triggerRepaint()
  })

  map.on('click', prefix + 'pins', (event: MapLayerMouseEvent) => {
    const gameId: unknown = event.features?.[0]?.properties?.gameId
    if (typeof gameId === 'string') onSelect(gameId)
  })
  map.on('click', prefix + 'pin-clusters', (event: MapLayerMouseEvent) => {
    const cluster = event.features?.[0]
    if (cluster) map.easeTo({ center: (cluster.geometry as Point).coordinates as [number, number] })
  })
  for (const layer of [prefix + 'pins', prefix + 'pin-clusters']) {
    map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
  }
}
