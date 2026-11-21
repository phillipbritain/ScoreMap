import type { CircleLayerSpecification, ExpressionSpecification, SymbolLayerSpecification } from 'maplibre-gl'
import type { Theme } from '../theme/theme'
import { hotIndicatorImage } from './hotIndicator'
import { smallPinReach } from './panelClearance'
import { byStatus, smallPinWidth } from './statusLook'

/**
 * The source of every game shown, never clustered, for score cards to be read from (see
 * ScoreCardMarkers.sync). It draws nothing itself: a game shows as its score card, in a card cluster,
 * or as its small pin, which the card layout draws (see cardLayoutLayers).
 */
export const pinSource = 'pins'

/**
 * The one layer on the pin source, drawing nothing: it keeps the source's tiles loaded, for the score
 * cards to be read from. MapLibre loads a source's tiles only while a layer showing it uses them.
 */
export const cardPinsLayerSpec: CircleLayerSpecification = {
  id: 'card-pins',
  type: 'circle',
  source: pinSource,
  paint: { 'circle-radius': 0, 'circle-opacity': 0, 'circle-stroke-width': 0 },
}

/**
 * A set of small pins in a source shared with other features: those of games with no room for a card
 * (see cardlessPins), each set with its own layers.
 */
export interface PinSet {
  source: string
  /** Before each of the set's layer ids. */
  prefix: string
  /** Which of the source's features are small pins. */
  only: ExpressionSpecification
}

// A pin set's layers' ids, after its prefix.
const smallPinLayer = 'pins'
const selectedPinLayer = 'pin-selected'

/** A layer in a pin set: its id and source. */
function inSet({ source, prefix }: PinSet, id: string) {
  return { id: prefix + id, source }
}

/**
 * The hot indicator surrounding a cluster, in its colors (see hotIndicatorImage), centered behind its disc.
 */
export function clusterHotIndicatorLayout(image: ExpressionSpecification | string): SymbolLayerSpecification['layout'] {
  return {
    'icon-image': image,
    'icon-anchor': 'center',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  }
}

/** The hot indicator wrapping a cluster, reaching this far, including its outline. */
export function clusterHotIndicatorImage(theme: Theme, reach: number): string {
  return hotIndicatorImage(theme, theme.components.Cluster.hotIndicator, reach)
}

/** A small pin's game's color (see gameColor). */
const gameColor: ExpressionSpecification = ['get', 'color']

/**
 * Small pins for single games, each a bright core in a soft glow (see StatusLook): those with no room
 * for a card (see cardlessPins). The glows are a layer beneath the cores, so a core is never dimmed
 * by a neighbor's glow. Glow, ring and core are in the game's color, but for a core the theme gives
 * a status of its own, apart from the status's color (Live's paler core, say): color stands for the
 * game's league, and status shows by glow and brightness (ADR-0017). A game showing the hot indicator has a
 * thin outline in its colors (see hotIndicatorImage) and a soft glow around its core.
 */
export function smallPinLayers(
  theme: Theme,
  set: PinSet,
): [CircleLayerSpecification, SymbolLayerSpecification, CircleLayerSpecification] {
  return [
    {
      ...inSet(set, 'pin-glows'),
      type: 'circle',
      filter: set.only,
      paint: {
        'circle-radius': byStatus(theme, (look) => look.glow.radius),
        'circle-color': gameColor,
        'circle-blur': 1,
        'circle-opacity': byStatus(theme, (look) => look.glow.opacity),
      },
    },
    {
      ...inSet(set, 'pin-hot-indicator'),
      type: 'symbol',
      filter: ['all', set.only, ['==', ['get', 'hotIndicator'], true]],
      layout: {
        'icon-image': byStatus(theme, (look) => hotIndicatorImage(theme, theme.components.Pin.hotIndicator, look.core.radius + look.core.ring)),
        'icon-anchor': 'center',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    },
    {
      ...inSet(set, smallPinLayer),
      type: 'circle',
      filter: set.only,
      layout: { 'circle-sort-key': byStatus(theme, (look) => look.stacking) },
      paint: {
        'circle-radius': byStatus(theme, (look) => look.core.radius),
        'circle-color': byStatus(theme, (look) => (look.core.color === look.color ? gameColor : look.core.color)),
        'circle-opacity': byStatus(theme, (look) => look.core.opacity),
        'circle-stroke-width': byStatus(theme, (look) => look.core.ring),
        'circle-stroke-color': gameColor,
      },
    },
  ]
}

/**
 * A ring around the selected game's small pin, in the theme's selection color and width, reaching as
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

/** Matches only the selected game's small pin (nothing when no game is selected). */
export function selectedPin(gameId: string | null): ExpressionSpecification {
  return ['==', ['get', 'gameId'], gameId ?? '']
}

/**
 * Invisible stand-ins for the small pins, as far across as the widest small pin shows (see
 * smallPinWidth), with a pixel's margin each side. Circle layers take no part in label placement, so
 * these give place names something to avoid: a name that would fall under a pin moves to another side
 * of its dot (see placeNames' city names), or is left out if no side is free. Score cards have theirs
 * too (see cardLayoutLayers' cardFootprint), and card clusters theirs (see clusterFootprintLayout).
 * Footprints draw nothing.
 */
export function pinFootprint(theme: Theme): { image: string; size: number } {
  return { image: pinFootprintImage, size: smallPinWidth(theme) + 2 }
}

/**
 * The image of a card cluster's footprint, scaled to the cluster's size (see clusterFootprintLayout):
 * one size whatever the theme, so it needn't change with it.
 */
export const clusterFootprint = { image: 'cluster-footprint', size: 32 }

/**
 * An invisible stand-in for a card cluster, disc and outline with a pixel's margin each side,
 * `diameter` pixels across, placed whatever else is there. On top of every name, so city names keep clear of clusters, keeping their circles and
 * counts readable: a city's name moves to another side of its dot, or is left out if no side is free,
 * but a game's city is still named below its dot if no side is free (see placeNames' city names).
 */
export function clusterFootprintLayout(diameter: number): SymbolLayerSpecification['layout'] {
  return {
    'icon-image': clusterFootprint.image,
    'icon-size': ['/', diameter, clusterFootprint.size],
    'icon-allow-overlap': true,
  }
}

/** How far across a cluster's footprint is for clusters that reach this far (see clusterFootprintLayout). */
export const clusterFootprintAcross = (reach: number): number => 2 * reach + 2

const pinFootprintImage = 'pin-footprint'

/** Each small pin in a pin set. */
export function pinFootprintLayerSpec(set: PinSet): SymbolLayerSpecification {
  return {
    ...inSet(set, 'pin-footprints'),
    type: 'symbol',
    filter: set.only,
    layout: { 'icon-image': pinFootprintImage, 'icon-allow-overlap': true },
    paint: { 'icon-opacity': 0 },
  }
}
