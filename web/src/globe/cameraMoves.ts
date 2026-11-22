import { LngLat, type EaseToOptions, type Map as MapLibreMap, type MapMovementEvent } from 'maplibre-gl'
import type { PlacedGame } from '../games/placedGames'
import type { ScoreCardMarkers } from './scoreCardMarkers'
import { clearCenter, type ScreenBox } from './panelClearance'
import { centerLatitude, zoomAt, zoomAtEquator } from './zoomLevels'

/** Whether selecting a game leaves the camera where it is, or centers the game above its panel. */
export type SelectionIntent = 'still' | 'center'

interface CameraMovesOptions {
  game: (gameId: string) => PlacedGame | undefined
  cards: Pick<ScoreCardMarkers, 'shows'>
  onPick: (gameId: string) => void
  onSelection: (gameId: string | null) => void
}

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
    const move = intent ?? (gameId !== null && this.pendingPick === gameId ? 'center' : 'still')
    this.pendingPick = null
    const changed = gameId !== this.selectedGameId
    if (!changed && move === 'still') return
    this.cancel()
    this.selectedGameId = gameId
    if (changed) this.options.onSelection(gameId)
    if (move === 'still') return
    const game = gameId === null ? undefined : this.options.game(gameId)
    if (game) this.center(game, panel)
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

  /** One ease and retry while centering the selected game. */
  private ease(options: EaseToOptions & { zoom: number }, again: () => void): void {
    this.cancel()
    this.map.easeTo(options, { cameraMoves: this })
    const completed = () => {
      if (this.completion !== completed) return
      this.completion = null
      if (this.destroyed || Math.abs(this.map.getZoom() - options.zoom) >= 0.01 || options.zoom >= this.map.getMaxZoom()) return
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
    this.ease({ center, offset, zoom, duration: 600 }, () => {
      if (this.hasNoRoom(game.id)) this.center(game, panel, atEquator + 1)
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
