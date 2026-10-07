import type { CircleLayerSpecification, GeoJSONSourceSpecification, SymbolLayerSpecification } from 'maplibre-gl'
import { mapFonts } from './placeNames'
import { byStatus, clusterStatusCounts, smallPinWidth } from './statusLook'
import { cardZoom, clusterMaxZoom, pinLayout } from './zoomLevels'

export const pinSource = 'pins'
export const clusterLayer = 'clusters'
export const smallPinLayer = 'pins'

export function pinSourceSpec(data: GeoJSONSourceSpecification['data'], zoom: number): GeoJSONSourceSpecification {
  const { size, clusterRadius } = pinLayout(zoom)
  return {
    type: 'geojson',
    data,
    cluster: size === 'small',
    clusterRadius,
    clusterMaxZoom,
    // Counts by status, for the status a cluster shows as (see statusLook's clusterStatus).
    clusterProperties: clusterStatusCounts,
  }
}

export const clusterLayers: [CircleLayerSpecification, SymbolLayerSpecification] = [
  {
    id: clusterLayer,
    type: 'circle',
    source: pinSource,
    filter: ['has', 'point_count'],
    layout: { 'circle-sort-key': byStatus('cluster', (look) => look.stacking) },
    paint: {
      'circle-radius': ['step', ['get', 'point_count'], 13, 5, 16, 15, 20],
      'circle-color': byStatus('cluster', (look) => look.color),
      'circle-opacity': byStatus('cluster', (look) => look.groupOpacity),
      'circle-stroke-width': byStatus('cluster', (look) => look.groupOutline),
      'circle-stroke-color': '#ffffff',
    },
  },
  {
    id: 'cluster-counts',
    type: 'symbol',
    source: pinSource,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': [mapFonts.bold.name],
      'text-size': 12,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#ffffff' },
  },
]

/** Small pins for single games while zoomed out; zoomed in, score cards take over (see scoreCardMarkers). */
export const smallPinLayerSpec: CircleLayerSpecification = {
  id: smallPinLayer,
  type: 'circle',
  source: pinSource,
  filter: ['!', ['has', 'point_count']],
  maxzoom: cardZoom,
  layout: { 'circle-sort-key': byStatus('pin', (look) => look.stacking) },
  paint: {
    'circle-radius': byStatus('pin', (look) => look.pinRadius),
    'circle-color': byStatus('pin', (look) => look.color),
    'circle-opacity': byStatus('pin', (look) => look.pinOpacity),
    'circle-stroke-width': byStatus('pin', (look) => look.pinOutline),
    'circle-stroke-color': '#ffffff',
    'circle-stroke-opacity': byStatus('pin', (look) => look.pinOutlineOpacity),
  },
}

/**
 * Invisible stand-ins for the pins, the size of what each shows: a score card zoomed in, a small pin
 * zoomed out. Score cards are page elements MapLibre can't see, and circle layers take no part in
 * label placement, so these give place names something to avoid: a name that would fall under a pin
 * moves to another side of its dot (see placeNames' city names), or is left out if no side is free.
 * Clusters have none: a name too close to fit beside one would be lost, so it's written across the
 * cluster instead (place names draw above the pins). Both draw nothing.
 *
 * A card's footprint is a typical score card with its pointer and a small margin: cards vary with
 * their teams' names and clock line, and a footprint image has one size, so it's an approximation.
 * A small pin's is the widest small pin, with a pixel's margin each side.
 */
export const cardFootprint = { image: 'card-footprint', width: 106, height: 68 }
export const pinFootprint = { image: 'pin-footprint', size: smallPinWidth + 2 }

/** Where each score card sits: above its venue, the card's size with its pointer and a small margin. */
export const cardFootprintLayerSpec: SymbolLayerSpecification = {
  id: 'card-footprints',
  type: 'symbol',
  source: pinSource,
  // Where score cards show: single pins, zoomed in.
  filter: ['!', ['has', 'point_count']],
  minzoom: cardZoom,
  layout: {
    'icon-image': cardFootprint.image,
    'icon-anchor': 'bottom',
    // Always placed, whatever else is there, and still keeps names out.
    'icon-allow-overlap': true,
  },
  paint: { 'icon-opacity': 0 },
}

/** Each small pin, while zoomed out. */
export const pinFootprintLayerSpec: SymbolLayerSpecification = {
  id: 'pin-footprints',
  type: 'symbol',
  source: pinSource,
  filter: ['!', ['has', 'point_count']],
  maxzoom: cardZoom,
  layout: { 'icon-image': pinFootprint.image, 'icon-allow-overlap': true },
  paint: { 'icon-opacity': 0 },
}
