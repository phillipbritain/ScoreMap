import { useEffect, useMemo, useState } from 'react'
import { SettingsMenu } from './settings/SettingsMenu'
import { useLeagues } from './settings/leagues'
import { settingsStore } from './settings/settingsStore'
import { noPinsMessage, visibleGames } from './settings/visibleGames'
import type { Game } from './games/game'
import { applyChange } from './games/gameStore'
import { Globe } from './globe/Globe'
import { startCamera } from './globe/startCamera'
import { connectToGames } from './live/liveConnection'
import { GamePanel } from './panel/GamePanel'
import { ScenarioClock } from './scenarios/ScenarioClock'
import { ScenarioPill } from './scenarios/ScenarioPill'
import { SpeedPill } from './scenarios/SpeedPill'
import { useScenarioControls } from './scenarios/useScenarioControls'

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
  // The scenario pill, speed pill and clock (local runs only).
  const scenarios = useScenarioControls()
  const { setListing: setScenarioListing } = scenarios

  useEffect(
    () =>
      connectToGames({
        onSnapshot: setGames,
        // The snapshot always comes first; a change before it has nothing to apply to.
        // The globe animates what changed by comparing the games it's given (see GlobeMap.show).
        onChange: (change) => setGames((current) => current && applyChange(current, change)),
        // A switch or a change of speed made in any browser: every pill and clock follows.
        onScenarioChanged: setScenarioListing,
      }),
    [setScenarioListing],
  )
  useEffect(() => store.save(viewerSettings), [viewerSettings])

  const visible = useMemo(() => visibleGames(games ?? [], viewerSettings), [games, viewerSettings])
  const message = noPinsMessage(games, visible)

  // Looked up among the visible games on every change, so the panel stays current; it closes if
  // the game's pin goes, whether the game left the pin window or the viewer's settings now hide it.
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
          cardStyle={viewerSettings.cardStyle}
        />
        {/* The no-pins message, above the scenario pills and clock however they wrap. Before the
            settings menu, so an open settings menu lies over them on a phone. */}
        <div className={scenarios.shown ? 'bottom-stack bottom-stack--scenario' : 'bottom-stack'}>
          {message && (
            <p className="no-pins" role="status">
              {message}
            </p>
          )}
          {scenarios.shown && scenarios.listing && (
            <div className="scenario-pills">
              <ScenarioPill listing={scenarios.listing} setListing={setScenarioListing} refresh={scenarios.refresh} />
              <SpeedPill listing={scenarios.listing} setListing={setScenarioListing} />
              <ScenarioClock listing={scenarios.listing} />
            </div>
          )}
        </div>
        <SettingsMenu leagues={leagues} settings={viewerSettings} onChange={setViewerSettings} />
      </div>
      {selectedGame && <GamePanel game={selectedGame} onClose={() => setSelectedGameId(null)} />}
    </div>
  )
}
