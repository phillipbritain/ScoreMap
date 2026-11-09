import type { LayerSpecification } from 'maplibre-gl'
import type { Theme } from '../theme/theme'
import { cardClusterFootprintLayerSpec, cardFootprintLayerSpec, cardLayoutLayers } from './cardLayoutLayers'
import {
  outerPins,
  pinClusterFootprintLayerSpec,
  pinClusterLayers,
  pinFootprintLayerSpec,
  selectedPinLayerSpec,
  smallPinLayers,
  zoomedOutPins,
} from './pinLayers'

/** The layers the globe adds over its map style for the games, each from the bottom up. */
export interface GameLayers {
  /**
   * Pins, the selected pin's ring (zoomed out, and the outer games' at card zoom), and the card layout's trails and card clusters: beneath the place
   * names, so a pin never hides a city's name and names draw over trails (ADR-0010).
   */
  belowNames: LayerSpecification[]
  /**
   * The cards' and small pins' footprints: just beneath the games' city names, over every other name,
   * so other names are placed around them rather than under them, while a game's city is written
   * below its dot whatever cards and pins are there, as cards are laid out around it.
   */
  belowGameNames: LayerSpecification[]
  /**
   * The clusters' footprints: on top, so every name, a game's city's too, is placed around them where
   * it can be, keeping their circles and counts readable.
   */
  onTop: LayerSpecification[]
}

/**
 * The trails are drawn by the trail layer (see trailLayer), which GlobeMap adds among these. Small
 * pins give way to score cards at `cardZoom` (see FittedZoom).
 */
export function gameLayers(theme: Theme, selectedGameId: string | null, cardZoom: number): GameLayers {
  const zoomedOut = zoomedOutPins(cardZoom)
  const outer = outerPins(cardZoom)
  return {
    belowNames: [
      ...[zoomedOut, outer].flatMap((set) => [
        ...pinClusterLayers(theme, set),
        ...smallPinLayers(theme, set),
        selectedPinLayerSpec(theme, selectedGameId, set),
      ]),
      ...cardLayoutLayers(theme),
    ],
    belowGameNames: [cardFootprintLayerSpec, pinFootprintLayerSpec(zoomedOut), pinFootprintLayerSpec(outer)],
    onTop: [cardClusterFootprintLayerSpec(theme), pinClusterFootprintLayerSpec(theme, zoomedOut), pinClusterFootprintLayerSpec(theme, outer)],
  }
}
