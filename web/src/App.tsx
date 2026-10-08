import { useEffect, useMemo, useState } from 'react'
import { FilterMenu } from './filters/FilterMenu'
import { useLeagues } from './filters/leagues'
import { settingsStore } from './filters/settingsStore'
import { noPinsMessage, visibleGames } from './filters/visibleGames'
import type { Game } from './games/game'
import { applyChange } from './games/gameStore'
import { Globe } from './globe/Globe'
import { startCamera } from './globe/startCamera'
import { connectToGames } from './live/liveConnection'
import { GamePanel } from './panel/GamePanel'
import { ScenarioPill } from './scenarios/ScenarioPill'
import { withRunning, type ScenarioListing } from './scenarios/scenarioPicker'

const store = settingsStore(() => window.localStorage)

/** Where the globe opens. Read once: the globe owns its camera after that. */
function openingCamera() {
  return startCamera(store.loadCamera(), {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language,
  })
}

export default function App() {
  // Null until the server's first snapshot arrives.
  const [games, setGames] = useState<Game[] | null>(null)
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const [viewerSettings, setViewerSettings] = useState(store.load)
  const [camera] = useState(openingCamera)
  const leagues = useLeagues()
  // What the scenario pill shows; null until the server has said.
  const [scenarios, setScenarios] = useState<ScenarioListing | null>(null)

  useEffect(
    () =>
      connectToGames({
        onSnapshot: setGames,
        // The snapshot always comes first; a change before it has nothing to apply to.
        // The globe animates what changed by comparing the games it's given (see GlobeMap.show).
        onChange: (change) => setGames((current) => current && applyChange(current, change)),
        // A switch made in any browser: every pill follows.
        onScenarioSwitched: (running) => setScenarios((current) => withRunning(current, running)),
      }),
    [],
  )
  useEffect(() => store.save(viewerSettings), [viewerSettings])

  const visible = useMemo(() => visibleGames(games ?? [], viewerSettings), [games, viewerSettings])
  const message = noPinsMessage(games, visible)

  // Looked up among the visible games on every change, so the panel stays current; it closes if
  // the game's pin goes, whether the game left the pin window or the filters now hide it.
  const selectedGame = visible.find((game) => game.id === selectedGameId) ?? null

  return (
    <div className={selectedGame ? 'app app--panel-open' : 'app'}>
      <div className="globe-area">
        <Globe
          games={visible}
          selectedGameId={selectedGame?.id ?? null}
          onSelectGame={setSelectedGameId}
          startCamera={camera}
          onCameraMove={store.saveCamera}
          slowSpin={viewerSettings.slowSpin}
        />
        {/* Before the filter menu, so an open filter menu lies over it on a phone. */}
        <ScenarioPill listing={scenarios} setListing={setScenarios} />
        <FilterMenu leagues={leagues} settings={viewerSettings} onChange={setViewerSettings} />
        {message && (
          <p className="no-pins" role="status">
            {message}
          </p>
        )}
      </div>
      {selectedGame && <GamePanel game={selectedGame} onClose={() => setSelectedGameId(null)} />}
    </div>
  )
}
