import { useEffect, useState } from 'react'
import type { Game } from './games/game'
import { Globe } from './globe/Globe'
import { connectToGames } from './live/liveConnection'

export default function App() {
  const [games, setGames] = useState<Game[]>([])

  useEffect(() => connectToGames({ onSnapshot: setGames }), [])

  return <Globe games={games} />
}
