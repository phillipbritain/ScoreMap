import type { LayerSpecification } from 'maplibre-gl'
import type { Theme } from '../theme/theme'
import { cardClusterFootprintLayerSpec, cardFootprintLayerSpec, cardLayoutLayers, cardlessPins } from './cardLayoutLayers'
import {
  cardPinsLayerSpec,
  outerPins,
  pinClusterFootprintLayerSpec,
  pinClusterLayers,
  pinFootprintLayerSpec,
  selectedPinLayerSpec,
  smallPinLayers,
} from './pinLayers'

/** The layers the globe adds over its map style for the games, each from the bottom up. */
export interface GameLayers {
  /**
   * The pin source's layer, which draws nothing (see cardPinsLayerSpec), the outer pins and those of
   * games with no room for a card, the selected pin's ring, and the card layout's trails and card
   * clusters: beneath the place names, so a pin never hides a city's name and names draw over trails
   * (ADR-0010).
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

/** The trails are drawn by the trail layer (see trailLayer), which GlobeMap adds among these. */
export function gameLayers(theme: Theme, selectedGameId: string | null): GameLayers {
  return {
    belowNames: [
      cardPinsLayerSpec,
      ...pinClusterLayers(theme, outerPins),
      ...smallPinLayers(theme, outerPins),
      selectedPinLayerSpec(theme, selectedGameId, outerPins),
      ...cardLayoutLayers(theme),
      ...smallPinLayers(theme, cardlessPins),
      selectedPinLayerSpec(theme, selectedGameId, cardlessPins),
    ],
    belowGameNames: [cardFootprintLayerSpec, pinFootprintLayerSpec(outerPins), pinFootprintLayerSpec(cardlessPins)],
    onTop: [cardClusterFootprintLayerSpec(theme), pinClusterFootprintLayerSpec(theme, outerPins)],
  }
}
