import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { Game } from '../games/game'
import type { PlacedGame } from '../games/placedGames'
import type { Theme } from '../theme/theme'
import { addBlankImage } from './blankImage'
import { cardlessSelectedPinLayer } from './cardLayoutLayers'
import { pinFeatures } from './pinFeatures'
import { pinFootprint, pinSource, selectedPin } from './pinLayers'

/**
 * The pin source on the map: every game's, never clustered, for the score cards to be read from. The
 * only code that touches it; its interface is what GlobeMap tells it changed, and what it answers. It
 * reloads only when its pins change. The small pins of games with no room for a card are the card
 * layout's (see cardlessPins), though their footprint image and the selected one's ring are kept here.
 *
 * Its layer is added by GlobeMap, in order with the rest (see gameLayers).
 */
export interface PinSource {
  /**
   * The games shown, or their colors, changed: the source is given its games, reloaded only when its
   * pins change. Most changes are to a Live game's clock or score, which pins don't show.
   */
  showGames(games: readonly PlacedGame[]): void
  /**
   * The theme changed: the small pins' footprint is made for its widths, and the pins are given
   * again, as they carry colors that may be the theme's.
   */
  themeChanged(theme: Theme): void
  /** Rings this game's small pin, or none. */
  select(gameId: string | null): void
  /** Whether the source has loaded the games last given it, for the globe's settling. */
  loaded(): boolean
}

/** What the pin source is made with. */
export interface PinSourceOptions {
  /** The games shown when the style loads. */
  games: readonly PlacedGame[]
  theme: Theme
  /** A game's color, in the colors and theme the globe has now. */
  colorOf: (game: Game) => string
  /** Whether a game shows the hot indicator now (see GlobeMap.setHotIndicators). */
  hotIndicatorOf: (game: Game) => boolean
}

/**
 * Adds the pin source to a map whose style has just loaded, with the small pins' footprint image
 * (see pinFootprint).
 */
export function addPinSource(map: MapLibreMap, { games, theme, colorOf, hotIndicatorOf }: PinSourceOptions): PinSource {
  let shown = games
  const source = () => map.getSource<GeoJSONSource>(pinSource)

  const initialPins = pinFeatures(shown, colorOf, hotIndicatorOf)
  // The pins last given the source, so it's reloaded only when they change.
  let pinsKey = JSON.stringify(initialPins)
  map.addSource(pinSource, { type: 'geojson', data: initialPins })
  const { image, size } = pinFootprint(theme)
  addBlankImage(map, image, size, size)

  const showPins = () => {
    // Reloading the pin source for a change pins don't show would only hold back placing cards (see
    // ScoreCardMarkers.sync).
    const pins = pinFeatures(shown, colorOf, hotIndicatorOf)
    const key = JSON.stringify(pins)
    if (key === pinsKey) return
    pinsKey = key
    source()?.setData(pins)
  }

  return {
    showGames(games) {
      shown = games
      showPins()
    },
    themeChanged(changed) {
      if (changed === theme) return
      const was = theme
      theme = changed
      const footprint = pinFootprint(theme)
      if (footprint.size !== pinFootprint(was).size && map.hasImage(footprint.image)) {
        map.removeImage(footprint.image)
        addBlankImage(map, footprint.image, footprint.size, footprint.size)
      }
      showPins()
    },
    select(gameId) {
      if (map.getLayer(cardlessSelectedPinLayer)) map.setFilter(cardlessSelectedPinLayer, selectedPin(gameId))
    },
    loaded() {
      return !!map.getSource(pinSource) && map.isSourceLoaded(pinSource)
    },
  }
}
