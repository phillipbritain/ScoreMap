import { useEffect, useMemo, useState } from 'react'
import { FilterMenu } from './filters/FilterMenu'
import { useLeagues } from './filters/leagues'
import { settingsStore } from './filters/settingsStore'
import { noPinsMessage, visibleGames } from './filters/visibleGames'
import type { Game } from './games/game'
import { Globe } from './globe/Globe'
import { connectToGames } from './live/liveConnection'

const store = settingsStore(() => window.localStorage)

export default function App() {
  // Null until the server's first snapshot arrives.
  const [games, setGames] = useState<Game[] | null>(null)
  const [viewerSettings, setViewerSettings] = useState(store.load)
  const leagues = useLeagues()

  useEffect(() => connectToGames({ onSnapshot: setGames }), [])
  useEffect(() => store.save(viewerSettings), [viewerSettings])

  const visible = useMemo(() => visibleGames(games ?? [], viewerSettings), [games, viewerSettings])
  const message = noPinsMessage(games, visible)

  return (
    <>
      <Globe games={visible} />
      <FilterMenu leagues={leagues} settings={viewerSettings} onChange={setViewerSettings} />
      {message && (
        <p className="no-pins" role="status">
          {message}
        </p>
      )}
    </>
  )
}
