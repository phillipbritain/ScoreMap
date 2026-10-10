import {
  LngLatBounds,
  Map as MapLibreMap,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, Point } from 'geojson'
import type { Game } from '../games/game'
import { animationTarget } from './animationTarget'
import type { Camera } from './camera'
import type { CardStyle } from './cardStyle'
import { addGlobeGlow } from './globeGlow'
import { liftClearOf, smallPinReach, type ScreenBox } from './panelClearance'
import { pinAnimation, type PinAnimation } from './pinAnimation'
import { pinFeatures } from './pinFeatures'
import {
  cardFootprint,
  cardFootprintLayerSpec,
  pinFootprint,
  pinFootprintLayerSpec,
  pinClusterLayer,
  pinClusterLayers,
  pinSource,
  pinSourceSpec,
  smallPinLayer,
  smallPinLayerSpecs,
} from './pinLayers'
import { pulse } from './pinPulse'
import { addPlaceNames, firstPlaceNameLayer, type PlaceNames } from './placeNames'
import { ScoreCardMarkers } from './scoreCardMarkers'
import { selectionColor } from './statusLook'
import { cardZoom, clusterMaxZoom, maxZoom, minZoom, pinLayout, type PinLayout } from './zoomLevels'

// MapLibre's default worker path doesn't survive Vite's bundling.
setWorkerUrl(workerUrl)

/**
 * The map style the globe draws its pins over: a style to load from a URL and make over as it
 * loads (the app's, see globeStyle), or a finished style (the tests' plain one).
 */
export type GlobeMapStyle = StyleSpecification | { url: string; transform: (base: StyleSpecification) => StyleSpecification }

export interface GlobeMapOptions {
  style: GlobeMapStyle
  /** Where the globe opens. */
  startCamera: Camera
  /** Called with a game's id when the viewer selects its pin or score card. */
  onSelect: (gameId: string) => void
  /** Called when the camera settles somewhere new, so it can be saved for the next visit. */
  onCameraMove: (camera: Camera) => void
}

export const selectedPinLayer = 'pin-selected'
/** Room left around a card cluster's games when zooming in to them. */
const cardClusterZoomPadding = 120

/**
 * MapLibre globe with a pin at each game's venue. Zoomed out, pins are small and nearby ones form
 * pin clusters; zoomed in, each pin becomes a score card, and cards with no room form card
 * clusters. Selecting any cluster zooms in until it splits.
 */
export class GlobeMap {
  private readonly map: MapLibreMap
  private readonly cards: ScoreCardMarkers
  private readonly names: PlaceNames
  private readonly removeGlow: () => void
  private readonly onSelect: (gameId: string) => void
  private readonly onCameraMove: (camera: Camera) => void
  /** The games as the globe last showed them, which tells what has changed in the next ones. */
  private shown = new Map<string, Game>()
  /** The pins last given to the pin source, so it's reloaded only when they change. */
  private pinsKey = ''
  private selectedGameId: string | null = null
  private clustering: PinLayout
  private destroyed = false

  constructor(container: HTMLElement, { style, startCamera, onSelect, onCameraMove }: GlobeMapOptions) {
    this.onSelect = onSelect
    this.onCameraMove = onCameraMove
    const map = new MapLibreMap({
      container,
      center: [startCamera.longitude, startCamera.latitude],
      zoom: startCamera.zoom,
      minZoom,
      maxZoom,
      attributionControl: false,
      // Place names are placed afresh every frame, not once each fade has played: between placements
      // they turn with the globe, so names gone over the horizon were still written at its edge.
      // They pop in and out as score cards do.
      fadeDuration: 0,
      // A double click while turning the globe is more often a slip than a wish to zoom in.
      doubleClickZoom: false,
    })
    this.map = map
    if ('url' in style) map.setStyle(style.url, { transformStyle: (_previous, base) => style.transform(base) })
    else map.setStyle(style)
    this.removeGlow = addGlobeGlow(map)
    this.names = addPlaceNames(map)
    this.cards = new ScoreCardMarkers(
      map,
      this.names,
      (gameId) => this.onSelect(gameId),
      (gameIds) => this.zoomToCardCluster(gameIds),
    )
    this.clustering = pinLayout(map.getZoom())

    map.on('style.load', this.addPins)
    map.on('zoom', this.recluster)
    // Cards follow the clustered source, which changes as the camera moves and data arrives.
    map.on('render', this.syncCards)
    map.on('click', pinClusterLayer, this.zoomToPinCluster)
    map.on('click', smallPinLayer, this.selectPin)
    for (const layer of [pinClusterLayer, smallPinLayer]) {
      map.on('mouseenter', layer, this.pointAt)
      map.on('mouseleave', layer, this.stopPointing)
    }

    // Remember where the viewer leaves the globe.
    map.on('moveend', this.saveCamera)
    window.addEventListener('pagehide', this.saveCamera)
  }

  /**
   * Shows these games, and animates the ones that changed since they were last shown (see
   * pinAnimation): the app hands over whole lists of games, so the globe finds what changed itself.
   * Only a game shown both times can animate. A game coming into view (a new game, or one the
   * viewer's settings showed again) appears without one, and so does a game shown after a
   * reconnection if nothing about it worth noticing changed while the app was away.
   */
  show(games: readonly Game[]): void {
    const before = this.shown
    this.shown = new Map(games.map((game) => [game.id, game]))
    // Most changes are to a Live game's clock or score, which pins don't show. Reloading the pin
    // source for them would only hold back placing cards (see ScoreCardMarkers.sync).
    const pins = pinFeatures(games)
    const pinsKey = JSON.stringify(pins)
    if (pinsKey !== this.pinsKey) {
      this.pinsKey = pinsKey
      this.map.getSource<GeoJSONSource>(pinSource)?.setData(pins)
    }
    // Names first: cards are laid out around them.
    this.names.showGames(games)
    this.cards.setGames(games)
    for (const game of games) {
      const last = before.get(game.id)
      const animation = last && pinAnimation(last, game)
      if (animation) void this.animate(game, animation)
    }
  }

  /**
   * Highlights the selected game's pin (a ring around its small pin, or its score card highlighted).
   * The globe stays where it is, unless the game panel (its box on the page) would cover the pin:
   * then it lifts just far enough to clear it (see liftClearOf). Selecting the game already
   * selected does nothing, so later games arriving don't move the camera.
   */
  select(gameId: string | null, panel: ScreenBox | null = null): void {
    if (gameId === this.selectedGameId) return
    this.selectedGameId = gameId
    this.cards.setSelected(gameId)
    if (this.map.getLayer(selectedPinLayer)) this.map.setFilter(selectedPinLayer, selectedPin(gameId))
    const game = gameId === null ? undefined : this.shown.get(gameId)
    if (!game) return
    const venue: [number, number] = [game.venue.longitude, game.venue.latitude]
    const { x, y } = this.map.project(venue)
    const lift = liftClearOf(this.pinOnPage(game, { x, y }), panel)
    if (lift <= 0) return
    // The venue straight up from where it is: panning by the lift would land short on the curved globe.
    const { width, height } = this.map.getContainer().getBoundingClientRect()
    this.map.easeTo({ center: venue, offset: [x - width / 2, y - lift - height / 2], duration: 600 })
  }

  /** The "Card style" setting. */
  setCardStyle(style: CardStyle): void {
    this.cards.setStyle(style)
  }

  /** Removes the globe from the page, with everything it listens to. */
  destroy(): void {
    this.destroyed = true
    window.removeEventListener('pagehide', this.saveCamera)
    this.cards.clear()
    this.removeGlow()
    this.names.remove()
    this.map.remove()
  }

  private readonly addPins = () => {
    const map = this.map
    map.setProjection({ type: 'globe' })
    this.clustering = pinLayout(map.getZoom())
    map.addSource(pinSource, pinSourceSpec(pinFeatures([...this.shown.values()]), map.getZoom()))
    // Beneath the place names, so a pin never hides a city's name.
    const belowNames = firstPlaceNameLayer(map.getStyle())
    for (const layer of pinClusterLayers) map.addLayer(layer, belowNames)
    for (const layer of smallPinLayerSpecs) map.addLayer(layer, belowNames)
    // A ring around the selected game's small pin; zoomed in, its score card is highlighted instead.
    map.addLayer(
      {
        id: selectedPinLayer,
        type: 'circle',
        source: pinSource,
        filter: selectedPin(this.selectedGameId),
        maxzoom: cardZoom,
        paint: {
          'circle-radius': smallPinReach - 3,
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-stroke-width': 3,
          'circle-stroke-color': selectionColor,
        },
      },
      belowNames,
    )
    // On top, so names are placed around the pins' footprints rather than under the pins.
    addBlankImage(map, cardFootprint.image, cardFootprint.width, cardFootprint.height)
    addBlankImage(map, pinFootprint.image, pinFootprint.size, pinFootprint.size)
    map.addLayer(cardFootprintLayerSpec)
    map.addLayer(pinFootprintLayerSpec)
  }

  // Small pins form pin clusters, with a radius that changes in steps between whole zoom levels; score
  // cards don't (see pinLayout).
  private readonly recluster = () => {
    const now = pinLayout(this.map.getZoom())
    const was = this.clustering
    if (now.size === was.size && (now.size === 'card' || now.clusterRadius === was.clusterRadius)) return
    this.clustering = now
    void this.map
      .getSource<GeoJSONSource>(pinSource)
      ?.setClusterOptions({ cluster: now.size === 'small', clusterRadius: now.clusterRadius, clusterMaxZoom })
  }

  private readonly syncCards = () => this.cards.sync()

  private readonly selectPin = (event: MapLayerMouseEvent) => {
    const gameId: unknown = event.features?.[0]?.properties?.gameId
    if (typeof gameId === 'string') this.onSelect(gameId)
  }

  private readonly pointAt = () => (this.map.getCanvas().style.cursor = 'pointer')
  private readonly stopPointing = () => (this.map.getCanvas().style.cursor = '')

  // Selecting a pin cluster, and selecting a card cluster, both zoom in until
  // their games split.

  /**
   * Zooms in to where a pin cluster splits. Score cards aren't in pin clusters, so one splits by
   * cardZoom at the latest, even one of games at the same venue (their cards are moved apart on
   * screen, see cardLayout).
   */
  private readonly zoomToPinCluster = async (event: MapLayerMouseEvent) => {
    const cluster = event.features?.[0]
    const source = this.map.getSource<GeoJSONSource>(pinSource)
    if (!cluster || !source) return
    const zoom = Math.min(await source.getClusterExpansionZoom(cluster.properties.cluster_id), cardZoom)
    if (this.destroyed) return
    this.map.easeTo({ center: (cluster.geometry as Point).coordinates as [number, number], zoom })
  }

  /**
   * Zooms in until a card cluster splits: to fit its games, at least a level in, and again
   * from there while some of them are still in one (until the globe can zoom no further in). A move
   * by the viewer along the way stops it.
   */
  private zoomToCardCluster(gameIds: readonly string[]): void {
    const bounds = new LngLatBounds()
    for (const gameId of gameIds) {
      const venue = this.shown.get(gameId)?.venue
      if (venue) bounds.extend([venue.longitude, venue.latitude])
    }
    if (bounds.isEmpty()) return
    const fitted = this.map.cameraForBounds(bounds, { padding: cardClusterZoomPadding })?.zoom ?? 0
    const zoom = Math.min(maxZoom, Math.max(this.map.getZoom() + 1, fitted))
    const center = bounds.getCenter()
    this.map.easeTo({ center, zoom })
    this.map.once('idle', () => {
      const arrived = Math.abs(this.map.getZoom() - zoom) < 0.01 && this.map.getCenter().distanceTo(center) < 1
      if (!arrived || zoom >= maxZoom) return
      const stillInCardCluster = this.cards.cardClusterGames().find((cluster) => cluster.some((id) => gameIds.includes(id)))
      if (stillInCardCluster) this.zoomToCardCluster(stillInCardCluster)
    })
  }

  /**
   * Plays an animation where a game shows on the globe: its score card when zoomed in, its small pin
   * when zoomed out, or the pin cluster it's in. Games not on the map (off screen) don't animate.
   */
  private async animate(game: Game, animation: PinAnimation): Promise<void> {
    const map = this.map
    const source = map.getSource<GeoJSONSource>(pinSource)
    // Not waiting for the source to load: it's still taking in the games just shown, and until then
    // it has the pins as they were, which are where the changed games still are.
    if (!source) return
    const venue: [number, number] = [game.venue.longitude, game.venue.latitude]
    const target = animationTarget(game.id, venue, map.querySourceFeatures(pinSource) as Feature<Point>[])
    if (!target) return

    if (target.kind === 'pin') {
      if (pinLayout(map.getZoom()).size === 'card') this.cards.animate(game.id, animation)
      else pulse(map, target.lngLat, animation, 'pin')
      return
    }

    for (const { clusterId, lngLat } of target.candidates) {
      // A pin cluster can be gone by the time it's asked (the data or zoom changed), so skip it.
      const leaves = await source.getClusterLeaves(clusterId, Infinity, 0).catch(() => [])
      if (this.destroyed) return
      if (leaves.some((leaf) => leaf.properties?.gameId === game.id)) {
        pulse(map, lngLat, animation, 'cluster')
        return
      }
    }
  }

  /**
   * The box a game's pin takes up on the page: its score card and venue, or its ringed small pin.
   * Given where its venue is on the map.
   */
  private pinOnPage(game: Game, { x, y }: { x: number; y: number }): ScreenBox {
    const container = this.map.getContainer().getBoundingClientRect()
    const venue = { x: container.left + x, y: container.top + y }
    const card = pinLayout(this.map.getZoom()).size === 'card' ? this.cards.cardOnPage(game.id) : null
    if (!card) {
      return {
        left: venue.x - smallPinReach,
        top: venue.y - smallPinReach,
        right: venue.x + smallPinReach,
        bottom: venue.y + smallPinReach,
      }
    }
    return {
      left: Math.min(card.left, venue.x),
      top: Math.min(card.top, venue.y),
      right: Math.max(card.right, venue.x),
      bottom: Math.max(card.bottom, venue.y),
    }
  }

  private readonly saveCamera = () => {
    const { lng, lat } = this.map.getCenter().wrap()
    this.onCameraMove({ longitude: lng, latitude: lat, zoom: this.map.getZoom() })
  }
}

/** Matches only the selected game's small pin (nothing when no game is selected, or while it's in a pin cluster). */
function selectedPin(gameId: string | null): ExpressionSpecification {
  return ['all', ['!', ['has', 'point_count']], ['==', ['get', 'gameId'], gameId ?? '']]
}

/** A fully transparent image, for the pins' invisible footprints. */
function addBlankImage(map: MapLibreMap, name: string, width: number, height: number): void {
  map.addImage(name, { width, height, data: new Uint8Array(width * height * 4) })
}
