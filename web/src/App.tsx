import { useEffect, useState } from 'react'
import type { Game } from './games/game'
import { applyChange } from './games/gameStore'
import { Globe } from './globe/Globe'
import { connectToGames } from './live/liveConnection'

export default function App() {
  const [games, setGames] = useState<Game[]>([])

  useEffect(
    () =>
      connectToGames({
        onSnapshot: setGames,
        onChange: (change) => setGames((current) => applyChange(current, change)),
      }),
    [],
  )

  return <Globe games={games} />
}
