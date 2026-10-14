import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { builtInBehaviour, loadBehaviour, noOverlays } from './behaviourTuner/behaviour'
import { SettingsMenu } from './settings/SettingsMenu'
import { useLeagues } from './settings/leagues'
import { settingsStore } from './settings/settingsStore'
import { noPinsMessage, visibleGames } from './settings/visibleGames'
import type { Game } from './games/game'
import { applyChange } from './games/gameStore'
import { Globe } from './globe/Globe'
import type { LoadingStage } from './globe/globeMap'
import { startCamera } from './globe/startCamera'
import { connectToGames } from './live/liveConnection'
import { LoadingScreen, type LoadingPreview } from './loading/LoadingScreen'
import { GamePanel } from './panel/GamePanel'
import { ScenarioClock } from './scenarios/ScenarioClock'
import { ScenarioPill } from './scenarios/ScenarioPill'
import { SpeedKeys } from './scenarios/SpeedKeys'
import { useScenarioControls } from './scenarios/useScenarioControls'
import type { Theme } from './theme/theme'
import { useTheme } from './theme/useTheme'
import type { ThemeJson } from './themeTuner/themeDraft'

// The theme and behaviour tuners, on local runs only: left out of a build.
const ThemeTuner = import.meta.env.DEV
  ? lazy(() => import('./themeTuner/ThemeTuner').then(({ ThemeTuner }) => ({ default: ThemeTuner })))
  : null
const BehaviourTuner = import.meta.env.DEV
  ? lazy(() => import('./behaviourTuner/BehaviourTuner').then(({ BehaviourTuner }) => ({ default: BehaviourTuner })))
  : null

const store = settingsStore(() => window.localStorage)

/** Where the globe opens. Read once: the globe owns its camera after that. */
function openingCamera() {
  return startCamera(store.loadCamera(), {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language,
  })
}

interface AppProps {
  /** The theme to start in. */
  theme: Theme
  /** On a local run, where the theme tuner starts: the built-in theme's JSON, and the draft to start from. */
  tuning?: { builtIn: ThemeJson; initial: ThemeJson }
}

/**
 * The app, in a theme: the page's CSS reads it from the page's root (see applyTheme), the globe from
 * here. The theme can change as the app runs (see useTheme): on a local run, from the theme tuner.
 */
export default function App({ theme: startTheme, tuning }: AppProps) {
  const [theme, setTheme] = useTheme(startTheme)
  // The app's own behaviour, or on a local run the behaviour tuner's draft saved in this browser.
  const [behaviour, setBehaviour] = useState(() => (import.meta.env.DEV ? loadBehaviour(window.localStorage) : builtInBehaviour))
  // What the behaviour tuner draws on the globe to show its settings at work (local runs only).
  const [overlays, setOverlays] = useState(noOverlays)
  // Null until the server's first snapshot arrives.
  const [games, setGames] = useState<Game[] | null>(null)
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  // How far the globe's initial load has got, and whether the loading screen has gone since it was ready.
  const [stage, setStage] = useState<LoadingStage>('waitingForGames')
  const [loadingScreenGone, setLoadingScreenGone] = useState(false)
  // A loading screen the theme tuner holds up to be looked at, apart from the real one (local runs only).
  const [loadingPreview, setLoadingPreview] = useState<LoadingPreview>('off')
  const panel = useRef<HTMLElement>(null)
  const [viewerSettings, setViewerSettings] = useState(store.load)
  const [camera] = useState(openingCamera)
  const leagues = useLeagues()
  // The scenario pill, and where play can be controlled the media keys and clock (local runs only).
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
  // Not under the loading screen: only once it has gone.
  const message = loadingScreenGone ? noPinsMessage(games, visible) : null

  // Looked up among the visible games on every change, so the panel stays current; it closes if
  // the game's pin goes, whether the game left the pin window or the viewer's settings now hide it.
  const selectedGame = visible.find((game) => game.id === selectedGameId) ?? null

  return (
    <div className="app">
      <div className="globe-area">
        <Globe
          theme={theme}
          cityLabels={behaviour.cityLabels}
          showGameCityReach={overlays.gameCityReach}
          // Nothing until the first snapshot, so the globe can tell it apart from a snapshot of no games.
          games={games && visible}
          selectedGameId={selectedGame?.id ?? null}
          panel={panel}
          onSelectGame={setSelectedGameId}
          startCamera={camera}
          onCameraMove={store.saveCamera}
          onStage={setStage}
        />
        {/* Over the globe until it's ready, under the bottom stack and the settings menu, which come
            after it so they stay usable while loading. */}
        {!loadingScreenGone && <LoadingScreen stage={stage} onGone={() => setLoadingScreenGone(true)} />}
        {loadingPreview !== 'off' && (
          <LoadingScreen
            stage={loadingPreview === 'leaving' ? 'ready' : 'waitingForGames'}
            slow={loadingPreview === 'slow'}
            onGone={() => setLoadingPreview('off')}
          />
        )}
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
              {scenarios.listing.canControlPlay && (
                <>
                  <SpeedKeys listing={scenarios.listing} setListing={setScenarioListing} />
                  <ScenarioClock listing={scenarios.listing} />
                </>
              )}
            </div>
          )}
        </div>
        {/* Over the bottom of the globe, after the scenario pills so it can sit clear of them. Before the
            settings menu, so an open settings menu lies over it on a phone. */}
        {selectedGame && <GamePanel ref={panel} game={selectedGame} onClose={() => setSelectedGameId(null)} />}
        <SettingsMenu leagues={leagues} settings={viewerSettings} onChange={setViewerSettings} />
        {BehaviourTuner && ThemeTuner && tuning && (
          // Hidden, not unmounted, by Shift+S, so the tuners keep their open panels and drafts.
          <div className="dev-tools" hidden={!scenarios.devToolsShown}>
            <Suspense>
              <BehaviourTuner
                builtIn={builtInBehaviour}
                behaviour={behaviour}
                onChange={setBehaviour}
                overlays={overlays}
                onOverlays={setOverlays}
              />
              <ThemeTuner
                builtIn={tuning.builtIn}
                initial={tuning.initial}
                onTheme={setTheme}
                loadingPreview={loadingPreview}
                onLoadingPreview={setLoadingPreview}
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  )
}
