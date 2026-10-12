import type { LayerSpecification } from 'maplibre-gl'
import type { Theme } from '../theme/theme'
import { cardFootprintLayerSpec, cardLayoutLayers } from './cardLayoutLayers'
import { pinClusterLayers, pinFootprintLayerSpec, selectedPinLayerSpec, smallPinLayers } from './pinLayers'

/** The layers the globe adds over its map style for the games, each from the bottom up. */
export interface GameLayers {
  /**
   * Pins, the selected pin's ring, and the card layout's trails and card clusters: beneath the place
   * names, so a pin never hides a city's name and names draw over trails (ADR-0010).
   */
  belowNames: LayerSpecification[]
  /** The cards' and pins' footprints: on top, so names are placed around them rather than under them. */
  onTop: LayerSpecification[]
}

export function gameLayers(theme: Theme, selectedGameId: string | null): GameLayers {
  return {
    belowNames: [
      ...pinClusterLayers(theme),
      ...smallPinLayers(theme),
      selectedPinLayerSpec(theme, selectedGameId),
      ...cardLayoutLayers(theme),
    ],
    onTop: [cardFootprintLayerSpec, pinFootprintLayerSpec],
  }
}
