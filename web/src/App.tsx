import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { builtInBehaviour, loadBehaviour, noOverlays } from './behaviourTuner/behaviour'
import { accentColour, gameColour, type PickedColours } from './settings/gameColour'
import { useLeagues } from './settings/leagues'
import { settingsStore, unsavedSettingsStore, type SettingsStore } from './settings/settingsStore'
import { noPinsMessage, visibleGames } from './settings/visibleGames'
import { useGameSelection } from './games/useGameSelection'
import type { Camera } from './globe/camera'
import { Globe, type GlobeHandle } from './globe/Globe'
import { MapCredit } from './globe/MapCredit'
import type { LoadingStage } from './globe/globeMap'
import { homeCamera, startCamera } from './globe/startCamera'
import { useFittedZoom } from './globe/useFittedZoom'
import { zoomForMapType, type ZoomSettings } from './globe/zoomLevels'
import { DemoLabel } from './demo/DemoLabel'
import { Feedback } from './feedback/Feedback'
import { feedbackContext } from './feedback/feedbackForm'
import { CutOffNote } from './live/CutOffNote'
import { useLiveGames } from './live/useLiveGames'
import { LoadingScreen, type LoadingPreview } from './loading/LoadingScreen'
import { GamePanel } from './panel/GamePanel'
import { Rail } from './rail/Rail'
import { TopRail } from './rail/TopRail'
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

/** The tuners, as the rail's Tuners popover lists them. */
const tuners = [
  { key: 'theme', name: 'Theme' },
  { key: 'behaviour', name: 'Behaviour' },
] as const

type Tuner = (typeof tuners)[number]['key']

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
  // How far the globe's initial load has got, and whether the loading screen has gone since it was ready.
  const [stage, setStage] = useState<LoadingStage>('waitingForGames')
  const [globeAttempt, setGlobeAttempt] = useState(0)
  const [loadingScreenGone, setLoadingScreenGone] = useState(false)
  // A loading screen the theme tuner holds up to be looked at, apart from the real one (local runs only).
  const [loadingPreview, setLoadingPreview] = useState<LoadingPreview>('off')
  // The app's hold on the globe (its camera, and the score cards the welcome tour points at), and where the camera last settled, for the zoom buttons' limits.
  const globe = useRef<GlobeHandle>(null)
  const [viewerSettings, setViewerSettings] = useState(store.load)
  // Read before anything is saved, so a first visit (nothing saved yet) can be told apart.
  const [tourProgress, setTourProgress] = useState(store.loadTourProgress)
  // How far the globe zooms out depends on the window's size, so it fits a phone as it fits a laptop.
  const fittedZoom = useFittedZoom(behaviour.zoom)
  // The satellite map zooms further in; switching back to the plain map zooms out to its limit (see GlobeMap.setZoomLimits).
  const zoom = useMemo(() => zoomForMapType(fittedZoom, viewerSettings.mapType), [fittedZoom, viewerSettings.mapType])
  const [camera] = useState(() => openingCamera(store, zoom))
  // A new start zoom from the behaviour tuner puts the globe at Home at once, to show it.
  const shownStartZoom = useRef(behaviour.zoom.startZoom)
  useEffect(() => {
    if (behaviour.zoom.startZoom === shownStartZoom.current) return
    shownStartZoom.current = behaviour.zoom.startZoom
    globe.current?.jumpTo(homeCamera(viewerPlace(), zoom))
  }, [behaviour.zoom, zoom])
  const [cameraNow, setCameraNow] = useState<Camera>(camera)
  const leagueList = useLeagues()
  const { leagues } = leagueList
  // The scenario pill, and where play can be controlled the media keys and clock (local runs only).
  const scenarios = useScenarioControls(demo)
  // Which tuners' panels are open (local runs only), and how many settings each one's draft changes.
  const [tunersOpen, setTunersOpen] = useState<Record<Tuner, boolean>>({ theme: false, behaviour: false })
  const [tunerChanges, setTunerChanges] = useState<Record<Tuner, number>>({ theme: 0, behaviour: 0 })
  const themeChanges = useCallback((count: number) => setTunerChanges((was) => ({ ...was, theme: count })), [])
  const behaviourChanges = useCallback((count: number) => setTunerChanges((was) => ({ ...was, behaviour: count })), [])
  const { setListing: setScenarioListing } = scenarios

  // The games, connected to the server while awake (see GLOSSARY.md "Asleep"); scenario changes made in
  // any browser go to every pill and clock.
  const { games, changes, cutOffSince, waking } = useLiveGames(
    behaviour.asleep.idleTimeoutMinutes * 60_000,
    demo,
    setScenarioListing,
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
  // Not under the loading screen, nor during the welcome tour: only once both have gone.
  const message = loadingScreenGone && !touring ? noPinsMessage(games, visible, viewerSettings) : null

  // Looked up among the visible games on every change, so the panel stays current; it closes if
  // the game's pin goes, whether the game left the pin window or the viewer's settings now hide it.
  const { selectedGame, panel, selectGame, closeGame } = useGameSelection(visible)
  const selectedColour = selectedGame && gameColour(colours, selectedGame, theme)

  return (
    <div className="app">
      <GlassLens />
      <Tooltips />
      <div className={touring ? 'globe-area globe-area--touring' : 'globe-area'}>
        <Globe
          key={`globe-${globeAttempt}`}
          ref={globe}
          theme={theme}
          cityLabels={behaviour.cityLabels}
          zoomSettings={zoom}
          colours={colours}
          flames={viewerSettings.hotGameFlames}
          mapType={viewerSettings.mapType}
          showGameCityReach={overlays.gameCityReach}
          // Nothing until the first snapshot, so the globe can tell it apart from a snapshot of no games.
          games={games && visible}
          changes={changes}
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
        {loadingPreview !== 'off' && (
          <LoadingScreen
            stage={loadingPreview === 'leaving' ? 'ready' : 'waitingForGames'}
            slow={loadingPreview === 'slow'}
            onGone={() => setLoadingPreview('off')}
          />
        )}
        {/* Under the bottom stack, the game panel and the rail, which may lie over it for a while. */}
        {viewerSettings.mapType === 'satellite' && <MapCredit />}
        {/* The no-pins message. Before the rail, so an open popover lies over it on a phone. */}
        <div className="bottom-stack">
          {message && (
            <p className="no-pins" role="status">
              {message}
            </p>
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
        {/* Over the bottom of the globe, after the Feedback button so it can sit clear of it. Before the
            rail, so an open popover lies over it on a phone. */}
        {selectedGame && selectedColour && (
          <GamePanel
            ref={panel}
            game={selectedGame}
            colour={selectedColour}
            textOnColour={textOn(selectedColour, theme.palette.text.primary, theme.palette.background.paper)}
            onClose={closeGame}
          />
        )}
        <Rail
          leagues={leagues}
          settings={viewerSettings}
          onChange={setViewerSettings}
          accent={accentColour(theme)}
          // The camera can't move until the globe is ready, as on the globe itself.
          camera={loadingScreenGone ? cameraNow : null}
          zoomSettings={zoom}
          onZoomIn={() => globe.current?.zoomIn()}
          onZoomOut={() => globe.current?.zoomOut()}
          onHome={() => globe.current?.flyTo(homeCamera(viewerPlace(), zoom))}
          inert={touring}
          games={visible}
          gamesReady={loadingScreenGone}
          onSelectGame={(gameId) => {
            globe.current?.centreOn(gameId)
            selectGame(gameId)
          }}
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
          tuners={
            tuning &&
            !touring &&
            scenarios.devToolsShown && (
              <ul className="tuner-menu">
                {tuners.map(({ key, name }) => (
                  <li key={key}>
                    <button
                      type="button"
                      aria-pressed={tunersOpen[key]}
                      data-closes-popover
                      onClick={() => setTunersOpen((was) => ({ ...was, [key]: !was[key] }))}
                    >
                      {name}
                      {tunerChanges[key] > 0 && <span className="tuner-menu__count">{tunerChanges[key]}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )
          }
          tunersOpen={tunersOpen.theme || tunersOpen.behaviour}
          onTunersClose={() => setTunersOpen({ theme: false, behaviour: false })}
        />
        {/* Over the globe and the rail, which come before it; the Feedback button is lifted above it
            (see .globe-area--touring), and the dev tools come after it. */}
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
                open={tunersOpen.theme}
                onChangeCount={themeChanges}
                onClose={() => setTunersOpen((was) => ({ ...was, theme: false }))}
              />
              <BehaviourTuner
                builtIn={builtInBehaviour}
                behaviour={behaviour}
                onChange={setBehaviour}
                overlays={overlays}
                onOverlays={setOverlays}
                zoomNow={cameraNow.zoom}
                open={tunersOpen.behaviour}
                onChangeCount={behaviourChanges}
                onClose={() => setTunersOpen((was) => ({ ...was, behaviour: false }))}
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  )
}
