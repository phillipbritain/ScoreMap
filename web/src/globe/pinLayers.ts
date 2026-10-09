import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  GeoJSONSourceSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'
import { mapFonts } from './placeNames'
import { byStatus, clusterStatusCounts, groupFill, groupGlowOpacity, groupOutline, smallPinWidth } from './statusLook'
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

/** Clusters: dark discs outlined and lit in their status colour, with the count in it too (see groupFill). */
export const clusterLayers: [CircleLayerSpecification, CircleLayerSpecification, SymbolLayerSpecification] = [
  {
    id: 'cluster-glows',
    type: 'circle',
    source: pinSource,
    filter: ['has', 'point_count'],
    paint: {
      'circle-radius': byCount(22, 26, 32),
      'circle-color': byStatus('cluster', (look) => look.color),
      'circle-blur': 1,
      'circle-opacity': byStatus('cluster', (look) => look.groupOpacity * groupGlowOpacity),
    },
  },
  {
    id: clusterLayer,
    type: 'circle',
    source: pinSource,
    filter: ['has', 'point_count'],
    layout: { 'circle-sort-key': byStatus('cluster', (look) => look.stacking) },
    paint: {
      'circle-radius': byCount(11, 13, 16),
      'circle-color': groupFill,
      'circle-stroke-width': groupOutline,
      'circle-stroke-color': byStatus('cluster', (look) => look.color),
      'circle-stroke-opacity': byStatus('cluster', (look) => look.groupOpacity),
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
      'text-size': 11,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': byStatus('cluster', (look) => look.color) },
  },
]

/**
 * Small pins for single games while zoomed out, each a bright core in a soft glow (see StatusLook);
 * zoomed in, score cards take over (see scoreCardMarkers). The glows are a layer beneath the cores,
 * so a core is never dimmed by a neighbour's glow.
 */
export const smallPinLayerSpecs: [CircleLayerSpecification, CircleLayerSpecification] = [
  {
    id: 'pin-glows',
    type: 'circle',
    source: pinSource,
    filter: ['!', ['has', 'point_count']],
    maxzoom: cardZoom,
    paint: {
      'circle-radius': byStatus('pin', (look) => look.glowRadius),
      'circle-color': byStatus('pin', (look) => look.color),
      'circle-blur': 1,
      'circle-opacity': byStatus('pin', (look) => look.glowOpacity),
    },
  },
  {
    id: smallPinLayer,
    type: 'circle',
    source: pinSource,
    filter: ['!', ['has', 'point_count']],
    maxzoom: cardZoom,
    layout: { 'circle-sort-key': byStatus('pin', (look) => look.stacking) },
    paint: {
      'circle-radius': byStatus('pin', (look) => look.coreRadius),
      'circle-color': byStatus('pin', (look) => look.coreColor),
      'circle-opacity': byStatus('pin', (look) => look.coreOpacity),
      'circle-stroke-width': byStatus('pin', (look) => look.coreRing),
      'circle-stroke-color': byStatus('pin', (look) => look.color),
    },
  },
]

/** A cluster's size by how many games are in it: up to 4, up to 14, and more. */
function byCount(small: number, medium: number, large: number): ExpressionSpecification {
  return ['step', ['get', 'point_count'], small, 5, medium, 15, large]
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
 * A small pin's is as far across as the widest small pin shows (see smallPinWidth), with a pixel's
 * margin each side.
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
