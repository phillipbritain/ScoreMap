import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  GeoJSONSourceSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'
import type { Theme } from '../theme/theme'
import { clusterColour, pinClusterSharedColour } from './clusterColour'
import { flameImage } from './flames'
import { smallPinReach } from './panelClearance'
import { byStatus, pinClusterStatusCounts, smallPinWidth } from './statusLook'
import { cardZoom, clusterMaxZoom, type PinLayout } from './zoomLevels'

export const pinSource = 'pins'
export const pinClusterLayer = 'pin-clusters'
export const smallPinLayer = 'pins'

/**
 * The source of games far from the centre of the view at card zoom, which show as small pins rather
 * than score cards (see hasCard), clustered among themselves. GlobeMap keeps it up to date as the
 * globe turns.
 */
export const outerPinSource = 'outer-pins'
export const outerPinClusterLayer = 'outer-pin-clusters'
export const outerSmallPinLayer = 'outer-pins'

/**
 * A set of small pins and pin clusters: the games' own while zoomed out, or the outer games' at card
 * zoom. Each has its own source and layers, drawn alike.
 */
export interface PinSet {
  source: string
  /** Before each of the set's layer ids. */
  prefix: string
  minzoom?: number
  /**
   * Past which its small pins don't show. Its pin clusters' layers stay on: zoomed in, the pin source
   * doesn't cluster, so they draw nothing, but they keep its tiles loaded for the score cards to be
   * read from (see ScoreCardMarkers.sync).
   */
  maxzoom?: number
}

export const zoomedOutPins: PinSet = { source: pinSource, prefix: '', maxzoom: cardZoom }
export const outerPins: PinSet = { source: outerPinSource, prefix: 'outer-', minzoom: cardZoom }

/** A layer in a pin set: its id, source and zooms (a pin cluster layer's without the maxzoom). */
function inSet({ source, prefix, minzoom, maxzoom }: PinSet, id: string, { clusters = false } = {}) {
  return {
    id: prefix + id,
    source,
    ...(minzoom === undefined ? {} : { minzoom }),
    ...(maxzoom === undefined || clusters ? {} : { maxzoom }),
  }
}

/** The pins' source, clustering small pins as the pin layout at the zoom it's added at says. */
export function pinSourceSpec(data: GeoJSONSourceSpecification['data'], { size, clusterRadius }: PinLayout): GeoJSONSourceSpecification {
  return {
    type: 'geojson',
    data,
    cluster: size === 'small',
    clusterRadius,
    clusterMaxZoom,
    // Counts by status, for the status a pin cluster shows as (see statusLook's pinClusterStatus), the
    // colour its games share, for its colour (see clusterColour), and how many show flames.
    clusterProperties: { ...pinClusterStatusCounts, ...pinClusterSharedColour, [flameGamesProperty]: ['+', ['case', ['get', 'flames'], 1, 0]] },
  }
}

/** How many of a pin cluster's games show flames (see showsFlames), which the pin source counts. */
const flameGamesProperty = 'flameGames'

/**
 * A flame on a cluster's top edge, in its colour, as tall as the theme's cluster flame, `offset` from
 * the cluster's middle (see clusterFlameOffset).
 */
export function clusterFlameLayout(theme: Theme, offset: ExpressionSpecification): SymbolLayerSpecification['layout'] {
  return {
    'icon-image': flameImage(theme.components.Cluster.flame.size, clusterColour(theme)),
    'icon-anchor': 'bottom',
    'icon-offset': offset,
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  }
}

/**
 * Where a cluster's flame stands, from the cluster's middle, for a cluster reaching this far (outline
 * and all): its base a third of the way up the flame below the top edge, so it rises from the outline.
 */
export function clusterFlameOffset(theme: Theme, reach: number): ExpressionSpecification {
  return ['literal', [0, -reach + theme.components.Cluster.flame.size / 3]]
}

/**
 * Pin clusters: discs outlined and lit in their games' colour (see clusterColour), with the count in
 * it too (see the theme's cluster), the disc, outline and count faded as their status's clusters are,
 * as card clusters are (see cardLayoutLayers). One holding a game that shows flames has a flame on its
 * top edge.
 */
export function pinClusterLayers(
  theme: Theme,
  set: PinSet,
): [CircleLayerSpecification, CircleLayerSpecification, SymbolLayerSpecification, SymbolLayerSpecification] {
  const cluster = theme.components.Cluster
  const clusterOpacity = byStatus(theme, 'pinCluster', (look) => look.clusterOpacity)
  return [
    {
      ...inSet(set, 'pin-cluster-glows', { clusters: true }),
      type: 'circle',
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': byCount(cluster.glowRadius),
        'circle-color': clusterColour(theme),
        'circle-blur': 1,
        'circle-opacity': byStatus(theme, 'pinCluster', (look) => look.glow.opacity * cluster.glowOpacity),
      },
    },
    {
      ...inSet(set, pinClusterLayer, { clusters: true }),
      type: 'circle',
      filter: ['has', 'point_count'],
      layout: { 'circle-sort-key': byStatus(theme, 'pinCluster', (look) => look.stacking) },
      paint: {
        'circle-radius': byCount(cluster.radius),
        'circle-color': cluster.fill,
        'circle-opacity': clusterOpacity,
        'circle-stroke-width': cluster.outlineWidth,
        'circle-stroke-color': clusterColour(theme),
        'circle-stroke-opacity': clusterOpacity,
      },
    },
    {
      ...inSet(set, 'pin-cluster-counts', { clusters: true }),
      type: 'symbol',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': [theme.components.Cluster.count.font.name],
        'text-size': theme.components.Cluster.count.size,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': clusterColour(theme), 'text-opacity': clusterOpacity },
    },
    {
      ...inSet(set, 'pin-cluster-flames', { clusters: true }),
      type: 'symbol',
      filter: ['all', ['has', 'point_count'], ['>', ['get', flameGamesProperty], 0]],
      layout: clusterFlameLayout(theme, [
        'step',
        ['get', 'point_count'],
        clusterFlameOffset(theme, clusterReach(theme, 1)),
        clusterCounts.some,
        clusterFlameOffset(theme, clusterReach(theme, clusterCounts.some)),
        clusterCounts.many,
        clusterFlameOffset(theme, clusterReach(theme, clusterCounts.many)),
      ]),
      paint: { 'icon-opacity': clusterOpacity },
    },
  ]
}

/** A small pin's game's colour (see gameColour). */
const gameColor: ExpressionSpecification = ['get', 'color']

/**
 * Small pins for single games, each a bright core in a soft glow (see StatusLook): every game's
 * while zoomed out, and zoomed in, those far from the centre of the view, as score cards take over
 * near it (see scoreCardMarkers). The glows are a layer beneath the cores, so a core is never dimmed
 * by a neighbour's glow. Glow, ring and core are in the game's colour, but for a core the theme gives
 * a status of its own, apart from the status's colour (Live's paler core, say): colour stands for the
 * game's league, and status shows by glow and brightness (ADR-0017). A game showing flames has a
 * flame in its colour rising from its core, its base behind the core.
 */
export function smallPinLayers(
  theme: Theme,
  set: PinSet,
): [CircleLayerSpecification, SymbolLayerSpecification, CircleLayerSpecification] {
  return [
    {
      ...inSet(set, 'pin-glows'),
      type: 'circle',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': byStatus(theme, 'own', (look) => look.glow.radius),
        'circle-color': gameColor,
        'circle-blur': 1,
        'circle-opacity': byStatus(theme, 'own', (look) => look.glow.opacity),
      },
    },
    {
      ...inSet(set, 'pin-flames'),
      type: 'symbol',
      filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'flames'], true]],
      layout: {
        'icon-image': flameImage(theme.components.Pin.flame.size, gameColor),
        // Its base at the middle of the core.
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    },
    {
      ...inSet(set, smallPinLayer),
      type: 'circle',
      filter: ['!', ['has', 'point_count']],
      layout: { 'circle-sort-key': byStatus(theme, 'own', (look) => look.stacking) },
      paint: {
        'circle-radius': byStatus(theme, 'own', (look) => look.core.radius),
        'circle-color': byStatus(theme, 'own', (look) => (look.core.color === look.color ? gameColor : look.core.color)),
        'circle-opacity': byStatus(theme, 'own', (look) => look.core.opacity),
        'circle-stroke-width': byStatus(theme, 'own', (look) => look.core.ring),
        'circle-stroke-color': gameColor,
      },
    },
  ]
}

export const selectedPinLayer = 'pin-selected'
export const outerSelectedPinLayer = 'outer-pin-selected'

/**
 * A ring around the selected game's small pin, in the theme's selection colour and width, reaching as
 * far as a small pin does (see panelClearance); a score card is outlined instead.
 */
export function selectedPinLayerSpec(theme: Theme, gameId: string | null, set: PinSet): CircleLayerSpecification {
  return {
    ...inSet(set, selectedPinLayer),
    type: 'circle',
    filter: selectedPin(gameId),
    paint: {
      'circle-radius': smallPinReach - theme.components.Selection.width,
      'circle-color': 'transparent',
      'circle-stroke-width': theme.components.Selection.width,
      'circle-stroke-color': theme.components.Selection.color,
    },
  }
}

/** Matches only the selected game's small pin (nothing when no game is selected, or while it's in a pin cluster). */
export function selectedPin(gameId: string | null): ExpressionSpecification {
  return ['all', ['!', ['has', 'point_count']], ['==', ['get', 'gameId'], gameId ?? '']]
}

/**
 * How far apart on screen small pins and pin clusters must be not to overlap: as far as the two widest
 * reach together, the widest small pin (see smallPinWidth) or the widest pin cluster, outline and all.
 * MapLibre clusters with one radius for pins and pin clusters alike, so pins are clustered this far
 * apart, though two small pins alone could come closer. MapLibre measures on a flat map, not the
 * globe, so pins may still overlap a little far from the equator or near the globe's edge.
 */
export function pinClusterSpacing(theme: Theme): number {
  const { radius, outlineWidth } = theme.components.Cluster
  return Math.ceil(Math.max(smallPinWidth(theme), 2 * (Math.max(radius.few, radius.some, radius.many) + outlineWidth)))
}

/** How many games a cluster holds from which it's of some, and of many. */
const clusterCounts = { some: 5, many: 15 }

/**
 * A cluster's size by how many games are in it, read from a feature's count property: a few (up to
 * 4), some (up to 14), or many.
 */
export function byCount(
  { few, some, many }: Theme['components']['Cluster']['radius'],
  count = 'point_count',
): ExpressionSpecification {
  return ['step', ['get', count], few, clusterCounts.some, some, clusterCounts.many, many]
}

/** How far a cluster of this many games reaches from its middle, outline and all (drawn outside its radius). */
export function clusterReach(theme: Theme, count: number): number {
  const { radius, outlineWidth } = theme.components.Cluster
  const size = count < clusterCounts.some ? radius.few : count < clusterCounts.many ? radius.some : radius.many
  return size + outlineWidth
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

/** Each small pin in a pin set. */
export function pinFootprintLayerSpec(set: PinSet): SymbolLayerSpecification {
  return {
    ...inSet(set, 'pin-footprints'),
    type: 'symbol',
    filter: ['!', ['has', 'point_count']],
    layout: { 'icon-image': pinFootprintImage, 'icon-allow-overlap': true },
    paint: { 'icon-opacity': 0 },
  }
}
