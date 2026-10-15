import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { builtInBehaviour, loadBehaviour, noOverlays } from './behaviourTuner/behaviour'
import { accentColour, gameColour, type PickedColours } from './settings/gameColour'
import { useLeagues } from './settings/leagues'
import { settingsStore, unsavedSettingsStore, type SettingsStore } from './settings/settingsStore'
import { noPinsMessage, visibleGames } from './settings/visibleGames'
import type { Game } from './games/game'
import { applyChange } from './games/gameStore'
import type { Camera } from './globe/camera'
import { Globe, type GlobeCamera } from './globe/Globe'
import type { LoadingStage } from './globe/globeMap'
import { homeCamera, startCamera } from './globe/startCamera'
import type { ZoomSettings } from './globe/zoomLevels'
import { DemoLabel } from './demo/DemoLabel'
import { Feedback } from './feedback/Feedback'
import { feedbackContext } from './feedback/feedbackForm'
import { connectToGames } from './live/liveConnection'
import { LoadingScreen, type LoadingPreview } from './loading/LoadingScreen'
import { GamePanel } from './panel/GamePanel'
import { Rail } from './rail/Rail'
import { ScenarioClock } from './scenarios/ScenarioClock'
import { ScenarioPill } from './scenarios/ScenarioPill'
import { SpeedKeys } from './scenarios/SpeedKeys'
import { useScenarioControls } from './scenarios/useScenarioControls'
import { GlassLens } from './theme/GlassLens'
import { Tooltips } from './tooltip/Tooltips'
import { textOn } from './theme/palette'
import type { Theme } from './theme/theme'
import { useTheme } from './theme/useTheme'
import type { ThemeJson } from './themeTuner/themeDraft'
import { WelcomeTourScreen } from './welcomeTour/WelcomeTourScreen'
import { tourProgressAfter } from './welcomeTour/welcomeTour'

// The theme and behaviour tuners, on local runs only: left out of a build.
const ThemeTuner = import.meta.env.DEV
  ? lazy(() => import('./themeTuner/ThemeTuner').then(({ ThemeTuner }) => ({ default: ThemeTuner })))
  : null
const BehaviourTuner = import.meta.env.DEV
  ? lazy(() => import('./behaviourTuner/BehaviourTuner').then(({ BehaviourTuner }) => ({ default: BehaviourTuner })))
  : null

// The width below which the page takes its phone layout, as index.css has it.
const phoneLayout = '(max-width: 640px)'

const savedStore = settingsStore(() => window.localStorage)
const demoStore = unsavedSettingsStore()

/** What the browser says about where the viewer is (see ViewerPlace). */
function viewerPlace() {
  return { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale: navigator.language }
}

/** Where the globe opens. Read once: the globe owns its camera after that. */
function openingCamera(store: SettingsStore, zoom: ZoomSettings) {
  return startCamera(store.loadCamera(), viewerPlace(), zoom)
}

interface AppProps {
  /** The theme to start in. */
  theme: Theme
  /** On a local run, where the theme tuner starts: the built-in theme's JSON, and the draft to start from. */
  tuning?: { builtIn: ThemeJson; initial: ThemeJson }
  /**
   * Whether this is a demo (ADR-0019): the demo's made-up games, under a label saying so, with no
   * scenario controls or dev tools, in the built-in look, and nothing saved in the browser.
   */
  demo?: boolean
}

/**
 * The app, in a theme: the page's CSS reads it from the page's root (see applyTheme), the globe from
 * here. The theme can change as the app runs (see useTheme): on a local run, from the theme tuner.
 */
export default function App({ theme: startTheme, tuning, demo = false }: AppProps) {
  const [theme, setTheme] = useTheme(startTheme)
  // The app's own behaviour, or on a local run (but not in a demo) the behaviour tuner's draft saved in this browser.
  const [behaviour, setBehaviour] = useState(() =>
    import.meta.env.DEV && !demo ? loadBehaviour(window.localStorage) : builtInBehaviour,
  )
  // A demo opens on first-visit settings and saves none.
  const store = demo ? demoStore : savedStore
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
  // The rail's hold on the globe's camera, and where the camera last settled, for the zoom buttons' limits.
  const globeCamera = useRef<GlobeCamera>(null)
  const [viewerSettings, setViewerSettings] = useState(store.load)
  // Read before anything is saved, so a first visit (nothing saved yet) can be told apart.
  const [tourProgress, setTourProgress] = useState(store.loadTourProgress)
  const [camera] = useState(() => openingCamera(store, behaviour.zoom))
  // A new start zoom from the behaviour tuner puts the globe at Home at once, to show it.
  const shownStartZoom = useRef(behaviour.zoom.startZoom)
  useEffect(() => {
    if (behaviour.zoom.startZoom === shownStartZoom.current) return
    shownStartZoom.current = behaviour.zoom.startZoom
    globeCamera.current?.jumpTo(homeCamera(viewerPlace(), behaviour.zoom))
  }, [behaviour.zoom])
  const [cameraNow, setCameraNow] = useState<Camera>(camera)
  const leagues = useLeagues()
  // The scenario pill, and where play can be controlled the media keys and clock (local runs only).
  const scenarios = useScenarioControls(demo)
  const { setListing: setScenarioListing } = scenarios

  useEffect(
    () =>
      connectToGames(
        {
          onSnapshot: setGames,
          // The snapshot always comes first; a change before it has nothing to apply to.
          // The globe animates what changed by comparing the games it's given (see GlobeMap.show).
          onChange: (change) => setGames((current) => current && applyChange(current, change)),
          // A switch or a change of speed made in any browser: every pill and clock follows.
          onScenarioChanged: setScenarioListing,
        },
        demo,
      ),
    [setScenarioListing, demo],
  )
  useEffect(() => store.save(viewerSettings), [store, viewerSettings])
  useEffect(() => store.saveTourProgress(tourProgress), [store, tourProgress])
  // The welcome tour, once the loading screen has gone, until it's finished. While it shows, the globe
  // and rail can't be used.
  const tourStep = loadingScreenGone && tourProgress !== 'finished' ? tourProgress : null
  const touring = tourStep !== null

  const visible = useMemo(() => visibleGames(games ?? [], viewerSettings), [games, viewerSettings])
  // Changing only when a colour does, so other settings don't recolour the globe.
  const { sportColours, leagueColours } = viewerSettings
  const colours = useMemo((): PickedColours => ({ sportColours, leagueColours }), [sportColours, leagueColours])
  // Not under the loading screen: only once it has gone.
  const message = loadingScreenGone ? noPinsMessage(games, visible, viewerSettings) : null

  // Looked up among the visible games on every change, so the panel stays current; it closes if
  // the game's pin goes, whether the game left the pin window or the viewer's settings now hide it.
  const selectedGame = visible.find((game) => game.id === selectedGameId) ?? null
  const selectedColour = selectedGame && gameColour(colours, selectedGame, theme)

  return (
    <div className="app">
      <GlassLens />
      <Tooltips />
      <div className={touring ? 'globe-area globe-area--touring' : 'globe-area'}>
        <Globe
          ref={globeCamera}
          theme={theme}
          cityLabels={behaviour.cityLabels}
          zoomSettings={behaviour.zoom}
          colours={colours}
          showGameCityReach={overlays.gameCityReach}
          // Nothing until the first snapshot, so the globe can tell it apart from a snapshot of no games.
          games={games && visible}
          selectedGameId={selectedGame?.id ?? null}
          panel={panel}
          onSelectGame={setSelectedGameId}
          startCamera={camera}
          onCameraMove={(moved) => {
            store.saveCamera(moved)
            setCameraNow(moved)
          }}
          onStage={setStage}
          inert={touring}
        />
        {/* Over the globe until it's ready, under the bottom stack and the rail, which come after it
            so they stay usable while loading. */}
        {!loadingScreenGone && <LoadingScreen stage={stage} onGone={() => setLoadingScreenGone(true)} />}
        {loadingPreview !== 'off' && (
          <LoadingScreen
            stage={loadingPreview === 'leaving' ? 'ready' : 'waitingForGames'}
            slow={loadingPreview === 'slow'}
            onGone={() => setLoadingPreview('off')}
          />
        )}
        {/* The no-pins message, above the scenario pills and clock however they wrap. Before the
            rail, so an open popover lies over them on a phone. */}
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
        {demo && <DemoLabel hidden={!scenarios.feedbackShown} />}
        {/* At the bottom right, before the game panel, which narrows to keep clear of it (on a phone, it
            hides while a game panel is open instead). */}
        <Feedback
          hidden={!scenarios.feedbackShown}
          context={() =>
            feedbackContext({
              screen: { width: window.innerWidth, height: window.innerHeight },
              phoneLayout: window.matchMedia(phoneLayout).matches,
              gameId: selectedGame?.id ?? null,
              leagues,
              settings: viewerSettings,
              demo,
            })
          }
        />
        {/* Over the bottom of the globe, after the scenario pills so it can sit clear of them. Before the
            rail, so an open popover lies over it on a phone. */}
        {selectedGame && selectedColour && (
          <GamePanel
            ref={panel}
            game={selectedGame}
            colour={selectedColour}
            textOnColour={textOn(selectedColour, theme.palette.text.primary, theme.palette.background.paper)}
            onClose={() => setSelectedGameId(null)}
          />
        )}
        <Rail
          leagues={leagues}
          settings={viewerSettings}
          onChange={setViewerSettings}
          accent={accentColour(theme)}
          // The camera can't move until the globe is ready, as on the globe itself.
          camera={loadingScreenGone ? cameraNow : null}
          zoomSettings={behaviour.zoom}
          onZoomIn={() => globeCamera.current?.zoomIn()}
          onZoomOut={() => globeCamera.current?.zoomOut()}
          onHome={() => globeCamera.current?.flyTo(homeCamera(viewerPlace(), behaviour.zoom))}
          inert={touring}
        />
        {/* Over the globe and the rail, which come before it; the scenario controls and the Feedback
            button are lifted above it (see .globe-area--touring), and the dev tools come after it. */}
        {tourStep && (
          <WelcomeTourScreen
            progress={tourStep}
            onEvent={(event) => setTourProgress((current) => tourProgressAfter(current, event))}
            leagues={leagues}
            settings={viewerSettings}
            onChange={setViewerSettings}
            onOpenGame={setSelectedGameId}
          />
        )}
        {BehaviourTuner && ThemeTuner && tuning && (
          // Hidden, not unmounted, by Shift+S, so the tuners keep their open panels and drafts.
          <div className="dev-tools" data-keeps-popovers hidden={!scenarios.devToolsShown}>
            <Suspense>
              <ThemeTuner
                builtIn={tuning.builtIn}
                initial={tuning.initial}
                onTheme={setTheme}
                loadingPreview={loadingPreview}
                onLoadingPreview={setLoadingPreview}
              />
              <BehaviourTuner
                builtIn={builtInBehaviour}
                behaviour={behaviour}
                onChange={setBehaviour}
                overlays={overlays}
                onOverlays={setOverlays}
                zoomNow={cameraNow.zoom}
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  )
}
