import type { LayerSpecification } from 'maplibre-gl'
import type { Theme } from '../theme/theme'
import { cardClusterFootprintLayerSpec, cardFootprintLayerSpec, cardLayoutLayers, cardlessPins } from './cardLayoutLayers'
import { cardPinsLayerSpec, pinFootprintLayerSpec, selectedPinLayerSpec, smallPinLayers } from './pinLayers'

/** The layers the globe adds over its map style for the games, each from the bottom up. */
export interface GameLayers {
  /**
   * The pin source's layer, which draws nothing (see cardPinsLayerSpec), the card layout's trails and
   * card clusters, and the small pins of games with no room for a card with the selected pin's ring: beneath the place names, so a pin never hides a city's name and names draw over trails
   * (ADR-0010).
   */
  belowNames: LayerSpecification[]
  /**
   * The cards', small pins' and card clusters' footprints: just beneath the games' city names, over
   * every other name, so other names give way to them rather than go under them, while a game's city
   * is written in its spot whatever cards, pins and clusters are there, as cards are laid out around it.
   */
  belowGameNames: LayerSpecification[]
}

/** The trails are drawn by the trail layer (see trailLayer), which GlobeMap adds among these. */
export function gameLayers(theme: Theme, selectedGameId: string | null): GameLayers {
  return {
    belowNames: [
      cardPinsLayerSpec,
      ...cardLayoutLayers(theme),
      ...smallPinLayers(theme, cardlessPins),
      selectedPinLayerSpec(theme, selectedGameId, cardlessPins),
    ],
    belowGameNames: [cardFootprintLayerSpec, pinFootprintLayerSpec(cardlessPins), cardClusterFootprintLayerSpec(theme)],
  }
}
