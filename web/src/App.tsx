import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { accentColor, gameColor, type PickedColors } from './settings/gameColor'
import { useLeagues } from './settings/leagues'
import { settingsStore, unsavedSettingsStore, type SettingsStore } from './settings/settingsStore'
import { noPinsMessage } from './settings/visibleGames'
import { useGamesOnGlobe } from './settings/useGamesOnGlobe'
import { scorerOf } from './games/justHappened'
import type { Game } from './games/game'
import { noneCelebrated, withCelebrated, withoutCelebrated, type Celebrated } from './celebration/celebrated'
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
import { installHintStore, showsIosHint } from './install/install'
import { IosInstallHint } from './install/IosInstallHint'
import { useInstall } from './install/useInstall'
import { LoadingScreen } from './loading/LoadingScreen'
import { revealPhase } from './loading/revealPhase'
import { GamePanel, panelLeaveDuration } from './panel/GamePanel'
import { useRailClearance } from './panel/useRailClearance'
import { celebratedPanelLeaveDuration, usePanelCelebration } from './panel/usePanelCelebration'
import { useLeaving } from './motion/useLeaving'
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
import { selectedTourGames, showsTourGames, tourCamera, tourCameraForGame, tourGames, type TourScreen } from './welcomeTour/tourGames'
import { useTourPlay } from './welcomeTour/tourPlay'
import { useTourVenuePhotos } from './welcomeTour/tourVenuePhotos'
import { tourProgressAfter } from './welcomeTour/welcomeTour'

// The width below which the page takes its phone layout, as index.css has it.
const phoneLayout = '(max-width: 640px)'
/** A short screen on its side, such as a phone in landscape (the CSS's "A short screen"). */
const shortLandscape = '(orientation: landscape) and (max-height: 500px)'

/** Which screen the tour's camera is chosen for (see tourCamera). */
function tourScreen(): TourScreen {
  if (window.matchMedia(phoneLayout).matches) return 'phone'
  return window.matchMedia(shortLandscape).matches ? 'short' : 'wide'
}

const savedStore = settingsStore(() => window.localStorage)
const demoStore = unsavedSettingsStore()
// Kept in a demo too: the hint is about this browser, not the viewer's settings.
const hintStore = installHintStore(() => window.localStorage)
// No games yet, kept as one array so it doesn't change from render to render.
const noGames: Game[] = []

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
  // Whether a game panel's details were left open: the next panel opens them the same way.
  const [detailsOpen, setDetailsOpen] = useState(store.loadDetailsOpen)
  // How far the globe zooms out depends on the window's size, so it fits a phone as it fits a laptop.
  const fittedZoom = useFittedZoom(zoomSettings)
  // The satellite map zooms further in; switching back to the plain map zooms out to its limit (see GlobeMap.setZoomLimits).
  const zoom = useMemo(() => zoomForMapType(fittedZoom, viewerSettings.mapType), [fittedZoom, viewerSettings.mapType])
  // A tour still to finish opens on its own games (see tourGames), and the camera stays there after it.
  const [camera] = useState(() =>
    store.loadTourProgress() === 'finished' ? openingCamera(store, zoom) : tourCamera(tourScreen()),
  )
  const [cameraNow, setCameraNow] = useState<Camera>(camera)
  const leagueList = useLeagues()
  const { leagues } = leagueList
  // The scenario pill, and where play can be controlled the media keys and clock (local runs only).
  const scenarios = useScenarioControls(demo)
  const { setListing: setScenarioListing } = scenarios

  // The games, connected to the server while awake (see GLOSSARY.md "Asleep"); scenario changes made in
  // any browser go to every pill and clock.
  const { games, justHappened: liveChanges, cutOffSince, waking, boardClock } = useLiveGames(
    asleepSettings.idleTimeoutMinutes * 60_000,
    demo,
    setScenarioListing,
  )
  useEffect(() => store.save(viewerSettings), [store, viewerSettings])
  useEffect(() => store.saveTourProgress(tourProgress), [store, tourProgress])
  useEffect(() => store.saveRailCollapsed(railCollapsed), [store, railCollapsed])
  useEffect(() => store.saveDetailsOpen(detailsOpen), [store, detailsOpen])
  // Installing ScoreMap as an app: More's Install app, and on iOS the install hint, once after the
  // welcome tour, or again when asked for from More.
  const install = useInstall()
  const [installHintDismissed, setInstallHintDismissed] = useState(hintStore.dismissed)
  const [installHintAsked, setInstallHintAsked] = useState(false)
  const closeInstallHint = () => {
    hintStore.dismiss()
    setInstallHintDismissed(true)
    setInstallHintAsked(false)
  }
  // Nothing but the loading screen until the globe is ready; then the globe, the controls and the
  // welcome tour come in together as it fades away (see revealPhase).
  const reveal = revealPhase(stage, loadingScreenGone)
  const revealed = reveal !== 'hidden'
  // The welcome tour, from the reveal until it's finished. While it shows, the globe and rail can't be
  // used.
  const tourStep = revealed && tourProgress !== 'finished' ? tourProgress : null
  const touring = tourStep !== null
  // The rail is kept out of sight on a first visit until the tour's Your controls step brings it in:
  // through the loading screen and Welcome, so it doesn't show and then go.
  const railHidden = tourProgress === 'welcome'
  // The tour's own games show in place of real ones until it's finished (see showsTourGames); a panel
  // opened from Click a score card closes as they go. Timed from when the tour starts.
  const [tourBoard, setTourBoard] = useState(() => tourGames(Date.now()))
  const showTourGames = showsTourGames(tourProgress)
  const tourConfirmed = showTourGames && tourProgress !== 'welcome'
  const tourSelection = useMemo(
    () => selectedTourGames(tourConfirmed, tourBoard, viewerSettings, leagues),
    [tourConfirmed, tourBoard, viewerSettings, leagues],
  )
  // The game whose panel is open, which the tour plays more often so its panel is seen to change.
  const openGameId = useRef<string | null>(null)
  const tourPlay = useTourPlay(tourSelection, touring, openGameId)
  const tourBoardWithPhotos = useTourVenuePhotos(tourPlay.games, tourConfirmed)
  const justHappened = showTourGames ? tourPlay.changes : liveChanges
  useEffect(() => {
    if (!loadingScreenGone) return
    const camera = tourCameraForGame(tourSelection[0], tourScreen(), tourSelection.length === 1)
    if (camera) globe.current?.flyTo(camera)
  }, [loadingScreenGone, tourSelection])
  const tourAgain = () => {
    setTourBoard(tourGames(Date.now()))
    setTourProgress((current) => tourProgressAfter(current, { kind: 'again' }))
    globe.current?.flyTo(tourCamera(tourScreen()))
  }

  // Games whose celebration has closed their panel leave the globe with it, before the server drops them
  // (see celebration/celebrated.ts).
  const [celebrated, setCelebrated] = useState<Celebrated>(noneCelebrated)
  // An empty board lets the globe finish loading before the viewer makes a choice on Welcome.
  const boardGames = useMemo(
    () => (showTourGames ? tourBoardWithPhotos : games && withoutCelebrated(games, celebrated)),
    [showTourGames, tourBoardWithPhotos, games, celebrated],
  )
  // The games on now under the viewer's settings, with Upcoming games filling a globe with few on, at the
  // board's time (ADR-0029); the tour shows its own games as they are.
  const onGlobe = useGamesOnGlobe(boardGames ?? noGames, viewerSettings, boardClock)
  const visible = showTourGames ? (boardGames ?? noGames) : onGlobe
  // Changing only when a color does, so other settings don't recolor the globe.
  const { sportColors, leagueColors } = viewerSettings
  const colors = useMemo((): PickedColors => ({ sportColors, leagueColors }), [sportColors, leagueColors])
  // Not before the reveal, nor during the welcome tour.
  const message = revealed && !touring ? noPinsMessage(boardGames, visible, viewerSettings) : null
  const iosHint = showsIosHint({
    way: install.way,
    revealed,
    touring,
    dismissed: installHintDismissed,
    asked: installHintAsked,
  })

  // Looked up among the visible games on every change, so the panel stays current; it closes if
  // the game's pin goes, whether the game left the pin window or the viewer's settings now hide it.
  const { selectedGame, panel, selectGame, closeGame } = useGameSelection(visible)
  useEffect(() => {
    openGameId.current = selectedGame?.id ?? null
  })
  // A game finishing while its panel is open celebrates there, then the panel closes itself and the game
  // leaves the globe with it (see usePanelCelebration).
  const celebrate = useCallback((gameId: string) => setCelebrated((before) => withCelebrated(before, gameId, games ?? [])), [games])
  usePanelCelebration(selectedGame, panel, selectedGame && gameColor(colors, selectedGame, theme), celebrate)
  // A closed panel stays a moment as it goes (see .game-panel--leaving), out of reach: longer when it
  // closed itself after its game's celebration, as it slides away slower.
  const panelLeave = useCallback((game: Game) => (celebrated.has(game.id) ? celebratedPanelLeaveDuration : panelLeaveDuration), [celebrated])
  const { shown: panelGame, leaving: panelLeaving, key: panelKey } = useLeaving(selectedGame, panelLeave)
  const panelColor = panelGame && gameColor(colors, panelGame, theme)
  // Where the rail ends, so the game panel stops short of it.
  const globeArea = useRef<HTMLDivElement>(null)
  useRailClearance(globeArea)

  return (
    <div className="app">
      <Tooltips />
      <div
        ref={globeArea}
        className={[
          'globe-area',
          `globe-area--${reveal}`,
          touring && 'globe-area--touring',
          railHidden && 'globe-area--rail-hidden',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Globe
          key={`globe-${globeAttempt}`}
          ref={globe}
          theme={theme}
          cityLabels={cityLabelSettings}
          zoomSettings={zoom}
          colors={colors}
          mapType={viewerSettings.mapType}
          // Nothing until the first snapshot, so the globe can tell it apart from a snapshot of no games.
          games={boardGames && visible}
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
        {/* Over the globe until it's ready, hiding it. The bottom stack and the rail come after it, out
            of sight until the reveal (see .globe-area--hidden). */}
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
          {iosHint && <IosInstallHint onClose={closeInstallHint} />}
        </div>
        {(demo || touring) && <DemoLabel />}
        {/* Over the bottom of the globe. Before the rail, so an open popover lies over it on a phone. */}
        {panelGame && panelColor && (
          <GamePanel
            key={panelKey}
            ref={panelLeaving ? undefined : panel}
            game={panelGame}
            scorer={scorerOf(justHappened, panelGame.id)}
            color={panelColor}
            textOnColor={textOn(panelColor, theme.palette.text.primary, theme.palette.background.paper)}
            venuePhotos={viewerSettings.venuePhotos}
            detailsOpen={detailsOpen}
            onDetailsOpenChange={setDetailsOpen}
            demo={demo}
            onClose={closeGame}
            leaving={panelLeaving}
          />
        )}
        <Rail
          leagues={leagues}
          settings={viewerSettings}
          onChange={setViewerSettings}
          accent={accentColor(theme)}
          // The camera can't move until the globe is ready, as on the globe itself.
          camera={revealed ? cameraNow : null}
          zoomSettings={zoom}
          onZoomIn={() => globe.current?.zoomIn()}
          onZoomOut={() => globe.current?.zoomOut()}
          onHome={() => globe.current?.flyTo(homeCamera(viewerPlace(), zoom))}
          touring={touring}
          games={visible}
          gamesReady={revealed}
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
          onTourAgain={tourAgain}
          onInstall={
            install.way === 'prompt' ? install.prompt : install.way === 'iosSteps' ? () => setInstallHintAsked(true) : undefined
          }
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
