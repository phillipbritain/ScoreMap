import { LngLat, LngLatBounds, type EaseToOptions, type Map as MapLibreMap, type MapMovementEvent } from 'maplibre-gl'
import type { PlacedGame } from '../games/placedGames'
import type { ScoreCardMarkers } from './scoreCardMarkers'
import { clearCenter, liftClearOf, type ScreenBox } from './panelClearance'
import { centerLatitude, zoomAt, zoomAtEquator } from './zoomLevels'

/** How a selected game should be brought clear of its panel. */
export type SelectionIntent = 'lift' | 'center'

interface CameraMovesOptions {
  game: (gameId: string) => PlacedGame | undefined
  cards: Pick<ScoreCardMarkers, 'shows' | 'cardClusters'>
  pinOnPage: (game: PlacedGame) => ScreenBox
  onPick: (gameId: string) => void
  onSelection: (gameId: string | null) => void
}

const cardClusterZoomPadding = 120

/**
 * Selection intent and its camera moves. A list pick opens the panel first; select supplies its
 * box once React has put it on the page. All repeated moves share one pending completion, stopped
 * by a new selection, another camera move or disposal. MapLibre remains the camera itself.
 */
export class CameraMoves {
  private readonly map: MapLibreMap
  private readonly options: CameraMovesOptions
  private selectedGameId: string | null = null
  private pendingPick: string | null = null
  private completion: (() => void) | null = null
  private destroyed = false

  constructor(map: MapLibreMap, options: CameraMovesOptions) {
    this.map = map
    this.options = options
    map.on('movestart', this.moved)
    map.on('move', this.moved)
  }

  /** A Games-list pick: asks for its panel, or centers at once if that panel is already open. */
  pickGame(gameId: string, panel: ScreenBox | null): void {
    if (this.destroyed) return
    this.cancel()
    this.pendingPick = gameId
    this.options.onPick(gameId)
    if (this.selectedGameId === gameId) this.select(gameId, panel)
  }

  /** The current selection and its rendered panel, or a selection with an explicit camera intent. */
  select(gameId: string | null, panel: ScreenBox | null, intent?: SelectionIntent): void {
    if (this.destroyed) return
    const move = intent ?? (gameId !== null && this.pendingPick === gameId ? 'center' : 'lift')
    this.pendingPick = null
    const changed = gameId !== this.selectedGameId
    if (!changed && move === 'lift') return
    this.cancel()
    this.selectedGameId = gameId
    if (changed) this.options.onSelection(gameId)
    const game = gameId === null ? undefined : this.options.game(gameId)
    if (!game) return
    if (move === 'center') return this.center(game, panel)
    const lift = liftClearOf(this.options.pinOnPage(game), panel)
    if (lift <= 0) return
    const venue: [number, number] = [game.venue.longitude, game.venue.latitude]
    const { x, y } = this.map.project(venue)
    const { width, height } = this.map.getContainer().getBoundingClientRect()
    this.map.easeTo({ center: venue, offset: [x - width / 2, y - lift - height / 2], duration: 600 })
  }

  /** Zooms to fit a card cluster, then again while any of its games still have no room. */
  zoomToCardCluster(gameIds: readonly string[]): void {
    if (this.destroyed) return
    this.cancel()
    this.zoomCluster(gameIds)
  }

  /** A different camera command or changed zoom limits retires the pending retry. */
  cancel(): void {
    this.pendingPick = null
    if (this.completion) this.map.off('idle', this.completion)
    this.completion = null
  }

  destroy(): void {
    this.destroyed = true
    this.pendingPick = null
    this.cancel()
    this.map.off('movestart', this.moved)
    this.map.off('move', this.moved)
  }

  private readonly moved = (event: MapMovementEvent & { cameraMoves?: CameraMoves }) => {
    if (event.cameraMoves !== this) this.cancel()
  }

  /** One ease/idle/retry lifetime, shared by selected games and card clusters. */
  private ease(options: EaseToOptions & { zoom: number }, arrived: () => boolean, again: () => void): void {
    this.cancel()
    this.map.easeTo(options, { cameraMoves: this })
    const completed = () => {
      if (this.completion !== completed) return
      this.completion = null
      if (this.destroyed || Math.abs(this.map.getZoom() - options.zoom) >= 0.01 || !arrived() || options.zoom >= this.map.getMaxZoom()) return
      again()
    }
    this.completion = completed
    this.map.once('idle', completed)
  }

  private center(game: PlacedGame, panel: ScreenBox | null, atEquator = this.atEquator()): void {
    const globe = this.map.getContainer().getBoundingClientRect()
    const { x, y } = clearCenter(globe, panel)
    const offset: [number, number] = [x - (globe.left + globe.width / 2), y - (globe.top + globe.height / 2)]
    const center = new LngLat(game.venue.longitude, game.venue.latitude)
    const view = { height: this.map.getContainer().clientHeight, fov: this.map.getVerticalFieldOfView() }
    const zoom = Math.min(this.map.getMaxZoom(), zoomAt(centerLatitude(center.lat, offset[1], atEquator, view), atEquator))
    this.ease({ center, offset, zoom, duration: 600 }, () => true, () => {
      if (this.hasNoRoom(game.id)) this.center(game, panel, atEquator + 1)
    })
  }

  private zoomCluster(gameIds: readonly string[]): void {
    const bounds = new LngLatBounds()
    for (const gameId of gameIds) {
      const venue = this.options.game(gameId)?.venue
      if (venue) bounds.extend([venue.longitude, venue.latitude])
    }
    if (bounds.isEmpty()) return
    const fitted = this.map.cameraForBounds(bounds, { padding: cardClusterZoomPadding })?.zoom ?? 0
    const zoom = Math.min(this.map.getMaxZoom(), Math.max(this.map.getZoom() + 1, fitted))
    const center = bounds.getCenter()
    this.ease({ center, zoom }, () => this.map.getCenter().distanceTo(center) < 1, () => {
      const noRoom = gameIds.filter((id) => this.hasNoRoom(id))
      const clusters = this.options.cards.cardClusters().filter((cluster) => cluster.some((id) => noRoom.includes(id)))
      const still = [...new Set([...noRoom, ...clusters.flat()])]
      if (still.length > 0) this.zoomCluster(still)
    })
  }

  private hasNoRoom(gameId: string): boolean {
    const showing = this.options.cards.shows(gameId)
    return showing.as === 'inCardCluster' || showing.as === 'smallPin'
  }

  private atEquator(): number {
    return zoomAtEquator({ zoom: this.map.getZoom(), latitude: this.map.getCenter().lat })
  }
}
