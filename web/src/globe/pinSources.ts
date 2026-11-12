import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, Point } from 'geojson'
import type { Game } from '../games/game'
import type { PlacedGame } from '../games/placedGames'
import type { Theme } from '../theme/theme'
import { addBlankImage } from './blankImage'
import { cardlessSelectedPinLayer } from './cardLayoutLayers'
import type { GlobePoint } from './geo'
import { isBehindGlobe } from './horizon'
import { pinFeatures } from './pinFeatures'
import { outerPinSource, outerSelectedPinLayer, pinClusterSpacing, pinFootprint, pinSource, pinSourceSpec, selectedPin } from './pinLayers'
import { clusterMaxZoom, hasCard, pinClusterRadius } from './zoomLevels'

/**
 * The pin sources on the map: every game's, for the score cards to be read from (the pin source), and
 * the outer games' small pins and pin clusters (the outer pin source). The only code that touches
 * either source; its interface is what GlobeMap tells it changed, and what it answers. The ordering
 * and performance facts the sources need live here, with them: each reloads only when its pins
 * change, and the pin source, which never clusters, is left alone as the cluster radius changes.
 *
 * Its layers are added by GlobeMap, in order with the rest (see gameLayers).
 */
export interface PinSources {
  /**
   * The games shown, or their colors, changed: each source is given its games (see outerPinGames),
   * reloaded only when its pins change. Most changes are to a Live game's clock or score, which
   * pins don't show.
   */
  showGames(games: readonly PlacedGame[]): void
  /** The camera moved: the outer pin source reclusters for the zoom now, and the outer pins follow. */
  cameraMoved(): void
  /**
   * The theme changed: the small pins' footprint is made for its widths, the outer pin source
   * reclusters by its pin cluster spacing, and the pins are given again, as they carry colors that
   * may be the theme's.
   */
  themeChanged(theme: Theme): void
  /** Rings this game's small pin, or none, in every pin set. */
  select(gameId: string | null): void
  /** Whether both sources have loaded the games last given them, for the globe's settling. */
  loaded(): boolean
  /**
   * Where a pulse for a game at this venue looks: the outer pin source if the game is an outer pin's
   * now, else the pin source, with the features it has now. Not waiting for it to load: it's still
   * taking in the games just shown, and until then it has the pins as they were, which are where the
   * changed games still are.
   */
  pulseSource(venue: GlobePoint): PulseSource
}

/** A pin source a pulse looks in (see PinSources.pulseSource). */
export interface PulseSource {
  features: Feature<Point>[]
  /** A pin cluster's games, or none if it's gone (the data or zoom changed since it was asked for). */
  clusterLeaves(clusterId: number): Promise<Feature[]>
}

/** What the pin sources are made with. */
export interface PinSourcesOptions {
  /** The games shown when the style loads. */
  games: readonly PlacedGame[]
  theme: Theme
  /** A game's color, in the colors and theme the globe has now. */
  colorOf: (game: Game) => string
}

/**
 * Which games are outer pins: those with no score card (see hasCard), on the side of the globe facing
 * the viewer (as `isBehindGlobe` tells).
 */
export function outerPinGames<G extends { venue: GlobePoint }>(
  games: readonly G[],
  center: GlobePoint,
  isBehindGlobe: (venue: GlobePoint) => boolean,
): G[] {
  return games.filter(({ venue }) => !hasCard(center, venue) && !isBehindGlobe(venue))
}

/** How close small pins cluster in the map's view now, for small pins and pin clusters as wide as the theme's (see pinClusterRadius). */
function pinClusterRadiusOn(map: MapLibreMap, theme: Theme): number {
  return pinClusterRadius(map.getZoom(), pinClusterSpacing(theme))
}

/** The selected-pin layers, one in each pin set, cardless pins' included (see gameLayers). */
const selectedPinLayers = [outerSelectedPinLayer, cardlessSelectedPinLayer]

/**
 * Adds the pin sources to a map whose style has just loaded, with the small pins' footprint image
 * (see pinFootprint), the outer pins clustered for the zoom now (see PinSources).
 */
export function addPinSources(map: MapLibreMap, { games, theme, colorOf }: PinSourcesOptions): PinSources {
  let shown = games
  let clusterRadius = pinClusterRadiusOn(map, theme)
  const center = (): GlobePoint => {
    const { lng: longitude, lat: latitude } = map.getCenter()
    return { longitude, latitude }
  }
  const source = (id: string) => map.getSource<GeoJSONSource>(id)

  const initialPins = pinFeatures(shown, colorOf)
  // The pins last given each source, so it's reloaded only when they change.
  let pinsKey = JSON.stringify(initialPins)
  let outerPinsKey = ''
  map.addSource(pinSource, { type: 'geojson', data: initialPins })
  map.addSource(outerPinSource, pinSourceSpec(pinFeatures([], colorOf), clusterRadius))
  const { image, size } = pinFootprint(theme)
  addBlankImage(map, image, size, size)

  /**
   * Gives the outer pin source the outer games (see outerPinGames): reloaded only when they change,
   * as games cross the card radius or the horizon.
   */
  const showOuterPins = () => {
    const outer = outerPinGames(shown, center(), ({ longitude, latitude }) => isBehindGlobe(map, [longitude, latitude]))
    const pins = pinFeatures(outer, colorOf)
    const key = JSON.stringify(pins)
    if (key === outerPinsKey) return
    outerPinsKey = key
    source(outerPinSource)?.setData(pins)
  }

  const showPins = () => {
    // Reloading the pin source for a change pins don't show would only hold back placing cards (see
    // ScoreCardMarkers.sync).
    const pins = pinFeatures(shown, colorOf)
    const key = JSON.stringify(pins)
    if (key !== pinsKey) {
      pinsKey = key
      source(pinSource)?.setData(pins)
    }
    showOuterPins()
  }

  // Outer pins form pin clusters, with a radius that changes in steps between whole zoom levels (see pinClusterRadius).
  const recluster = () => {
    const now = pinClusterRadiusOn(map, theme)
    if (now === clusterRadius) return
    clusterRadius = now
    void source(outerPinSource)?.setClusterOptions({ cluster: true, clusterRadius, clusterMaxZoom })
  }

  showOuterPins()

  return {
    showGames(games) {
      shown = games
      showPins()
    },
    cameraMoved() {
      recluster()
      // Games cross the card radius as the globe turns.
      showOuterPins()
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
      recluster()
      showPins()
    },
    select(gameId) {
      for (const layer of selectedPinLayers) {
        if (map.getLayer(layer)) map.setFilter(layer, selectedPin(gameId))
      }
    },
    loaded() {
      const loaded = (id: string) => !!map.getSource(id) && map.isSourceLoaded(id)
      return loaded(pinSource) && loaded(outerPinSource)
    },
    pulseSource(venue) {
      const id = hasCard(center(), venue) ? pinSource : outerPinSource
      return {
        features: map.querySourceFeatures(id) as Feature<Point>[],
        clusterLeaves: async (clusterId) => (await source(id)?.getClusterLeaves(clusterId, Infinity, 0).catch(() => [])) ?? [],
      }
    },
  }
}
