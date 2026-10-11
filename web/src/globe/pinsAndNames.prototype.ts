// PROTOTYPE, throw away: what gives way where a pin (a trail's venue point and ring, or a card cluster)
// overlaps a name. (a) the name draws over it: the pins are drawn in the map beneath the names. (b) the
// name moves aside, or hides: the pins stay above the map, and names are placed around their footprints.
// (c) both: the name moves aside where it can and draws over the pin where it can't.
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { GameStatus } from '../games/game'
import { firstPlaceNameLayer, mapFonts } from './placeNames'

export type PinsAndNames = 'today' | 'a' | 'b' | 'c'

export interface PinsOnScreen {
  /** Where moved cards' trails end, in screen pixels. */
  rings: { x: number; y: number; status: GameStatus }[]
  clusters: { x: number; y: number; count: number; status: GameStatus }[]
  /** Moved cards, by their centres: names keep clear of them where they move (b, c). */
  cards: { x: number; y: number }[]
}

const pins = 'prototype-pins'
const footprints = 'prototype-pin-footprints'
const statuses: GameStatus[] = ['Live', 'Upcoming', 'Final', 'Disrupted']
let last = ''
let namesSet = false

export function drawPinsAndNames(map: MapLibreMap, mode: PinsAndNames, onScreen: PinsOnScreen): void {
  if (mode === 'today') return
  if (!map.isStyleLoaded() && !map.getSource(pins)) return
  const key = JSON.stringify(onScreen, (_, value) => (typeof value === 'number' ? Math.round(value) : value))
  if (key === last && map.getSource(pins)) return
  last = key
  const at = (x: number, y: number) => map.unproject([x, y]).toArray()
  const point = (x: number, y: number, properties: Record<string, unknown>): GeoJSON.Feature => ({
    type: 'Feature',
    properties,
    geometry: { type: 'Point', coordinates: at(x, y) },
  })
  const pinData: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      ...onScreen.rings.map(({ x, y, status }) => point(x, y, { kind: 'ring', status })),
      ...onScreen.clusters.map(({ x, y, count, status }) => point(x, y, { kind: 'cluster', count, status })),
    ],
  }
  const footprintData: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      ...onScreen.rings.map(({ x, y }) => point(x, y, { image: 'prototype-ring-footprint' })),
      ...onScreen.clusters.map(({ x, y }) => point(x, y, { image: 'prototype-cluster-footprint' })),
      ...onScreen.cards.map(({ x, y }) => point(x, y, { image: 'prototype-card-footprint' })),
    ],
  }
  const existing = map.getSource(pins) as { setData(data: GeoJSON.FeatureCollection): void } | undefined
  if (existing) {
    existing.setData(pinData)
    ;(map.getSource(footprints) as unknown as typeof existing | undefined)?.setData(footprintData)
    return
  }

  const root = getComputedStyle(document.documentElement)
  const css = (name: string) => root.getPropertyValue(name).trim()
  const byStatus = (property: (status: string) => string | number, fallback: string | number) =>
    ['match', ['get', 'status'], ...statuses.flatMap((status) => [status, property(status.toLowerCase())]), fallback] as never
  const color = byStatus((status) => css(`--${status}-color`) || '#ff7a3d', '#ff7a3d')
  const opacity = byStatus((status) => Number(css(`--${status}-group-opacity`) || 1), 1)
  map.addSource(pins, { type: 'geojson', data: pinData })

  if (mode === 'a' || mode === 'c') {
    // Beneath the names, above the trails.
    const below = firstPlaceNameLayer(map.getStyle())
    const ring = ['==', ['get', 'kind'], 'ring'] as never
    const cluster = ['==', ['get', 'kind'], 'cluster'] as never
    map.addLayer(
      { id: `${pins}-ring`, type: 'circle', source: pins, filter: ring, paint: { 'circle-radius': 5.5, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-width': 1, 'circle-stroke-color': color } },
      below,
    )
    map.addLayer({ id: `${pins}-point`, type: 'circle', source: pins, filter: ring, paint: { 'circle-radius': 2, 'circle-color': color } }, below)
    map.addLayer(
      { id: `${pins}-cluster-glow`, type: 'circle', source: pins, filter: cluster, paint: { 'circle-radius': 20, 'circle-color': color, 'circle-blur': 1, 'circle-opacity': 0.45 } },
      below,
    )
    map.addLayer(
      {
        id: `${pins}-cluster`,
        type: 'circle',
        source: pins,
        filter: cluster,
        paint: {
          'circle-radius': 13,
          'circle-color': css('--group-fill') || '#0b1424',
          'circle-stroke-width': Number.parseFloat(css('--group-outline')) || 2,
          'circle-stroke-color': color,
          'circle-opacity': opacity,
          'circle-stroke-opacity': opacity,
        },
      },
      below,
    )
    map.addLayer(
      {
        id: `${pins}-cluster-count`,
        type: 'symbol',
        source: pins,
        filter: cluster,
        layout: { 'text-field': ['to-string', ['get', 'count']], 'text-font': [mapFonts.bold.name], 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true },
        paint: { 'text-color': color, 'text-opacity': opacity },
      },
      below,
    )
  }

  if (mode === 'b' || mode === 'c') {
    // On top, so they're placed first and names are placed around them.
    blankImage(map, 'prototype-ring-footprint', 14, 14)
    blankImage(map, 'prototype-cluster-footprint', 30, 30)
    blankImage(map, 'prototype-card-footprint', 100, 66)
    map.addSource(footprints, { type: 'geojson', data: footprintData })
    map.addLayer({
      id: footprints,
      type: 'symbol',
      source: footprints,
      layout: { 'icon-image': ['get', 'image'], 'icon-allow-overlap': true },
      paint: { 'icon-opacity': 0 },
    })
  }

  if ((mode === 'b' || mode === 'c') && !namesSet) {
    namesSet = true
    // Game cities' names may move to any side of their dot; in (b) they hide where no side is free.
    for (const layer of map.getStyle().layers.filter((l) => l.id.endsWith('_game') && l.type === 'symbol')) {
      map.setLayoutProperty(layer.id, 'text-variable-anchor', ['top', 'bottom', 'left', 'right'])
      map.setLayoutProperty(layer.id, 'text-allow-overlap', mode === 'c')
    }
  }
}

function blankImage(map: MapLibreMap, id: string, width: number, height: number) {
  if (map.hasImage(id)) return
  map.addImage(id, { width, height, data: new Uint8Array(width * height * 4) })
}
