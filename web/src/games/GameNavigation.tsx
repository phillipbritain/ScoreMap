import { useLayoutEffect, useRef } from 'react'
import type { Game } from './game'
import { gameLabel } from './gameLabel'

/** Every filtered game, independent of the camera and of which pins have joined a cluster. */
export function GameNavigation({ games, onSelect, inert }: {
  games: readonly Game[]
  onSelect: (gameId: string) => void
  inert: boolean
}) {
  const summary = useRef<HTMLElement>(null)
  const focusedGame = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (focusedGame.current && !focusedGame.current.isConnected && document.activeElement === document.body) {
      summary.current?.focus({ preventScroll: true })
    }
  })
  return (
    <details className="game-navigation" inert={inert} onKeyDown={(event) => {
      if (event.key !== 'Escape') return
      event.currentTarget.open = false
      summary.current?.focus()
      event.stopPropagation()
    }}>
      <summary ref={summary} data-game-navigation>Games ({games.length})</summary>
      <ul aria-label="Games" onFocus={(event) => { focusedGame.current = event.target }}>
        {games.map((game) => (
          <li key={game.id}>
            <button type="button" data-game-id={game.id} onClick={() => onSelect(game.id)}>{gameLabel(game)}</button>
          </li>
        ))}
        {games.length === 0 && <li>No games match your filters.</li>}
      </ul>
    </details>
  )
}
