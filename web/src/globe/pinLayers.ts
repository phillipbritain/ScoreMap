import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  GeoJSONSourceSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'
import { mapFonts } from './placeNames'
import { byStatus, pinClusterStatusCounts, groupFill, groupGlowOpacity, groupOutline, smallPinWidth } from './statusLook'
import { cardZoom, clusterMaxZoom, pinLayout } from './zoomLevels'

export const pinSource = 'pins'
export const pinClusterLayer = 'pin-clusters'
export const smallPinLayer = 'pins'

export function pinSourceSpec(data: GeoJSONSourceSpecification['data'], zoom: number): GeoJSONSourceSpecification {
  const { size, clusterRadius } = pinLayout(zoom)
  return {
    type: 'geojson',
    data,
    cluster: size === 'small',
    clusterRadius,
    clusterMaxZoom,
    // Counts by status, for the status a pin cluster shows as (see statusLook's pinClusterStatus).
    clusterProperties: pinClusterStatusCounts,
  }
}

/** Pin clusters: dark discs outlined and lit in their status colour, with the count in it too (see groupFill). */
export const pinClusterLayers: [CircleLayerSpecification, CircleLayerSpecification, SymbolLayerSpecification] = [
  {
    id: 'pin-cluster-glows',
    type: 'circle',
    source: pinSource,
    filter: ['has', 'point_count'],
    paint: {
      'circle-radius': byCount(22, 26, 32),
      'circle-color': byStatus('pinCluster', (look) => look.color),
      'circle-blur': 1,
      'circle-opacity': byStatus('pinCluster', (look) => look.groupOpacity * groupGlowOpacity),
    },
  },
  {
    id: pinClusterLayer,
    type: 'circle',
    source: pinSource,
    filter: ['has', 'point_count'],
    layout: { 'circle-sort-key': byStatus('pinCluster', (look) => look.stacking) },
    paint: {
      'circle-radius': byCount(11, 13, 16),
      'circle-color': groupFill,
      'circle-stroke-width': groupOutline,
      'circle-stroke-color': byStatus('pinCluster', (look) => look.color),
      'circle-stroke-opacity': byStatus('pinCluster', (look) => look.groupOpacity),
    },
  },
  {
    id: 'pin-cluster-counts',
    type: 'symbol',
    source: pinSource,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': [mapFonts.bold.name],
      'text-size': 11,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': byStatus('pinCluster', (look) => look.color) },
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
      'circle-radius': byStatus('own', (look) => look.glowRadius),
      'circle-color': byStatus('own', (look) => look.color),
      'circle-blur': 1,
      'circle-opacity': byStatus('own', (look) => look.glowOpacity),
    },
  },
  {
    id: smallPinLayer,
    type: 'circle',
    source: pinSource,
    filter: ['!', ['has', 'point_count']],
    maxzoom: cardZoom,
    layout: { 'circle-sort-key': byStatus('own', (look) => look.stacking) },
    paint: {
      'circle-radius': byStatus('own', (look) => look.coreRadius),
      'circle-color': byStatus('own', (look) => look.coreColor),
      'circle-opacity': byStatus('own', (look) => look.coreOpacity),
      'circle-stroke-width': byStatus('own', (look) => look.coreRing),
      'circle-stroke-color': byStatus('own', (look) => look.color),
    },
  },
]

/** A pin cluster's size by how many games are in it: up to 4, up to 14, and more. */
function byCount(small: number, medium: number, large: number): ExpressionSpecification {
  return ['step', ['get', 'point_count'], small, 5, medium, 15, large]
}

/**
 * Invisible stand-ins for the small pins, as far across as the widest small pin shows (see
 * smallPinWidth), with a pixel's margin each side. Circle layers take no part in label placement, so
 * these give place names something to avoid: a name that would fall under a pin moves to another side
 * of its dot (see placeNames' city names), or is left out if no side is free. Score cards have theirs
 * too (see cardLayoutLayers' cardFootprint). Pin clusters have none: a name too close to fit beside
 * one would be lost, so it's written across the pin cluster instead (place names draw above the
 * pins). Footprints draw nothing.
 */
export const pinFootprint = { image: 'pin-footprint', size: smallPinWidth + 2 }

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
