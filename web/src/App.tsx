import { useEffect, useState } from 'react'
import type { Game } from './games/game'
import { applyChange } from './games/gameStore'
import { Globe } from './globe/Globe'
import { connectToGames } from './live/liveConnection'
import { GamePanel } from './panel/GamePanel'

export default function App() {
  const [games, setGames] = useState<Game[]>([])
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)

  useEffect(
    () =>
      connectToGames({
        onSnapshot: setGames,
        onChange: (change) => setGames((current) => applyChange(current, change)),
      }),
    [],
  )

  // Looked up in every snapshot, so the panel stays current; it closes if the game's pin goes.
  const selectedGame = games.find((game) => game.id === selectedGameId) ?? null

  return (
    <div className={selectedGame ? 'app app--panel-open' : 'app'}>
      <Globe games={games} selectedGameId={selectedGame?.id ?? null} onSelectGame={setSelectedGameId} />
      {selectedGame && <GamePanel game={selectedGame} onClose={() => setSelectedGameId(null)} />}
    </div>
  )
}
