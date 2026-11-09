import type { LayerSpecification } from 'maplibre-gl'
import type { Theme } from '../theme/theme'
import { cardFootprintLayerSpec, cardLayoutLayers } from './cardLayoutLayers'
import { outerPins, pinClusterLayers, pinFootprintLayerSpec, selectedPinLayerSpec, smallPinLayers, zoomedOutPins } from './pinLayers'
import { cardZoom, type PinSize } from './zoomLevels'

/** The layers the globe adds over its map style for the games, each from the bottom up. */
export interface GameLayers {
  /**
   * Pins, the selected pin's ring (zoomed out, and the outer games' at card zoom), and the card layout's trails and card clusters: beneath the place
   * names, so a pin never hides a city's name and names draw over trails (ADR-0010).
   */
  belowNames: LayerSpecification[]
  /** The cards' and pins' footprints: on top, so names are placed around them rather than under them. */
  onTop: LayerSpecification[]
}

/**
 * The trails are drawn by the trail layer (see trailLayer), which GlobeMap adds among these. Small
 * pins give way to score cards, so each pin set's layers that show only one side of the card zoom
 * are shown or hidden for the pins showing now, `size` (see shownFor).
 */
export function gameLayers(theme: Theme, selectedGameId: string | null, size: PinSize): GameLayers {
  const zoomedOut = zoomedOutPins(cardZoom)
  const outer = outerPins(cardZoom)
  const shown = shownFor(size)
  return {
    belowNames: [
      ...[zoomedOut, outer].flatMap((set) => [
        ...pinClusterLayers(theme, set),
        ...smallPinLayers(theme, set),
        selectedPinLayerSpec(theme, selectedGameId, set),
      ]),
      ...cardLayoutLayers(theme),
    ].map(shown),
    onTop: [cardFootprintLayerSpec, pinFootprintLayerSpec(zoomedOut), pinFootprintLayerSpec(outer)].map(shown),
  }
}

/**
 * A layer of a pin set's that shows only one side of the card zoom, by its zoom range (see PinSet):
 * shown or hidden by its visibility instead, for the pins showing (see pinSize). A zoom range is in
 * MapLibre's zoom, which changes as the globe turns for the same size of globe on screen (see zoomAt),
 * so turning the globe would bring cards in or take them away; and MapLibre takes a limit of 0 as
 * none, while its zoom goes below 0 near the poles.
 */
function shownFor(size: PinSize) {
  return (layer: LayerSpecification): LayerSpecification => {
    const { minzoom, maxzoom, ...rest } = layer
    if (minzoom === undefined && maxzoom === undefined) return layer
    const shown = minzoom === undefined ? size === 'small' : size === 'card'
    const layout = 'layout' in rest ? rest.layout : undefined
    return { ...rest, layout: { ...layout, visibility: shown ? 'visible' : 'none' } } as LayerSpecification
  }
}
