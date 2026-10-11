// PROTOTYPE, throw away: trails drawn as a MapLibre line layer beneath the place names, so every city,
// state and country name draws over any trail that crosses it. Replaces the SVG trails' lines (the SVG
// still draws the venue's point and ring).
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { GameStatus } from '../games/game'
import type { Segment } from './cardLayout'
import { firstPlaceNameLayer } from './placeNames'

const source = 'prototype-trails'
const statuses: GameStatus[] = ['Live', 'Upcoming', 'Final', 'Disrupted']
let last = ''

export function drawTrailLayer(map: MapLibreMap, trails: { segment: Segment; status: GameStatus }[]): void {
  Object.assign(window, { trailMap: map, trailCount: trails.length })
  if (!map.isStyleLoaded() && !map.getSource(source)) return
  const key = JSON.stringify(trails.map(({ segment: s, status }) => [Math.round(s.x1), Math.round(s.y1), Math.round(s.x2), Math.round(s.y2), status]))
  if (key === last && map.getSource(source)) return
  last = key
  const data: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: trails.map(({ segment: s, status }) => ({
      type: 'Feature',
      properties: { status },
      geometry: {
        type: 'LineString',
        coordinates: [map.unproject([s.x1, s.y1]).toArray(), map.unproject([s.x2, s.y2]).toArray()],
      },
    })),
  }
  const existing = map.getSource(source) as { setData(data: GeoJSON.FeatureCollection): void } | undefined
  if (existing) {
    existing.setData(data)
    return
  }
  map.addSource(source, { type: 'geojson', data })
  const root = getComputedStyle(document.documentElement)
  const css = (name: string) => root.getPropertyValue(name).trim()
  const byStatus = (property: (status: string) => string | number, fallback: string | number) =>
    ['match', ['get', 'status'], ...statuses.flatMap((status) => [status, property(status.toLowerCase())]), fallback] as never
  const color = byStatus((status) => css(`--${status}-color`) || '#ff7a3d', '#ff7a3d')
  const opacity = byStatus((status) => Number(css(`--${status}-group-opacity`) || 1) * 0.9, 0.9)
  const below = firstPlaceNameLayer(map.getStyle())
  // A soft glow beneath the line, like the SVG trail's drop shadow.
  map.addLayer(
    { id: `${source}-glow`, type: 'line', source, paint: { 'line-color': color, 'line-width': 4, 'line-blur': 3, 'line-opacity': 0.35 } },
    below,
  )
  map.addLayer({ id: source, type: 'line', source, paint: { 'line-color': color, 'line-width': 1.25, 'line-opacity': opacity } }, below)
}
