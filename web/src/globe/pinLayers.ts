import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  GeoJSONSourceSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'
import type { Theme } from '../theme/theme'
import { smallPinReach } from './panelClearance'
import { byStatus, pinClusterStatusCounts, smallPinWidth } from './statusLook'
import { cardZoom, clusterMaxZoom, pinLayout } from './zoomLevels'

export const pinSource = 'pins'
export const pinClusterLayer = 'pin-clusters'
export const smallPinLayer = 'pins'

export function pinSourceSpec(data: GeoJSONSourceSpecification['data'], zoom: number, theme: Theme): GeoJSONSourceSpecification {
  const { size, clusterRadius } = pinLayout(zoom, smallPinWidth(theme))
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

/** Pin clusters: discs outlined and lit in their status colour, with the count in it too (see the theme's cluster). */
export function pinClusterLayers(theme: Theme): [CircleLayerSpecification, CircleLayerSpecification, SymbolLayerSpecification] {
  const { cluster } = theme
  return [
    {
      id: 'pin-cluster-glows',
      type: 'circle',
      source: pinSource,
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': byCount(cluster.glowRadius),
        'circle-color': byStatus(theme, 'pinCluster', (look) => look.color),
        'circle-blur': 1,
        'circle-opacity': byStatus(theme, 'pinCluster', (look) => look.clusterOpacity * cluster.glowOpacity),
      },
    },
    {
      id: pinClusterLayer,
      type: 'circle',
      source: pinSource,
      filter: ['has', 'point_count'],
      layout: { 'circle-sort-key': byStatus(theme, 'pinCluster', (look) => look.stacking) },
      paint: {
        'circle-radius': byCount(cluster.radius),
        'circle-color': cluster.fill,
        'circle-stroke-width': cluster.outlineWidth,
        'circle-stroke-color': byStatus(theme, 'pinCluster', (look) => look.color),
        'circle-stroke-opacity': byStatus(theme, 'pinCluster', (look) => look.clusterOpacity),
      },
    },
    {
      id: 'pin-cluster-counts',
      type: 'symbol',
      source: pinSource,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': [theme.fonts.clusterCount.font.name],
        'text-size': theme.fonts.clusterCount.size,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': byStatus(theme, 'pinCluster', (look) => look.color) },
    },
  ]
}

/**
 * Small pins for single games while zoomed out, each a bright core in a soft glow (see StatusLook);
 * zoomed in, score cards take over (see scoreCardMarkers). The glows are a layer beneath the cores,
 * so a core is never dimmed by a neighbour's glow.
 */
export function smallPinLayers(theme: Theme): [CircleLayerSpecification, CircleLayerSpecification] {
  return [
    {
      id: 'pin-glows',
      type: 'circle',
      source: pinSource,
      filter: ['!', ['has', 'point_count']],
      maxzoom: cardZoom,
      paint: {
        'circle-radius': byStatus(theme, 'own', (look) => look.glow.radius),
        'circle-color': byStatus(theme, 'own', (look) => look.color),
        'circle-blur': 1,
        'circle-opacity': byStatus(theme, 'own', (look) => look.glow.opacity),
      },
    },
    {
      id: smallPinLayer,
      type: 'circle',
      source: pinSource,
      filter: ['!', ['has', 'point_count']],
      maxzoom: cardZoom,
      layout: { 'circle-sort-key': byStatus(theme, 'own', (look) => look.stacking) },
      paint: {
        'circle-radius': byStatus(theme, 'own', (look) => look.core.radius),
        'circle-color': byStatus(theme, 'own', (look) => look.core.color),
        'circle-opacity': byStatus(theme, 'own', (look) => look.core.opacity),
        'circle-stroke-width': byStatus(theme, 'own', (look) => look.core.ring),
        'circle-stroke-color': byStatus(theme, 'own', (look) => look.color),
      },
    },
  ]
}

export const selectedPinLayer = 'pin-selected'

/**
 * A ring around the selected game's small pin, in the theme's selection colour and width, reaching as
 * far as a small pin does (see panelClearance); zoomed in, its score card is outlined instead.
 */
export function selectedPinLayerSpec(theme: Theme, gameId: string | null): CircleLayerSpecification {
  return {
    id: selectedPinLayer,
    type: 'circle',
    source: pinSource,
    filter: selectedPin(gameId),
    maxzoom: cardZoom,
    paint: {
      'circle-radius': smallPinReach - theme.selection.width,
      'circle-color': 'transparent',
      'circle-stroke-width': theme.selection.width,
      'circle-stroke-color': theme.selection.color,
    },
  }
}

/** Matches only the selected game's small pin (nothing when no game is selected, or while it's in a pin cluster). */
export function selectedPin(gameId: string | null): ExpressionSpecification {
  return ['all', ['!', ['has', 'point_count']], ['==', ['get', 'gameId'], gameId ?? '']]
}

/** A pin cluster's size by how many games are in it: a few (up to 4), some (up to 14), or many. */
function byCount({ few, some, many }: Theme['cluster']['radius']): ExpressionSpecification {
  return ['step', ['get', 'point_count'], few, 5, some, 15, many]
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
export function pinFootprint(theme: Theme): { image: string; size: number } {
  return { image: pinFootprintImage, size: smallPinWidth(theme) + 2 }
}

const pinFootprintImage = 'pin-footprint'

/** Each small pin, while zoomed out. */
export const pinFootprintLayerSpec: SymbolLayerSpecification = {
  id: 'pin-footprints',
  type: 'symbol',
  source: pinSource,
  filter: ['!', ['has', 'point_count']],
  maxzoom: cardZoom,
  layout: { 'icon-image': pinFootprintImage, 'icon-allow-overlap': true },
  paint: { 'icon-opacity': 0 },
}
