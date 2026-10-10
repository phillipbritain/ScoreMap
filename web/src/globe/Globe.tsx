import { useEffect, useRef, type RefObject } from 'react'
import type { Game } from '../games/game'
import type { Camera } from './camera'
import type { CardStyle } from './cardStyle'
import { GlobeMap } from './globeMap'
import { baseStyleUrl, globeStyle } from './globeStyle'

interface GlobeProps {
  games: readonly Game[]
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
  /** The "Card style" setting. */
  cardStyle: CardStyle
}

/** The globe with the games' pins on it (see GlobeMap), kept in step with the app's state. */
export function Globe({
  games,
  selectedGameId,
  panel,
  onSelectGame,
  startCamera,
  onCameraMove,
  cardStyle,
}: GlobeProps) {
  const container = useRef<HTMLDivElement>(null)
  const globe = useRef<GlobeMap | null>(null)
  const latest = useRef({ onSelectGame, onCameraMove, startCamera })

  useEffect(() => {
    latest.current = { onSelectGame, onCameraMove, startCamera }
  }, [onSelectGame, onCameraMove, startCamera])

  useEffect(() => {
    if (!container.current) return
    const instance = new GlobeMap(container.current, {
      style: { url: baseStyleUrl, transform: globeStyle },
      startCamera: latest.current.startCamera,
      onSelect: (gameId) => latest.current.onSelectGame(gameId),
      onCameraMove: (camera) => latest.current.onCameraMove(camera),
    })
    globe.current = instance
    return () => {
      instance.destroy()
      globe.current = null
    }
  }, [])

  // In this order, so the selected game is among the games shown when the globe lifts it clear of
  // the panel. The panel opens in the same render, so it's on the page by now.
  useEffect(() => globe.current?.show(games), [games])
  useEffect(
    () => globe.current?.select(selectedGameId, panel.current?.getBoundingClientRect() ?? null),
    [selectedGameId, panel],
  )
  useEffect(() => globe.current?.setCardStyle(cardStyle), [cardStyle])

  return <div ref={container} className="globe" />
}
