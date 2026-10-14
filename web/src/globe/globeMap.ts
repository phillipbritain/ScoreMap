import {
  LngLatBounds,
  Map as MapLibreMap,
  setWorkerUrl,
  type GeoJSONSource,
  type LayerSpecification,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, Point } from 'geojson'
import type { Game } from '../games/game'
import { gameColour, type PickedColours } from '../settings/gameColour'
import type { Theme } from '../theme/theme'
import { animationTarget } from './animationTarget'
import type { Camera } from './camera'
import { cityLabelSettings, type CityLabelSettings } from './cityLabels'
import { gameLayers } from './gameLayers'
import { addGlobeGlow, type GlobeGlow } from './globeGlow'
import { globeStyle } from './globeStyle'
import { isBehindGlobe } from './horizon'
import { traceLayouts } from './layoutTrace'
import { liftClearOf, smallPinReach, type ScreenBox } from './panelClearance'
import { pinAnimation, type PinAnimation } from './pinAnimation'
import { pinFeatures } from './pinFeatures'
import {
  cardClusterLayer,
  cardFootprint,
  cardLayoutSource,
  cardLayoutSourceSpec,
} from './cardLayoutLayers'
import {
  outerPinClusterLayer,
  outerPinSource,
  outerSelectedPinLayer,
  outerSmallPinLayer,
  pinClusterSpacing,
  pinFootprint,
  pinClusterLayer,
  pinSource,
  pinSourceSpec,
  selectedPin,
  selectedPinLayer,
  smallPinLayer,
} from './pinLayers'
import { pulse } from './pinPulse'
import { addReachRings, type ReachRings } from './reachRings'
import { applyLayerChanges, layerChanges } from './restyle'
import { addPlaceNames, firstPlaceNameLayer, type PlaceNames } from './placeNames'
import { ScoreCardMarkers } from './scoreCardMarkers'
import { cardZoom, clusterMaxZoom, hasCard, maxZoom, minZoom, pinLayout, pinSize, type PinLayout } from './zoomLevels'

// MapLibre's default worker path doesn't survive Vite's bundling.
setWorkerUrl(workerUrl)

/**
 * The map style the globe draws its pins over: a base style to load from a URL and make over in the
 * globe's theme as it loads (the app's, see globeStyle), or a finished style (the tests' plain one).
 */
export type GlobeMapStyle = StyleSpecification | { url: string }

export interface GlobeMapOptions {
  style: GlobeMapStyle
  /**
   * The look of the globe to start with: its map style (when made over from a base style), the halo,
   * place names, pins and score cards. It changes with setTheme.
   */
  theme: Theme
  /** What decides which cities are labelled, to start with: the app's own unless given. It changes with setCityLabelSettings. */
  cityLabels?: CityLabelSettings
  /** The colours the viewer picked for games, to start with: none unless given. They change with setColours. */
  colours?: PickedColours
  /** Where the globe opens. */
  startCamera: Camera
  /** Called with a game's id when the viewer selects its pin or score card. */
  onSelect: (gameId: string) => void
  /** Called when the camera settles somewhere new, so it can be saved for the next visit. */
  onCameraMove: (camera: Camera) => void
  /**
   * Called each time the stage moves on (see stage): to drawing, then to ready, once each. Until
   * ready, the globe takes no keyboard input (the loading screen's dim takes the pointer's and touch).
   */
  onStage: (stage: LoadingStage) => void
}

/**
 * How far the globe's initial load has got: waiting for the server's first snapshot of games, then
 * drawing them until it first settles (or would but for score cards that have given up settling), then
 * ready (see GLOSSARY.md) for as long as the globe exists.
 */
export type LoadingStage = 'waitingForGames' | 'drawing' | 'ready'

/** Room left around a card cluster's games when zooming in to them. */
const cardClusterZoomPadding = 120

/**
 * MapLibre globe with a pin at each game's venue. Zoomed out, pins are small and nearby ones form
 * pin clusters; zoomed in, each pin near the centre of the view becomes a score card, and cards with
 * no room form card clusters, while the pins farther out stay small and form pin clusters among
 * themselves (see hasCard). Selecting a cluster zooms in until it splits, or centres the globe on
 * one farther out.
 */
export class GlobeMap {
  private readonly map: MapLibreMap
  private theme: Theme
  /** The colours the viewer picked for games (see gameColour). */
  private colours: PickedColours
  /** The base style the globe's style was made over from, once it has loaded (none for a finished style). */
  private base: StyleSpecification | null = null
  private readonly cards: ScoreCardMarkers
  private readonly names: PlaceNames
  private readonly reachRings: ReachRings
  /** What the city labels are chosen by (see setCityLabelSettings). */
  private cityLabels: CityLabelSettings
  /** Whether each game's city label reach is ringed on the globe (see showGameCityReach). */
  private reachShown = false
  private readonly glow: GlobeGlow
  private readonly onSelect: (gameId: string) => void
  private readonly onCameraMove: (camera: Camera) => void
  private readonly onStage: (stage: LoadingStage) => void
  /** The games as the globe last showed them, which tells what has changed in the next ones. */
  private shown = new Map<string, Game>()
  /** The pins last given to the pin source, so it's reloaded only when they change. */
  private pinsKey = ''
  /** The pins last given to the outer pin source, likewise. */
  private outerPinsKey = ''
  private selectedGameId: string | null = null
  private clustering: PinLayout
  private destroyed = false
  /** Whether the map has gone idle since it last drew a frame or was given anything to show (see settled). */
  private idle = false
  /** Whether it has been given the server's first snapshot of games (see show). */
  private hasGames = false
  /** Whether it has settled since it was first given games: once true, it stays true (see stage). */
  private wasReady = false
  /** The stage last told to onStage. */
  private toldStage: LoadingStage = 'waitingForGames'

  constructor(
    container: HTMLElement,
    { style, theme, cityLabels = cityLabelSettings, colours = noColours, startCamera, onSelect, onCameraMove, onStage }: GlobeMapOptions,
  ) {
    this.colours = colours
    this.onSelect = onSelect
    this.onCameraMove = onCameraMove
    this.onStage = onStage
    this.cityLabels = cityLabels
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
    // The loading screen's dim takes pointer and touch input until the globe is ready, but not keys.
    map.keyboard.disable()
    this.map = map
    this.theme = theme
    traceLayouts(map, { stage: () => this.stage(), settled: () => this.settled() })
    // Made over in the theme as it is when the base style loads, which setTheme may have changed by then.
    const transformStyle = (_previous: unknown, base: StyleSpecification) => {
      this.base = base
      return globeStyle(base, this.theme)
    }
    if ('url' in style) map.setStyle(style.url, { transformStyle })
    else map.setStyle(style)
    const currentTheme = () => this.theme
    this.glow = addGlobeGlow(map, currentTheme)
    // Before the pins' layers are added on style load, so they're drawn under the pins.
    this.reachRings = addReachRings(map)
    this.names = addPlaceNames(map, currentTheme, cityLabels)
    this.cards = new ScoreCardMarkers(map, currentTheme, this.colourOf, this.names, (gameId) => this.onSelect(gameId))
    this.clustering = this.pinLayoutNow()

    map.on('style.load', this.addPins)
    map.on('zoom', this.recluster)
    // Games cross the card radius as the globe turns, and zooming crosses cardZoom.
    map.on('move', this.showOuterPins)
    // Cards follow the clustered source, which changes as the camera moves and data arrives.
    map.on('render', this.syncCards)
    // And once the map goes idle, which can be the first the pin source counts as loaded: MapLibre
    // lets go of tiles held over from the last load after a frame's render event, and goes idle
    // without drawing another frame (as after the reload on zooming in to cardZoom).
    map.on('idle', this.syncCards)
    // MapLibre goes idle after a frame with nothing loading, moving or left to place (see settled).
    map.on('render', this.drew)
    map.on('idle', this.goneIdle)
    map.on('click', pinClusterLayer, this.zoomToPinCluster)
    map.on('click', smallPinLayer, this.selectPin)
    map.on('click', outerPinClusterLayer, this.centreOnOuterPinCluster)
    map.on('click', outerSmallPinLayer, this.selectPin)
    map.on('click', cardClusterLayer, this.zoomToCardClusterSelected)
    for (const layer of [pinClusterLayer, smallPinLayer, outerPinClusterLayer, outerSmallPinLayer, cardClusterLayer]) {
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
   *
   * Given null (no games yet: the server's first snapshot hasn't arrived), it shows nothing and keeps
   * waiting for games (see stage). An empty list is a snapshot with no games in it.
   */
  show(games: readonly Game[] | null): void {
    if (!games) return
    this.hasGames = true
    this.tellStage()
    this.unsettle()
    const before = this.shown
    this.shown = new Map(games.map((game) => [game.id, game]))
    this.showPins()
    // Names first: cards are laid out around them.
    this.names.showGames(games)
    if (this.reachShown) this.showReachRings()
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
    this.unsettle()
    this.selectedGameId = gameId
    this.cards.setSelected(gameId)
    for (const layer of [selectedPinLayer, outerSelectedPinLayer]) {
      if (this.map.getLayer(layer)) this.map.setFilter(layer, selectedPin(gameId))
    }
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

  /**
   * Changes the globe's look to this theme in place, without making it again: the map style's and the
   * games' layers are restyled (just the properties that differ, see layerChanges), the halo redrawn,
   * small pins reclustered by their new widths and their clusters', and score cards measured and laid out afresh. The
   * page's CSS must already be in this theme, as score cards are drawn by it.
   */
  setTheme(theme: Theme): void {
    if (theme === this.theme) return
    const was = this.theme
    this.theme = theme
    this.unsettle()
    const map = this.map
    applyLayerChanges(map, [
      ...(this.base ? layerChanges(globeStyle(this.base, was).layers, globeStyle(this.base, theme).layers) : []),
      ...layerChanges(gameLayersIn(was, this.selectedGameId), gameLayersIn(theme, this.selectedGameId)),
    ])
    const footprint = pinFootprint(theme)
    if (footprint.size !== pinFootprint(was).size && map.hasImage(footprint.image)) {
      map.removeImage(footprint.image)
      addBlankImage(map, footprint.image, footprint.size, footprint.size)
    }
    this.recluster()
    this.glow.place()
    // The pins carry their games' colours, which may be the theme's.
    this.showPins()
    this.cards.restyle()
  }

  /** Shows each game in these colours from now on (see gameColour): its pin, score card, trail and pulses. */
  setColours(colours: PickedColours): void {
    if (colours === this.colours) return
    this.colours = colours
    this.unsettle()
    this.showPins()
    this.cards.restyle()
  }

  /** A game's colour, in the colours and theme the globe has now. */
  private readonly colourOf = (game: Game): string => gameColour(this.colours, game, this.theme)

  /** Gives the pin sources the games shown, each in its colour, when they've changed. */
  private showPins(): void {
    // Most changes are to a Live game's clock or score, which pins don't show. Reloading the pin
    // source for them would only hold back placing cards (see ScoreCardMarkers.sync).
    const pins = pinFeatures([...this.shown.values()], this.colours, this.theme)
    const pinsKey = JSON.stringify(pins)
    if (pinsKey !== this.pinsKey) {
      this.pinsKey = pinsKey
      this.map.getSource<GeoJSONSource>(pinSource)?.setData(pins)
    }
    this.showOuterPins()
  }

  /** Labels cities by these settings from now on (on a local run, from the behaviour tuner). */
  setCityLabelSettings(settings: CityLabelSettings): void {
    if (settings === this.cityLabels) return
    this.cityLabels = settings
    this.unsettle()
    this.names.setSettings(settings)
    this.showReachRings()
  }

  /** Rings each game at the reach its city label may be within, or stops (on a local run, from the behaviour tuner). */
  showGameCityReach(shown: boolean): void {
    if (shown === this.reachShown) return
    this.reachShown = shown
    this.unsettle()
    this.showReachRings()
  }

  private showReachRings(): void {
    const venues = this.reachShown ? [...this.shown.values()].map((game) => game.venue) : []
    this.reachRings.show(venues, this.cityLabels.gameCityKm)
  }

  /**
   * Whether everything the globe was last given is on screen and still: the pin source has loaded
   * the games, the map has drawn them and gone idle (tiles loaded, the camera still, every place name
   * placed), and the score cards have settled. Still right now: false again after any change or move,
   * so tests and scripts wait on it after one. For the initial load, see stage.
   */
  settled(): boolean {
    return this.stillButCards() && this.cards.steady()
  }

  /** Whether everything settled asks for holds, the score cards aside. */
  private stillButCards(): boolean {
    const loaded = (source: string) => !!this.map.getSource(source) && this.map.isSourceLoaded(source)
    return loaded(pinSource) && loaded(outerPinSource) && this.idle
  }

  /**
   * How far the initial load has got: waiting for games until it's first given some (see show),
   * drawing until it first settles, or would but for score cards that have given up settling (see
   * noteReady), then ready for good, through pans, changes of games, fresh snapshots and
   * reconnections. Everything that waits for the globe to load reads this; settled
   * says whether it's still right now.
   */
  stage(): LoadingStage {
    if (this.wasReady) return 'ready'
    return this.hasGames ? 'drawing' : 'waitingForGames'
  }

  /**
   * Whether the score cards have stopped moving: the last frame laid them out just as the frame
   * before did. Unlike settled, this holds while the camera moves, so tests can tell the frame a
   * pan stops on still had the cards settling.
   */
  cardsSteady(): boolean {
    return this.cards.steady()
  }

  /** Removes the globe from the page, with everything it listens to. */
  destroy(): void {
    this.destroyed = true
    window.removeEventListener('pagehide', this.saveCamera)
    this.cards.clear()
    this.glow.remove()
    this.names.remove()
    this.reachRings.remove()
    this.map.remove()
  }

  private readonly addPins = () => {
    const map = this.map
    map.setProjection({ type: 'globe' })
    this.clustering = this.pinLayoutNow()
    map.addSource(pinSource, pinSourceSpec(pinFeatures([...this.shown.values()], this.colours, this.theme), this.clustering))
    map.addSource(
      outerPinSource,
      pinSourceSpec(pinFeatures([], this.colours, this.theme), { size: 'small', clusterRadius: this.clustering.clusterRadius }),
    )
    this.outerPinsKey = ''
    this.showOuterPins()
    map.addSource(cardLayoutSource, cardLayoutSourceSpec)
    addBlankImage(map, cardFootprint.image, cardFootprint.width, cardFootprint.height)
    const { image, size } = pinFootprint(this.theme)
    addBlankImage(map, image, size, size)
    const layers = gameLayers(this.theme, this.selectedGameId)
    const belowNames = firstPlaceNameLayer(map.getStyle())
    for (const layer of layers.belowNames) map.addLayer(layer, belowNames)
    for (const layer of layers.onTop) map.addLayer(layer)
  }

  // Small pins form pin clusters, with a radius that changes in steps between whole zoom levels; score
  // cards don't (see pinLayout). The outer pins are always small, so they always cluster.
  private readonly recluster = () => {
    const now = this.pinLayoutNow()
    const was = this.clustering
    if (now.size === was.size && now.clusterRadius === was.clusterRadius) return
    this.clustering = now
    // Left alone as the radius changes at card zoom: reloading it would only hold back placing cards.
    if (now.size === 'small' || was.size === 'small') {
      void this.map
        .getSource<GeoJSONSource>(pinSource)
        ?.setClusterOptions({ cluster: now.size === 'small', clusterRadius: now.clusterRadius, clusterMaxZoom })
    }
    void this.map
      .getSource<GeoJSONSource>(outerPinSource)
      ?.setClusterOptions({ cluster: true, clusterRadius: now.clusterRadius, clusterMaxZoom })
  }

  /** The pin layout at the map's zoom now, for small pins and pin clusters as wide as the theme's (see pinLayout). */
  private pinLayoutNow(): PinLayout {
    return pinLayout(this.map.getZoom(), pinClusterSpacing(this.theme))
  }

  private readonly syncCards = () => this.cards.sync()

  /**
   * Gives the outer pin source the games with no score card at card zoom (see hasCard), on the side
   * of the globe facing the viewer: reloaded only when they change, as games cross the card radius
   * or the horizon. Zoomed out it's empty, as every game's small pin is in the pin source.
   */
  private readonly showOuterPins = () => {
    const map = this.map
    const source = map.getSource<GeoJSONSource>(outerPinSource)
    if (!source) return
    const { lng: longitude, lat: latitude } = map.getCenter()
    const outer =
      pinSize(map.getZoom()) === 'card'
        ? [...this.shown.values()].filter(
            ({ venue }) => !hasCard({ longitude, latitude }, venue) && !isBehindGlobe(map, [venue.longitude, venue.latitude]),
          )
        : []
    const pins = pinFeatures(outer, this.colours, this.theme)
    const pinsKey = JSON.stringify(pins)
    if (pinsKey === this.outerPinsKey) return
    this.outerPinsKey = pinsKey
    source.setData(pins)
  }

  private readonly drew = () => (this.idle = false)
  private readonly goneIdle = () => {
    this.idle = true
    this.noteReady()
  }

  /**
   * Becomes ready the first time it has settled with games, or would have but for score cards that
   * have given up settling (see ScoreCardMarkers.gaveUpSettling): a layout that never steadies
   * mustn't keep the loading screen up. Checked as the map goes idle, after the score cards' sync on
   * it. Only then can it become settled: every other change to the cards comes with a frame drawn or
   * the globe unsettled. Having given up, the cards ask for no frames and give the map nothing new
   * to draw, so the map goes idle after them.
   */
  private noteReady(): void {
    if (this.wasReady || !this.hasGames) return
    if (!this.stillButCards() || !(this.cards.steady() || this.cards.gaveUpSettling())) return
    this.wasReady = true
    this.map.keyboard.enable()
    this.tellStage()
  }

  /** Tells onStage the stage, if it has moved on since it was last told. */
  private tellStage(): void {
    const stage = this.stage()
    if (stage === this.toldStage) return
    this.toldStage = stage
    this.onStage(stage)
  }

  /** Not settled until the map has drawn a frame since, so drawing one even if nothing else asks for it. */
  private unsettle(): void {
    this.idle = false
    this.map.triggerRepaint()
  }

  private readonly selectPin = (event: MapLayerMouseEvent) => {
    const gameId: unknown = event.features?.[0]?.properties?.gameId
    if (typeof gameId === 'string') this.onSelect(gameId)
  }

  private readonly pointAt = () => (this.map.getCanvas().style.cursor = 'pointer')
  private readonly stopPointing = () => (this.map.getCanvas().style.cursor = '')

  // Selecting a pin cluster, and selecting a card cluster, both zoom in until
  // their games split. Selecting an outer pin cluster brings its games' cards instead.

  /**
   * Centres the globe on an outer pin cluster, at the same zoom, so its games have score cards. The
   * zoom is given: left out, MapLibre's globe would zoom out turning towards a pole, maybe past
   * cardZoom, where every game would show as a small pin.
   */
  private readonly centreOnOuterPinCluster = (event: MapLayerMouseEvent) => {
    const cluster = event.features?.[0]
    if (!cluster) return
    const center = (cluster.geometry as Point).coordinates as [number, number]
    this.map.easeTo({ center, zoom: Math.max(this.map.getZoom(), cardZoom) })
  }

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

  private readonly zoomToCardClusterSelected = (event: MapLayerMouseEvent) => {
    const firstGameId: unknown = event.features?.[0]?.properties?.firstGameId
    const gameIds = typeof firstGameId === 'string' ? this.cards.cardClusterOf(firstGameId) : undefined
    if (gameIds) this.zoomToCardCluster(gameIds)
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
   * Plays an animation where a game shows on the globe: its score card, its small pin (zoomed out, or
   * far from the centre of the view), or the pin cluster it's in. Games not on the map (off screen)
   * don't animate.
   */
  private async animate(game: Game, animation: PinAnimation): Promise<void> {
    const map = this.map
    const { lng: longitude, lat: latitude } = map.getCenter()
    const zoomedIn = pinSize(map.getZoom()) === 'card'
    const card = zoomedIn && hasCard({ longitude, latitude }, game.venue)
    const sourceId = zoomedIn && !card ? outerPinSource : pinSource
    const source = map.getSource<GeoJSONSource>(sourceId)
    // Not waiting for the source to load: it's still taking in the games just shown, and until then
    // it has the pins as they were, which are where the changed games still are.
    if (!source) return
    const venue: [number, number] = [game.venue.longitude, game.venue.latitude]
    const target = animationTarget(game.id, venue, map.querySourceFeatures(sourceId) as Feature<Point>[])
    if (!target) return

    if (target.kind === 'pin') {
      if (card) this.cards.animate(game.id, animation)
      else pulse(map, this.colourOf(game), target.lngLat, animation, 'pin')
      return
    }

    for (const { clusterId, lngLat } of target.candidates) {
      // A pin cluster can be gone by the time it's asked (the data or zoom changed), so skip it.
      const leaves = await source.getClusterLeaves(clusterId, Infinity, 0).catch(() => [])
      if (this.destroyed) return
      if (leaves.some((leaf) => leaf.properties?.gameId === game.id)) {
        pulse(map, this.colourOf(game), lngLat, animation, 'cluster')
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
    const card = pinSize(this.map.getZoom()) === 'card' ? this.cards.cardOnPage(game.id) : null
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

/** No colours picked: every game in the theme's colours. */
const noColours: PickedColours = { sportColours: {}, leagueColours: {} }

/** Every layer the globe adds for the games in a theme, as gameLayers makes them. */
function gameLayersIn(theme: Theme, selectedGameId: string | null): LayerSpecification[] {
  const { belowNames, onTop } = gameLayers(theme, selectedGameId)
  return [...belowNames, ...onTop]
}

/** A fully transparent image, for the pins' invisible footprints. */
function addBlankImage(map: MapLibreMap, name: string, width: number, height: number): void {
  map.addImage(name, { width, height, data: new Uint8Array(width * height * 4) })
}
