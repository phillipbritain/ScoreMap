import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  GeoJSONSourceSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'
import type { GameStatus } from '../games/game'
import { cardZoom, clusterMaxZoom, pinLayout } from './zoomLevels'

export const pinSource = 'pins'
export const clusterLayer = 'clusters'
export const smallPinLayer = 'pins'

/**
 * Live stands out most, Upcoming is dimmer, Final fades, Disrupted is greyed out.
 * Shared by small pins, clusters and score cards.
 */
export const statusColors: Record<GameStatus, string> = {
  Live: '#e4572e',
  Upcoming: '#f2a541',
  Final: '#8a8f98',
  Disrupted: '#c3c6cc',
}

const status: ExpressionSpecification = ['get', 'status']
const countOf = (s: GameStatus): ExpressionSpecification => ['+', ['case', ['==', status, s], 1, 0]]

/**
 * A cluster takes the most prominent status among its games: Live if any is Live, then Upcoming,
 * then Final, and Disrupted only when all its games are.
 */
const clusterStatus: ExpressionSpecification = [
  'case',
  ['>', ['get', 'live'], 0],
  'Live',
  ['>', ['get', 'upcoming'], 0],
  'Upcoming',
  ['>', ['get', 'final'], 0],
  'Final',
  'Disrupted',
]

/** A style value picked by the status that `s` evaluates to (a pin's own, or a cluster's). */
const byStatus = (
  s: ExpressionSpecification,
  values: Record<GameStatus, number | string>,
): ExpressionSpecification => [
  'match',
  s,
  'Live',
  values.Live,
  'Upcoming',
  values.Upcoming,
  'Disrupted',
  values.Disrupted,
  values.Final,
]

export function pinSourceSpec(data: GeoJSONSourceSpecification['data'], zoom: number): GeoJSONSourceSpecification {
  return {
    type: 'geojson',
    data,
    cluster: true,
    clusterRadius: pinLayout(zoom).clusterRadius,
    clusterMaxZoom,
    clusterProperties: { live: countOf('Live'), upcoming: countOf('Upcoming'), final: countOf('Final') },
  }
}

export const clusterLayers: [CircleLayerSpecification, SymbolLayerSpecification] = [
  {
    id: clusterLayer,
    type: 'circle',
    source: pinSource,
    filter: ['has', 'point_count'],
    layout: { 'circle-sort-key': byStatus(clusterStatus, { Live: 2, Upcoming: 1, Final: 0, Disrupted: 0 }) },
    paint: {
      'circle-radius': ['step', ['get', 'point_count'], 13, 5, 16, 15, 20],
      'circle-color': byStatus(clusterStatus, statusColors),
      'circle-opacity': byStatus(clusterStatus, { Live: 1, Upcoming: 0.85, Final: 0.6, Disrupted: 0.6 }),
      'circle-stroke-width': byStatus(clusterStatus, { Live: 2.5, Upcoming: 1.5, Final: 1.5, Disrupted: 1.5 }),
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
      'text-font': ['Open Sans Bold'],
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
  // Live draws on top.
  layout: { 'circle-sort-key': byStatus(status, { Live: 2, Upcoming: 1, Final: 0, Disrupted: 0 }) },
  paint: {
    'circle-radius': byStatus(status, { Live: 7, Upcoming: 5, Final: 4, Disrupted: 4 }),
    'circle-color': byStatus(status, statusColors),
    'circle-opacity': byStatus(status, { Live: 1, Upcoming: 0.8, Final: 0.55, Disrupted: 0.6 }),
    'circle-stroke-width': byStatus(status, { Live: 2, Upcoming: 1.5, Final: 1.5, Disrupted: 1.5 }),
    'circle-stroke-color': '#ffffff',
    'circle-stroke-opacity': byStatus(status, { Live: 1, Upcoming: 1, Final: 0.55, Disrupted: 0.6 }),
  },
}

/**
 * Invisible stand-ins for the pins, the size of what each shows: a score card zoomed in, a small pin
 * zoomed out. Score cards are page elements MapLibre can't see, and circle layers take no part in
 * label placement, so these give place names something to avoid: a name that would fall under a pin
 * moves to another side of its dot (see globeStyle's city names), or is left out if no side is free.
 * Cluster bubbles have none: a name too close to fit beside one would be lost, so it's written across
 * the bubble instead (place names draw above the pins). Both draw nothing.
 */
export const cardFootprint = { image: 'card-footprint', width: 106, height: 68 }
// A Live small pin is the largest: radius 7 plus a 2 px outline.
export const pinFootprint = { image: 'pin-footprint', size: 20 }

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
