import { useEffect, useImperativeHandle, useRef, type Ref, type RefObject } from 'react'
import type { Game } from '../games/game'
import type { RecentChanges } from '../games/recentChanges'
import type { PickedColors } from '../settings/gameColor'
import type { MapType } from '../settings/viewerSettings'
import type { Theme } from '../theme/theme'
import type { Camera } from './camera'
import type { CityLabelSettings } from './cityLabels'
import { GlobeMap, type LoadingStage } from './globeMap'
import type { ShownScoreCard } from './scoreCardMarkers'
import type { FittedZoom } from './zoomLevels'
import { baseStyleUrl } from './globeStyle'

interface GlobeProps {
  /** The look of the globe and everything on it. A change restyles the globe in place (see GlobeMap.setTheme). */
  theme: Theme
  /** What decides which cities are labeled. A change relabels them in place (see GlobeMap.setCityLabelSettings). */
  cityLabels: CityLabelSettings
  /** How far out and in the globe zooms. A change applies at once (see GlobeMap.setZoomLimits). */
  zoomSettings: FittedZoom
  /** The colors the viewer picked for games. A change recolors them in place (see GlobeMap.setColors). */
  colors: PickedColors
  /** What the globe is drawn as (see globeStyle). A change restyles it in place (see GlobeMap.setMapType). */
  mapType: MapType
  /** Whether each game is ringed at the reach its city label may be within (a local-run tool). */
  showGameCityReach: boolean
  /** The games to show, or null until the server's first snapshot has arrived (see GlobeMap.stage). */
  games: readonly Game[] | null
  /**
   * What the server said changed in the games since its last snapshot, for the globe to animate, each
   * change once (see GlobeMap.show).
   */
  changes: RecentChanges
  /**
   * The game whose panel is open: its pin is highlighted, and the globe lifts it clear of the panel
   * if the panel would cover it.
   */
  selectedGameId: string | null
  /** The game panel's element, there once the panel has opened. */
  panel: RefObject<HTMLElement | null>
  onSelectGame: (gameId: string) => void
  /** Where the globe opens. Only read when the globe is created. */
  startCamera: Camera
  /** Called when the camera settles somewhere new, so it can be saved for the next visit. */
  onCameraMove: (camera: Camera) => void
  /** Called each time the globe's initial load moves on a stage (see GlobeMap.stage). */
  onStage: (stage: LoadingStage) => void
  /**
   * Whether the globe can't be dragged, zoomed or have anything on it selected, by pointer or
   * keyboard, while the welcome tour shows.
   */
  inert?: boolean
  /** Takes how the rail steers the globe's camera, and how the welcome tour finds its score cards. */
  ref?: Ref<GlobeHandle>
}

/**
 * The app's hold on the globe (see GlobeMap): its camera, for the rail's zoom buttons and Home and the
 * behavior tuner, and the score cards shown, for the welcome tour to point at.
 */
export interface GlobeHandle {
  zoomIn: () => void
  zoomOut: () => void
  flyTo: (camera: Camera) => void
  jumpTo: (camera: Camera) => void
  /** Centers a game picked from the Games list clear of the game panel (see GlobeMap.centerOn). */
  centerOn: (gameId: string) => void
  /** The score cards a viewer can see now, none before the globe is made (see GlobeMap.shownScoreCards). */
  shownScoreCards: () => ShownScoreCard[]
}

/** The globe with the games' pins on it (see GlobeMap), kept in step with the app's state. */
export function Globe({ theme, cityLabels, zoomSettings, colors, mapType, showGameCityReach, games, changes, selectedGameId, panel, onSelectGame, startCamera, onCameraMove, onStage, inert = false, ref }: GlobeProps) {
  const container = useRef<HTMLDivElement>(null)
  const globe = useRef<GlobeMap | null>(null)
  const latest = useRef({ onSelectGame, onCameraMove, onStage, startCamera, theme, cityLabels, zoomSettings, colors, mapType })

  useEffect(() => {
    latest.current = { onSelectGame, onCameraMove, onStage, startCamera, theme, cityLabels, zoomSettings, colors, mapType }
  }, [onSelectGame, onCameraMove, onStage, startCamera, theme, cityLabels, zoomSettings, colors, mapType])

  useEffect(() => {
    if (!container.current) return
    let instance: GlobeMap
    try {
      instance = new GlobeMap(container.current, {
        style: { url: baseStyleUrl },
        theme: latest.current.theme,
        cityLabels: latest.current.cityLabels,
        zoomSettings: latest.current.zoomSettings,
        colors: latest.current.colors,
        mapType: latest.current.mapType,
        startCamera: latest.current.startCamera,
        onSelect: (gameId) => latest.current.onSelectGame(gameId),
        onCameraMove: (camera) => latest.current.onCameraMove(camera),
        onStage: (stage) => {
          if (stage === 'styleError') {
            globe.current?.destroy()
            globe.current = null
          }
          latest.current.onStage(stage)
        },
      })
    } catch {
      latest.current.onStage('constructionError')
      return
    }
    globe.current = instance
    return () => {
      instance.destroy()
      globe.current = null
    }
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => globe.current?.zoomIn(),
      zoomOut: () => globe.current?.zoomOut(),
      flyTo: (camera) => globe.current?.flyTo(camera),
      jumpTo: (camera) => globe.current?.jumpTo(camera),
      centerOn: (gameId) => globe.current?.centerOn(gameId, panel.current?.getBoundingClientRect() ?? null),
      shownScoreCards: () => globe.current?.shownScoreCards() ?? [],
    }),
    [panel],
  )

  useEffect(() => globe.current?.setTheme(theme), [theme])
  useEffect(() => globe.current?.setCityLabelSettings(cityLabels), [cityLabels])
  useEffect(() => globe.current?.setZoomLimits(zoomSettings), [zoomSettings])
  useEffect(() => globe.current?.setColors(colors), [colors])
  useEffect(() => globe.current?.setMapType(mapType), [mapType])
  useEffect(() => globe.current?.showGameCityReach(showGameCityReach), [showGameCityReach])
  // In this order, so the selected game is among the games shown when the globe lifts it clear of
  // the panel. The panel opens in the same render, so it's on the page by now.
  useEffect(() => globe.current?.show(games, changes), [games, changes])
  useEffect(
    () => globe.current?.select(selectedGameId, panel.current?.getBoundingClientRect() ?? null),
    [selectedGameId, panel],
  )

  return <div ref={container} className="globe" inert={inert} />
}
