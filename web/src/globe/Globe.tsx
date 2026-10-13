import { useEffect, useRef, type RefObject } from 'react'
import type { Game } from '../games/game'
import type { Theme } from '../theme/theme'
import type { Camera } from './camera'
import { GlobeMap, type LoadingStage } from './globeMap'
import { baseStyleUrl } from './globeStyle'

interface GlobeProps {
  /** The look of the globe and everything on it. A change restyles the globe in place (see GlobeMap.setTheme). */
  theme: Theme
  /** The games to show, or null until the server's first snapshot has arrived (see GlobeMap.stage). */
  games: readonly Game[] | null
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
}

/** The globe with the games' pins on it (see GlobeMap), kept in step with the app's state. */
export function Globe({ theme, games, selectedGameId, panel, onSelectGame, startCamera, onCameraMove, onStage }: GlobeProps) {
  const container = useRef<HTMLDivElement>(null)
  const globe = useRef<GlobeMap | null>(null)
  const latest = useRef({ onSelectGame, onCameraMove, onStage, startCamera, theme })

  useEffect(() => {
    latest.current = { onSelectGame, onCameraMove, onStage, startCamera, theme }
  }, [onSelectGame, onCameraMove, onStage, startCamera, theme])

  useEffect(() => {
    if (!container.current) return
    const instance = new GlobeMap(container.current, {
      style: { url: baseStyleUrl },
      theme: latest.current.theme,
      startCamera: latest.current.startCamera,
      onSelect: (gameId) => latest.current.onSelectGame(gameId),
      onCameraMove: (camera) => latest.current.onCameraMove(camera),
      onStage: (stage) => latest.current.onStage(stage),
    })
    globe.current = instance
    return () => {
      instance.destroy()
      globe.current = null
    }
  }, [])

  useEffect(() => globe.current?.setTheme(theme), [theme])
  // In this order, so the selected game is among the games shown when the globe lifts it clear of
  // the panel. The panel opens in the same render, so it's on the page by now.
  useEffect(() => globe.current?.show(games), [games])
  useEffect(
    () => globe.current?.select(selectedGameId, panel.current?.getBoundingClientRect() ?? null),
    [selectedGameId, panel],
  )

  return <div ref={container} className="globe" />
}
