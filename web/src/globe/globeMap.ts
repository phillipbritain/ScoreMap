import {
  Map as MapLibreMap,
  setWorkerUrl,
  type LayerSpecification,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Game } from '../games/game'
import { placedGames, type PlacedGame } from '../games/placedGames'
import { changeSince, lastNumber, noneJustHappened, type JustHappened } from '../games/justHappened'
import { gameColor, type PickedColors } from '../settings/gameColor'
import type { CardCount, CardPositionPriority, MapType } from '../settings/viewerSettings'
import type { Theme } from '../theme/theme'
import { addBlankImage } from './blankImage'
import type { Camera } from './camera'
import { CameraMoves, type SelectionIntent } from './cameraMoves'
import { cityLabelSettings, type CityLabelSettings } from './cityLabels'
import { gameLayers } from './gameLayers'
import { addGlobeGlow, type GlobeGlow } from './globeGlow'
import { globeStyle, satelliteLayer, showStateLines } from './globeStyle'
import { fadeNearHorizon } from './horizon'
import { traceLayouts } from './layoutTrace'
import { mapTypeFade } from './mapTypeFade'
import { globeSettling, type GlobeSettling } from './globeSettling'
import type { ScreenBox } from './panelClearance'
import { Orbit } from './orbit'
import { pinAnimation, type PinAnimation } from './pinAnimation'
import type { PinnedCards } from '../games/pinnedCards'
import { cardPinMenu } from './cardPinMenu'
import { drawHotIndicatorsOnDemand } from './hotIndicator'
import {
  cardClusterLayer,
  cardlessSmallPinLayer,
  cardFootprint,
  cardLayoutSource,
  cardLayoutSourceSpec,
  overTrails,
} from './cardLayoutLayers'
import { clusterFootprint } from './pinLayers'
import { addPinSource, type PinSource } from './pinSource'
import { applyLayerChanges, layerChanges, type LayerChange } from './restyle'
import { addPlaceNames, cityNameSource, firstPlaceNameLayer, gameCityNameLayer, type PlaceNames } from './placeNames'
import { ScoreCardMarkers, type ShownScoreCard } from './scoreCardMarkers'
import { trailLayer, type TrailLayer } from './trailLayer'
import { zoomSettings as appZoomSettings, type ZoomSettings } from './zoomLevels'

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
  /** What decides which cities are labeled, to start with: the app's own unless given. It changes with setCityLabelSettings. */
  cityLabels?: CityLabelSettings
  /** The colors the viewer picked for games, to start with: none unless given. They change with setColors. */
  colors?: PickedColors
  /** Whether hot games show their indicator, to start with: on unless given. It changes with setHotIndicators. */
  hotIndicator?: boolean
  /**
   * The map type to start with (see globeStyle), when made over from a base style: the plain map
   * unless given. It changes with setMapType.
   */
  mapType?: MapType
  /** How many score cards show at once where it's busy, to start with (see mostCards): Default unless given. It changes with setCardCount. */
  cardCount?: CardCount
  cardPositionPriority?: CardPositionPriority
  scoreCardPins?: PinnedCards
  /**
   * How far out and in the globe zooms to start with: the app's own for a laptop unless given. They
   * change with setZoomLimits.
   */
  zoomSettings?: ZoomSettings
  /** Where the globe opens. */
  startCamera: Camera
  /** Called with a game's id when the viewer selects its pin or score card. */
  onSelect: (gameId: string) => void
  /** Called when the camera settles somewhere new, so it can be saved for the next visit. */
  onCameraMove: (camera: Camera) => void
  onOrbitChange?: (active: boolean) => void
  /**
   * Called each time the stage moves on (see stage): to drawing, then to ready, or an initial style error. Until
   * ready, the globe takes no keyboard input (the loading screen's dim takes the pointer's and touch).
   */
  onStage: (stage: LoadingStage) => void
}

/**
 * How far the globe's initial load has got: waiting for the server's first snapshot of games, then
 * drawing them until it first settles (or would but for score cards that have given up settling), then
 * ready (see GLOSSARY.md) for as long as the globe exists. Initialization errors replace loading
 * with a retry action; a construction error is reported by Globe when no GlobeMap could be created.
 */
export type LoadingStage = 'waitingForGames' | 'drawing' | 'ready' | 'styleError' | 'constructionError'

/**
 * MapLibre globe with a pin at each game's venue. At every zoom, each game whose venue is on screen
 * on the side of the globe facing the viewer is a score card, as many as the card count allows (see
 * layOutCards); cards past it or with no room form card clusters, or show as small pins. Clicking a
 * card cluster or small pin gives its games priority in the current view.
 */
export class GlobeMap {
  private readonly map: MapLibreMap
  private theme: Theme
  /** The colors the viewer picked for games (see gameColor). */
  private colors: PickedColors
  /** Whether hot games show their indicator (see hotIndicatorOf). */
  private hotIndicator: boolean
  /** The map type the globe's style is made in (see globeStyle). */
  private mapType: MapType
  /** The base style the globe's style was made over from, once it has loaded (none for a finished style). */
  private base: StyleSpecification | null = null
  private readonly cards: ScoreCardMarkers
  /** The moved cards' trails, drawn on the map (see trailLayer). */
  private readonly trails: TrailLayer
  private readonly names: PlaceNames
  /** What the city labels are chosen by (see setCityLabelSettings). */
  private cityLabels: CityLabelSettings
  private readonly glow: GlobeGlow
  private stopCardPinMenu?: () => void
  /** Stops fading place names and pins near the horizon (see fadeNearHorizon). */
  private readonly stopHorizonFade: () => void
  private readonly onSelect: (gameId: string) => void
  private readonly onCameraMove: (camera: Camera) => void
  /**
   * The games as the globe last showed them, which tells which of the next ones were shown both times:
   * only those whose venues are placed (see placedGames), so a game coming into place appears at its venue.
   */
  private shown = new Map<string, PlacedGame>()
  /** The number of the latest change from the server the globe has played (see show), so none plays twice. */
  private changesPlayed = 0
  /** The globe's pin source, added once the style loads (see addPins). */
  private pins: PinSource | null = null
  private selectedGameId: string | null = null
  private readonly moves: CameraMoves
  private readonly orbit: Orbit
  /** The furthest in the globe zooms (see fittedZoomSettings), which changes with setZoomLimits. */
  private maxZoom: number
  private destroyed = false
  /** When the globe is still, and when it's Ready (see GlobeSettling): the score cards report to it too. */
  private readonly settling: GlobeSettling
  /** A change of map type under way, the new map fading in over the old (see setMapType). */
  private readonly mapTypeFade = mapTypeFade()

  constructor(
    container: HTMLElement,
    { style, theme, cityLabels = cityLabelSettings, colors = noColors, hotIndicator = true, mapType = 'plain', cardCount = 'default', cardPositionPriority = 'venue', scoreCardPins, zoomSettings = appZoomSettings, startCamera, onSelect, onCameraMove, onOrbitChange, onStage }: GlobeMapOptions,
  ) {
    this.colors = colors
    this.hotIndicator = hotIndicator
    this.mapType = mapType
    this.onSelect = onSelect
    this.onCameraMove = onCameraMove
    this.cityLabels = cityLabels
    this.maxZoom = zoomSettings.maxZoom
    const map = new MapLibreMap({
      container,
      center: [startCamera.longitude, startCamera.latitude],
      zoom: startCamera.zoom,
      minZoom: zoomSettings.minZoom,
      maxZoom: zoomSettings.maxZoom,
      attributionControl: false,
      // Place names are placed afresh every frame, not once each fade has played: between placements
      // they turn with the globe, so names gone over the horizon were still written at its edge.
      // They pop in and out (score cards fade).
      fadeDuration: 0,
      // A double click while turning the globe is more often a slip than a wish to zoom in.
      doubleClickZoom: false,
      // The globe is only turned and zoomed, never rotated or tilted: north stays up.
      dragRotate: false,
      touchPitch: false,
    })
    this.map = map
    this.theme = theme
    // The map takes keys once the globe is ready (see GlobeSettling.wentIdle).
    this.settling = globeSettling({
      onStage,
      onReady: () => {
        map.keyboard.enable()
        showStateLines(map)
      },
    })
    try {
      map.touchZoomRotate.disableRotation()
      // The loading screen's dim takes pointer and touch input until the globe is ready, but not keys.
      map.keyboard.disable()
      traceLayouts(map, { stage: () => this.stage(), settled: () => this.settled() })
      // Made over in the theme and map type as they are when the base style loads, which setTheme and
      // setMapType may have changed by then.
      const transformStyle = (_previous: unknown, base: StyleSpecification) => {
        this.base = base
        return globeStyle(base, this.theme, this.mapType)
      }
      map.on('error', this.initialStyleError)
      if ('url' in style) map.setStyle(style.url, { transformStyle })
      else map.setStyle(style)
      const currentTheme = () => this.theme
      this.glow = addGlobeGlow(map, currentTheme)
      this.names = addPlaceNames(map, currentTheme, cityLabels)
      // City names fade out as they near the horizon, which they'd crowd: all but the names of the
      // games' cities, which show with their games' cards.
      this.stopHorizonFade = fadeNearHorizon(map, [cityNameSource], (_source, id) => this.names.namesAGame(id))
      this.trails = trailLayer(currentTheme)
      this.cards = new ScoreCardMarkers(
        map,
        currentTheme,
        this.colorOf,
        this.hotIndicatorOf,
        this.names,
        this.trails,
        (gameId) => {
          this.stopOrbit()
          this.onSelect(gameId)
        },
        this.settling,
        cardCount,
        cardPositionPriority,
        scoreCardPins,
      )
      if (scoreCardPins) this.stopCardPinMenu = cardPinMenu(container, scoreCardPins)
      this.moves = new CameraMoves(map, {
        game: (gameId) => this.shown.get(gameId),
        cards: this.cards,
        onPick: (gameId) => this.onSelect(gameId),
        onSelection: (gameId) => {
          this.unsettle()
          this.selectedGameId = gameId
          this.cards.setSelected(gameId)
          this.pins?.select(gameId)
        },
      })
      this.orbit = new Orbit(
        map,
        () => Array.from(this.shown.values(), (game) => game.venue),
        (active) => onOrbitChange?.(active),
      )
      container.addEventListener('pointerdown', this.stopOrbit, true)
      container.addEventListener('wheel', this.stopOrbit, { capture: true, passive: true })
      drawHotIndicatorsOnDemand(map)

      map.on('style.load', this.addPins)
      // Each frame event syncs the cards, then tells the settling: one listener for each, so the
      // settling always hears of a frame or idle after that event's card sync (see frameDrawn, wentIdle).
      map.on('render', this.frameDrawn)
      map.on('idle', this.wentIdle)
      map.on('click', cardClusterLayer, this.clickCardCluster)
      map.on('click', cardlessSmallPinLayer, this.clickSmallPin)
      for (const layer of [cardClusterLayer, cardlessSmallPinLayer]) {
        map.on('mouseenter', layer, this.pointAt)
        map.on('mouseleave', layer, this.stopPointing)
      }

      // Remember where the viewer leaves the globe.
      map.on('moveend', this.saveCamera)
      window.addEventListener('pagehide', this.saveCamera)
    } catch (error) {
      this.destroy()
      throw error
    }
  }

  /**
   * Shows these games, and animates the ones the server said changed (see pinAnimation), each change
   * once: a change already played doesn't play again when the games are shown again, say for the
   * viewer's settings. Only a game shown both times can animate. A game coming into view (a new game,
   * one newly placed, or one the viewer's settings showed again) appears without one. Given no changes
   * (games from a snapshot, after ScoreMap was asleep or cut off), nothing animates: what changed while
   * it was away didn't just happen.
   *
   * Given null (no games yet: the server's first snapshot hasn't arrived), it shows nothing and keeps
   * waiting for games (see stage). An empty list is a snapshot with no games in it.
   *
   * A game whose venue isn't placed (its lookup pending, or found nothing) is left off the globe
   * altogether: no pin, card, name or ring. Once placed, it comes into view at its venue.
   */
  show(games: readonly Game[] | null, justHappened: JustHappened = noneJustHappened): void {
    if (!games) return
    this.settling.gamesArrived()
    this.unsettle()
    const placed = placedGames(games)
    const before = this.shown
    this.shown = new Map(placed.map((game) => [game.id, game]))
    this.pins?.showGames(placed)
    // Names first: cards are laid out around them.
    this.names.showGames(placed)
    this.cards.setGames(placed, justHappened)
    const played = this.changesPlayed
    this.changesPlayed = Math.max(played, lastNumber(justHappened))
    for (const game of placed) {
      const kind = before.has(game.id) ? changeSince(justHappened, game.id, played) : null
      const animation = kind && pinAnimation(kind, game)
      if (animation) this.animate(game, animation)
      // A game finishing celebrates on its score card, where it has one on screen.
      if (kind === 'Finished') this.cards.celebrate(game.id)
    }
  }

  /** Highlights the selected game, leaving the camera where it is unless it was picked from the Games list (see pickGame) or `intent` is 'center'. */
  select(gameId: string | null, panel: ScreenBox | null = null, intent?: SelectionIntent): void {
    this.moves.select(gameId, panel, intent)
  }

  /** Picks a game from the Games list, opening its panel before centering it above the panel. */
  pickGame(gameId: string, panel: ScreenBox | null): void {
    this.stopOrbit()
    this.moves.pickGame(gameId, panel)
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
    applyLayerChanges(this.map, [
      ...this.mapStyleChanges(was, this.mapType),
      ...layerChanges(gameLayersIn(was, this.selectedGameId), gameLayersIn(theme, this.selectedGameId)),
    ])
    this.pins?.themeChanged(theme)
    this.glow.place()
    this.cards.restyle()
  }

  /**
   * Draws the globe as this map type from now on (see globeStyle), in place, as setTheme restyles it:
   * the plain map's and the satellite map's layers are shown or hidden. The change cross-fades (see
   * mapTypeFade): the new map's layers show alongside the old one's while its tiles load, then the
   * satellite imagery fades in or out over the plain map, and the old map's layers are hidden. Pins,
   * score cards and place names are left as they are.
   */
  setMapType(mapType: MapType): void {
    if (mapType === this.mapType) return
    const was = this.mapType
    this.mapType = mapType
    this.unsettle()
    const changes = this.mapStyleChanges(this.theme, was)
    const hiding = (change: LayerChange) => change.kind === 'layout' && change.property === 'visibility' && change.value === 'none'
    const map = this.map
    this.mapTypeFade.start(mapType, {
      showBoth: () => applyLayerChanges(map, changes.filter((change) => !hiding(change))),
      hideOld: () => {
        this.unsettle()
        applyLayerChanges(map, changes.filter(hiding))
      },
      fadeImagery: (opacity, ms) => {
        map.setPaintProperty(satelliteLayer, 'raster-opacity-transition', { duration: ms, delay: 0 })
        map.setPaintProperty(satelliteLayer, 'raster-opacity', opacity)
      },
      onceLoaded: (then) => {
        map.once('idle', then)
        return () => map.off('idle', then)
      },
    })
  }

  /** What to set on the map style's layers to restyle them to the theme and map type the globe has now, from these. */
  private mapStyleChanges(theme: Theme, mapType: MapType): LayerChange[] {
    if (!this.base) return []
    return layerChanges(globeStyle(this.base, theme, mapType).layers, globeStyle(this.base, this.theme, this.mapType).layers)
  }

  /** Shows as many score cards at once as this card count allows from now on (see mostCards). */
  setCardCount(count: CardCount): void {
    this.unsettle()
    this.cards.setCardCount(count)
  }

  setCardPositionPriority(priority: CardPositionPriority): void {
    this.cards.setCardPositionPriority(priority)
  }

  /** Shows each game in these colors from now on (see gameColor): its pin, score card, trail and pulses. */
  setColors(colors: PickedColors): void {
    if (colors === this.colors) return
    this.colors = colors
    this.unsettle()
    this.pins?.showGames([...this.shown.values()])
    this.cards.restyle()
  }

  /** A game's color, in the colors and theme the globe has now. */
  private readonly colorOf = (game: Game): string => gameColor(this.colors, game, this.theme)

  /**
   * Shows the hot indicator on hot games from now on, or no longer: on their score cards, small pins and the
   * clusters they're in. A game stays hot either way, still ranked first for a card (see cardRank).
   */
  setHotIndicators(on: boolean): void {
    if (on === this.hotIndicator) return
    this.hotIndicator = on
    this.unsettle()
    this.pins?.showGames([...this.shown.values()])
    this.cards.restyle()
  }

  /** Whether a game shows the hot indicator now: a hot game, while they're on. */
  private readonly hotIndicatorOf = (game: Game): boolean => this.hotIndicator && game.hot

  /** Labels cities by these settings from now on. */
  setCityLabelSettings(settings: CityLabelSettings): void {
    if (settings === this.cityLabels) return
    this.cityLabels = settings
    this.unsettle()
    this.names.setSettings(settings)
  }

  /**
   * Zooms no further out or in than these from now on (as the window is resized, see
   * fittedZoomSettings, and as the map type changes).
   */
  setZoomLimits({ minZoom, maxZoom }: ZoomSettings): void {
    this.moves.cancel()
    this.map.setMinZoom(minZoom)
    this.maxZoom = maxZoom
    // Zoomed in past the new limit (on the satellite map, switching back to the plain map's): eases
    // out to it, then holds there. MapLibre would jump there at once.
    if (this.map.getZoom() > maxZoom) {
      // The ease first: it ends any move going, whose end isn't this ease's.
      this.map.easeTo({ zoom: maxZoom })
      this.map.once('moveend', () => this.map.setMaxZoom(this.maxZoom))
    } else this.map.setMaxZoom(maxZoom)
  }

  /**
   * Whether everything the globe was last given is on screen and still: the pin source has loaded
   * the games, the map has drawn them and gone idle (tiles loaded, the camera still, every place name
   * placed), the score cards have settled, and no change of map type is still fading in. Still right
   * now: false again after any change or move, so tests and scripts wait on it after one. For the
   * initial load, see stage.
   */
  settled(): boolean {
    return this.settling.settled({ pinsLoaded: this.pinsLoaded() }) && !this.mapTypeFade.running()
  }

  /** Whether the pin source has loaded the games last given it (not before the style loads). */
  private pinsLoaded(): boolean {
    return this.pins?.loaded() ?? false
  }

  /**
   * How far the initial load has got: waiting for games until it's first given some (see show),
   * drawing until it first settles, or would but for score cards that have given up settling (see
   * GlobeSettling.wentIdle), then ready for good, through pans, changes of games, fresh snapshots and
   * reconnections. Everything that waits for the globe to load reads this; settled
   * says whether it's still right now. A failed initial style stays at styleError until destroyed.
   */
  stage(): LoadingStage {
    return this.settling.stage()
  }

  /** The score cards on the page now that a viewer can see, none while pins are small (see ScoreCardMarkers.shownCards). */
  shownScoreCards(): ShownScoreCard[] {
    return this.cards.shownCards()
  }

  /**
   * Whether the score cards have stopped moving: the last frame laid them out just as the frame
   * before did. Unlike settled, this holds while the camera moves, so tests can tell the frame a
   * pan stops on still had the cards settling.
   */
  cardsSteady(): boolean {
    return this.settling.cardsSteady()
  }

  /** Zooms in one step, as MapLibre's own zoom button does (the rail's zoom in). */
  zoomIn(): void {
    this.stopOrbit()
    this.moves.cancel()
    this.map.zoomIn()
  }

  /** Zooms out one step, as MapLibre's own zoom button does (the rail's zoom out). */
  zoomOut(): void {
    this.stopOrbit()
    this.moves.cancel()
    this.map.zoomOut()
  }

  /**
   * Flies the camera there (the rail's Home). Only the camera moves: the selected game stays
   * selected.
   */
  flyTo(camera: Camera): void {
    this.stopOrbit()
    this.moves.cancel()
    this.map.flyTo({ center: [camera.longitude, camera.latitude], zoom: camera.zoom })
  }

  startOrbit(): void {
    this.moves.cancel()
    this.orbit.start()
  }

  readonly stopOrbit = (): void => this.orbit.stop()

  /** Removes the globe from the page, with everything it listens to. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.stopCardPinMenu?.()
    this.moves?.destroy()
    this.orbit?.destroy()
    this.map.getContainer().removeEventListener('pointerdown', this.stopOrbit, true)
    this.map.getContainer().removeEventListener('wheel', this.stopOrbit, true)
    this.mapTypeFade.destroy()
    this.map.off('error', this.initialStyleError)
    window.removeEventListener('pagehide', this.saveCamera)
    this.cards?.clear()
    this.glow?.remove()
    this.names?.remove()
    this.stopHorizonFade?.()
    this.map.remove()
  }

  // A style request/validation failure leaves no style. Tiles, glyphs and sprites fail after
  // the style exists, and must not replace a usable globe with the initialization error.
  private readonly initialStyleError = () => {
    if (this.destroyed || this.map.getStyle()) return
    this.settling.styleFailed()
  }

  private readonly addPins = () => {
    const map = this.map
    map.setProjection({ type: 'globe' })
    const pins = addPinSource(map, { games: [...this.shown.values()], theme: this.theme, colorOf: this.colorOf, hotIndicatorOf: this.hotIndicatorOf })
    this.pins = pins
    map.addSource(cardLayoutSource, cardLayoutSourceSpec)
    addBlankImage(map, cardFootprint.image, cardFootprint.width, cardFootprint.height)
    addBlankImage(map, clusterFootprint.image, clusterFootprint.size, clusterFootprint.size)
    const layers = gameLayers(this.theme, this.selectedGameId)
    const belowNames = firstPlaceNameLayer(map.getStyle())
    for (const layer of layers.belowNames) map.addLayer(layer, belowNames)
    // Beneath the venue clusters and card clusters, as their trails end at them.
    map.addLayer(this.trails, overTrails)
    for (const layer of layers.belowGameNames) map.addLayer(layer, gameCityNameLayer)
  }

  /** The map has drawn a frame: the cards follow the pin source, which changes as the camera moves and data arrives. */
  private readonly frameDrawn = () => {
    this.cards.sync()
    this.settling.frameDrawn()
  }

  /**
   * The map has gone idle, with nothing loading, moving or left to place (see settled). The cards
   * sync first, as this can be the first the pin source counts as loaded: MapLibre lets go of tiles
   * held over from the last load after a frame's render event, and goes idle without drawing another
   * frame (as after the pin source reloads). Only then is the settling told, so Ready is checked
   * after this idle's card sync.
   */
  private readonly wentIdle = () => {
    this.cards.sync()
    this.settling.wentIdle({ pinsLoaded: this.pinsLoaded() })
  }

  /** Not settled until the map has drawn a frame since, so drawing one even if nothing else asks for it. */
  private unsettle(): void {
    this.settling.unsettle()
    this.map.triggerRepaint()
  }

  private readonly clickSmallPin = (event: MapLayerMouseEvent) => {
    const gameId: unknown = event.features?.[0]?.properties?.gameId
    if (typeof gameId !== 'string') return
    this.cards.reveal([gameId])
  }

  private readonly pointAt = () => {
    this.map.getCanvas().style.cursor = 'pointer'
  }

  private readonly stopPointing = () => (this.map.getCanvas().style.cursor = '')

  private readonly clickCardCluster = (event: MapLayerMouseEvent) => {
    const firstGameId: unknown = event.features?.[0]?.properties?.firstGameId
    const showing = typeof firstGameId === 'string' ? this.cards.shows(firstGameId) : undefined
    if (showing?.as !== 'inCardCluster') return
    this.cards.reveal(showing.cardCluster)
  }

  /**
   * Plays an animation where a game shows on the globe: its score card, the card cluster it's in, or
   * its small pin. Games not on screen don't animate.
   */
  private animate(game: PlacedGame, animation: PinAnimation): void {
    this.cards.animate(game.id, animation)
  }

  private readonly saveCamera = () => {
    const { lng, lat } = this.map.getCenter().wrap()
    this.onCameraMove({ longitude: lng, latitude: lat, zoom: this.map.getZoom() })
  }
}

/** No colors picked: every game in the theme's colors. */
const noColors: PickedColors = { sportColors: {}, leagueColors: {} }

/** Every layer the globe adds for the games in a theme, as gameLayers makes them. */
function gameLayersIn(theme: Theme, selectedGameId: string | null): LayerSpecification[] {
  const { belowNames, belowGameNames } = gameLayers(theme, selectedGameId)
  return [...belowNames, ...belowGameNames]
}
