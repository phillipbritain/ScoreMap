import { useEffect, useMemo, useRef, useState } from 'react'
import { accentColor, gameColor, type PickedColors } from './settings/gameColor'
import { useLeagues } from './settings/leagues'
import { settingsStore, unsavedSettingsStore, type SettingsStore } from './settings/settingsStore'
import { noPinsMessage, visibleGames } from './settings/visibleGames'
import { scorerOf } from './games/justHappened'
import { useGameSelection } from './games/useGameSelection'
import type { Camera } from './globe/camera'
import { Globe, type GlobeHandle } from './globe/Globe'
import type { LoadingStage } from './globe/globeMap'
import { homeCamera, startCamera } from './globe/startCamera'
import { useFittedZoom } from './globe/useFittedZoom'
import { cityLabelSettings } from './globe/cityLabels'
import { zoomForMapType, zoomSettings, type ZoomSettings } from './globe/zoomLevels'
import { asleepSettings } from './live/asleep'
import { DemoLabel } from './demo/DemoLabel'
import { feedbackContext } from './feedback/feedbackForm'
import { CutOffNote } from './live/CutOffNote'
import { useLiveGames } from './live/useLiveGames'
import { LoadingScreen } from './loading/LoadingScreen'
import { GamePanel } from './panel/GamePanel'
import { Rail } from './rail/Rail'
import { TopRail } from './rail/TopRail'
import { ScenarioClock } from './scenarios/ScenarioClock'
import { ScenarioPill } from './scenarios/ScenarioPill'
import { SpeedKeys } from './scenarios/SpeedKeys'
import { useScenarioControls } from './scenarios/useScenarioControls'
import { Tooltips } from './tooltip/Tooltips'
import { textOn } from './theme/palette'
import type { Theme } from './theme/theme'
import { useTheme } from './theme/useTheme'
import { WelcomeTourScreen } from './welcomeTour/WelcomeTourScreen'
import { tourProgressAfter } from './welcomeTour/welcomeTour'


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
  /**
   * Whether this is a demo (ADR-0019): the demo's made-up games, under a label saying so, with no
   * scenario controls, in the built-in look, and nothing saved in the browser.
   */
  demo?: boolean
}

/**
 * The app, in a theme: the page's CSS reads it from the page's root (see applyTheme), the globe from
 * here (see useTheme).
 */
export default function App({ theme: startTheme, demo = false }: AppProps) {
  const [theme] = useTheme(startTheme)
  // A demo opens on first-visit settings and saves none.
  const store = demo ? demoStore : savedStore
  // How far the globe's initial load has got, and whether the loading screen has gone since it was ready.
  const [stage, setStage] = useState<LoadingStage>('waitingForGames')
  const [globeAttempt, setGlobeAttempt] = useState(0)
  const [loadingScreenGone, setLoadingScreenGone] = useState(false)
  // The app's hold on the globe (its camera, and the score cards the welcome tour points at), and where the camera last settled, for the zoom buttons' limits.
  const globe = useRef<GlobeHandle>(null)
  const [viewerSettings, setViewerSettings] = useState(store.load)
  // Read before anything is saved, so a first visit (nothing saved yet) can be told apart.
  const [tourProgress, setTourProgress] = useState(store.loadTourProgress)
  // Whether the viewer collapsed the rail out of the way after setting up.
  const [railCollapsed, setRailCollapsed] = useState(store.loadRailCollapsed)
  // How far the globe zooms out depends on the window's size, so it fits a phone as it fits a laptop.
  const fittedZoom = useFittedZoom(zoomSettings)
  // The satellite map zooms further in; switching back to the plain map zooms out to its limit (see GlobeMap.setZoomLimits).
  const zoom = useMemo(() => zoomForMapType(fittedZoom, viewerSettings.mapType), [fittedZoom, viewerSettings.mapType])
  const [camera] = useState(() => openingCamera(store, zoom))
  const [cameraNow, setCameraNow] = useState<Camera>(camera)
  const leagueList = useLeagues()
  const { leagues } = leagueList
  // The scenario pill, and where play can be controlled the media keys and clock (local runs only).
  const scenarios = useScenarioControls(demo)
  const { setListing: setScenarioListing } = scenarios

  // The games, connected to the server while awake (see GLOSSARY.md "Asleep"); scenario changes made in
  // any browser go to every pill and clock.
  const { games, justHappened, cutOffSince, waking } = useLiveGames(
    asleepSettings.idleTimeoutMinutes * 60_000,
    demo,
    setScenarioListing,
  )
  useEffect(() => store.save(viewerSettings), [store, viewerSettings])
  useEffect(() => store.saveTourProgress(tourProgress), [store, tourProgress])
  useEffect(() => store.saveRailCollapsed(railCollapsed), [store, railCollapsed])
  // The welcome tour, once the loading screen has gone, until it's finished. While it shows, the globe
  // and rail can't be used.
  const tourStep = loadingScreenGone && tourProgress !== 'finished' ? tourProgress : null
  const touring = tourStep !== null

  const visible = useMemo(() => visibleGames(games ?? [], viewerSettings), [games, viewerSettings])
  // Changing only when a color does, so other settings don't recolor the globe.
  const { sportColors, leagueColors } = viewerSettings
  const colors = useMemo((): PickedColors => ({ sportColors, leagueColors }), [sportColors, leagueColors])
  // Not under the loading screen, nor during the welcome tour: only once both have gone.
  const message = loadingScreenGone && !touring ? noPinsMessage(games, visible, viewerSettings) : null

  // Looked up among the visible games on every change, so the panel stays current; it closes if
  // the game's pin goes, whether the game left the pin window or the viewer's settings now hide it.
  const { selectedGame, panel, selectGame, closeGame } = useGameSelection(visible)
  const selectedColor = selectedGame && gameColor(colors, selectedGame, theme)

  return (
    <div className="app">
      <Tooltips />
      <div className={touring ? 'globe-area globe-area--touring' : 'globe-area'}>
        <Globe
          key={`globe-${globeAttempt}`}
          ref={globe}
          theme={theme}
          cityLabels={cityLabelSettings}
          zoomSettings={zoom}
          colors={colors}
          mapType={viewerSettings.mapType}
          // Nothing until the first snapshot, so the globe can tell it apart from a snapshot of no games.
          games={games && visible}
          justHappened={justHappened}
          selectedGameId={selectedGame?.id ?? null}
          panel={panel}
          onSelectGame={selectGame}
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
        {!loadingScreenGone && (
          <LoadingScreen
            key={`loading-${globeAttempt}`}
            stage={stage}
            onRetry={() => {
              setStage('waitingForGames')
              setGlobeAttempt((attempt) => attempt + 1)
            }}
            onGone={() => setLoadingScreenGone(true)}
          />
        )}
        {/* Not under the loading screen, which says so itself. Under the bottom stack, the game panel and
            the rail, which stay usable. */}
        {loadingScreenGone && <CutOffNote cutOffSince={cutOffSince} waking={waking} />}
        {/* The no-pins message. Before the rail, so an open popover lies over it on a phone. */}
        <div className="bottom-stack">
          {message && (
            <p className="no-pins" role="status">
              {message}
            </p>
          )}
        </div>
        {demo && <DemoLabel />}
        {/* Over the bottom of the globe. Before the rail, so an open popover lies over it on a phone. */}
        {selectedGame && selectedColor && (
          <GamePanel
            ref={panel}
            game={selectedGame}
            scorer={scorerOf(justHappened, selectedGame.id)}
            color={selectedColor}
            textOnColor={textOn(selectedColor, theme.palette.text.primary, theme.palette.background.paper)}
            venuePhotos={viewerSettings.venuePhotos}
            onClose={closeGame}
          />
        )}
        <Rail
          leagues={leagues}
          settings={viewerSettings}
          onChange={setViewerSettings}
          accent={accentColor(theme)}
          // The camera can't move until the globe is ready, as on the globe itself.
          camera={loadingScreenGone ? cameraNow : null}
          zoomSettings={zoom}
          onZoomIn={() => globe.current?.zoomIn()}
          onZoomOut={() => globe.current?.zoomOut()}
          onHome={() => globe.current?.flyTo(homeCamera(viewerPlace(), zoom))}
          inert={touring}
          games={visible}
          gamesReady={loadingScreenGone}
          onSelectGame={(gameId) => globe.current?.pickGame(gameId)}
          collapsed={railCollapsed}
          onCollapsedChange={setRailCollapsed}
          feedbackContext={() =>
            feedbackContext({
              screen: { width: window.innerWidth, height: window.innerHeight },
              phoneLayout: window.matchMedia(phoneLayout).matches,
              gameId: selectedGame?.id ?? null,
              leagues,
              settings: viewerSettings,
              demo,
            })
          }
          onTourAgain={() => setTourProgress((current) => tourProgressAfter(current, { kind: 'again' }))}
        />
        {/* The local-run tools, at the top left. Not while the tour shows, which keeps to the live site. */}
        <TopRail
          scenarioControls={
            !touring &&
            scenarios.shown &&
            scenarios.listing && (
              <div className="scenario-pills">
                <ScenarioPill listing={scenarios.listing} setListing={setScenarioListing} refresh={scenarios.refresh} />
                {scenarios.listing.canControlPlay && (
                  <>
                    <SpeedKeys listing={scenarios.listing} setListing={setScenarioListing} />
                    <ScenarioClock listing={scenarios.listing} />
                  </>
                )}
              </div>
            )
          }
        />
        {/* Over the globe and the rail, which come before it. */}
        {tourStep && (
          <WelcomeTourScreen
            progress={tourStep}
            onEvent={(event) => setTourProgress((current) => tourProgressAfter(current, event))}
            leagueList={leagueList}
            settings={viewerSettings}
            onChange={setViewerSettings}
            onOpenGame={selectGame}
            scoreCards={() => globe.current?.shownScoreCards() ?? []}
          />
        )}
      </div>
    </div>
  )
}
