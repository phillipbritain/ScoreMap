import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react'
import { railButtons, type LiveRailButtonName } from '../rail/railButtons'
import { RailIcon } from '../rail/railIcons'
import type { ViewerSettings } from '../settings/viewerSettings'
import { LeaguePicker } from '../rail/LeaguePicker'
import type { LeagueList } from '../settings/leagues'
import type { ShownScoreCard } from '../globe/scoreCardMarkers'
import { TourPointer } from './TourPointer'
import {
  canShowPicks,
  middleClearsGamePanel,
  noPicks,
  picksFrom,
  moveAndZoomWords,
  scoreCardToTry,
  settingsForChoice,
  touchPointer,
  settingsForPicks,
  type TourChoice,
  type TourEvent,
  type TourPicks,
  type TourProgress,
} from './welcomeTour'

interface WelcomeTourScreenProps {
  /** The step on show: the app shows the tour only while it isn't finished. */
  progress: Exclude<TourProgress, 'finished'>
  /** Moves the tour on (see tourProgressAfter). */
  onEvent: (event: TourEvent) => void
  leagueList: LeagueList
  settings: ViewerSettings
  /** Sets the viewer settings, as Leagues on the rail would, for the choice made on Welcome. */
  onChange: (settings: ViewerSettings) => void
  /** Opens a game's panel, as clicking its score card on the globe would: Click a score card's lit card. */
  onOpenGame: (gameId: string) => void
  /** The score cards a viewer can see now, for Click a score card to point at (see GlobeMap.shownScoreCards). */
  scoreCards: () => ShownScoreCard[]
}

/**
 * The welcome tour (see GLOSSARY.md): its step's panel of glass in the middle of the screen, over a
 * light dim that keeps the globe and rail from being used beneath it. Each step moves on with its own
 * choice or button; its panel's ×, or Escape, closes the tour, which finishes it. There is no Skip or
 * dots. What each step does is welcomeTour's; this only draws it.
 */
export function WelcomeTourScreen({ progress, onEvent, leagueList, settings, onChange, onOpenGame, scoreCards }: WelcomeTourScreenProps) {
  const { leagues } = leagueList
  const choose = (choice: TourChoice) => {
    // My leagues applies its completed picks before making the choice.
    if (choice !== 'myLeagues') onChange(settingsForChoice(settings, choice, leagues))
    onEvent({ kind: 'chose', choice })
  }
  const close = () => onEvent({ kind: 'closed' })
  const screen = useRef<HTMLDivElement>(null)
  useAboveGamePanel(screen, progress === 'gamePanel' || progress === 'allSet')
  // Escape closes the tour wherever focus is, as the panel's × does.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEvent({ kind: 'closed' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onEvent])
  return (
    <TourClose.Provider value={close}>
      <div ref={screen} className={`welcome-tour welcome-tour--${progress}`}>
        {/* Catches every press, so nothing under the tour can be used. */}
        <div className="welcome-tour__dim" />
        {progress === 'welcome' && (
          <WelcomeStep onChoose={choose} leagueList={leagueList} settings={settings} onChange={onChange} />
        )}
        {progress === 'controls' && <ControlsStep onNext={() => onEvent({ kind: 'next' })} />}
        {progress === 'scoreCard' && (
          <ScoreCardStep
            scoreCards={scoreCards}
            onOpenGame={(gameId) => {
              onOpenGame(gameId)
              onEvent({ kind: 'gameOpened' })
            }}
          />
        )}
        {progress === 'gamePanel' && <GamePanelStep onNext={() => onEvent({ kind: 'next' })} />}
        {progress === 'allSet' && <AllSetStep onDone={() => onEvent({ kind: 'done' })} />}
      </div>
    </TourClose.Provider>
  )
}

/** Closes the tour, for each step's panel's ×. */
const TourClose = createContext<() => void>(() => {})

/** How long the note on why "Show these" can't go on stays (its fade is in the CSS, .welcome-tour__nothing-picked). */
const nothingPickedDuration = 4000

interface WelcomeStepProps {
  onChoose: (choice: TourChoice) => void
  leagueList: LeagueList
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
}

/**
 * Welcome: what ScoreMap is, and what to see first. My leagues opens the rail's own LeaguePicker,
 * conferences and all, starting with nothing picked; only "Show these" applies the picks, so Back can
 * leave them without changing the viewer settings. "Show these" pressed with nothing picked says why it
 * can't go on, in a note over the picker that fades out.
 */
function WelcomeStep({ onChoose, leagueList, settings, onChange }: WelcomeStepProps) {
  const { leagues, status, retry } = leagueList
  const [picking, setPicking] = useState(false)
  const [picks, setPicks] = useState<TourPicks>(noPicks)
  const pickedSettings = settingsForPicks(settings, picks, leagues)
  const ready = status === 'ready' && leagues.length > 0
  const canShow = ready && canShowPicks(pickedSettings, leagues)
  // The note on why "Show these" can't go on yet, keyed afresh on each press so its fade starts again.
  const [nothingPicked, setNothingPicked] = useState<number | null>(null)
  useEffect(() => {
    if (nothingPicked === null) return
    const timer = setTimeout(() => setNothingPicked(null), nothingPickedDuration)
    return () => clearTimeout(timer)
  }, [nothingPicked])
  const pickMyLeagues = () => {
    setPicks(noPicks)
    setNothingPicked(null)
    setPicking(true)
  }
  return (
    <TourPanel
      heading="Welcome to ScoreMap"
      headingLevel="h2"
      action={
        picking && (
          <>
            <TourButton onClick={() => setPicking(false)} quiet>
              Back
            </TourButton>
            {status === 'failed' && <TourButton onClick={retry}>Retry</TourButton>}
            {nothingPicked !== null && !canShow && (
              <p key={nothingPicked} className="welcome-tour__nothing-picked" role="status">
                Pick at least one league first, so there&apos;s something to show. Or go Back for Top Events or Everything.
              </p>
            )}
            <TourButton
              onClick={() => {
                if (!ready) return
                if (!canShow) {
                  setNothingPicked(Date.now())
                  return
                }
                onChange(pickedSettings)
                onChoose('myLeagues')
              }}
              // Loading, failed or empty, the picker says why already; with nothing picked, a press says why.
              disabled={!ready}
              unavailable={!canShow}
            >
              Show these
            </TourButton>
          </>
        )
      }
    >
      <p className="welcome-tour__text">
        Live sporting events around the globe. See what&apos;s happening and where, in real time!
      </p>
      {picking ? (
        <>
          <h3 className="welcome-tour__question">Pick what you follow</h3>
          <p className="welcome-tour__text welcome-tour__note welcome-tour__note--above">
            You can change this any time in the Leagues settings on the right.
          </p>
          {status === 'loading' && <p className="welcome-tour__text" role="status">Loading leagues…</p>}
          {status === 'failed' && (
            <p className="welcome-tour__text" role="alert">Could not load leagues. Retry, or go back to choose another way to explore.</p>
          )}
          {status === 'ready' && leagues.length === 0 && (
            <p className="welcome-tour__text" role="status">No leagues are available. Go back to choose another way to explore.</p>
          )}
          {status === 'ready' && leagues.length > 0 && (
            <LeaguePicker
              leagues={leagues}
              settings={pickedSettings}
              onChange={(next) => setPicks(picksFrom(next, leagues))}
            />
          )}
        </>
      ) : (
        <>
          <h3 className="welcome-tour__question">What would you like to see?</h3>
          <div className="welcome-tour__choices">
            <button type="button" className="welcome-tour__choice welcome-tour__choice--top-events" onClick={() => onChoose('topEvents')}>
              <strong>Top Events</strong>
              <span>The biggest games right now, in every sport</span>
            </button>
            <button type="button" className="welcome-tour__choice welcome-tour__choice--my-leagues" onClick={pickMyLeagues}>
              <strong>My leagues</strong>
              <span>Pick the sports and leagues you follow</span>
            </button>
            <button type="button" className="welcome-tour__choice welcome-tour__choice--everything" onClick={() => onChoose('everything')}>
              <strong>Everything</strong>
              <span>Every league ScoreMap shows</span>
            </button>
          </div>
          <p className="welcome-tour__text welcome-tour__note">
            You can change this any time in the Leagues settings on the right.
          </p>
        </>
      )}
    </TourPanel>
  )
}

/** A few words on each of the rail's buttons, which Your controls lists beside its icon. */
const railButtonWords: Record<LiveRailButtonName, string> = {
  'Zoom in': 'Zoom in',
  'Zoom out': 'Zoom out',
  Home: 'Home: back to your part of the world',
  Leagues: 'Leagues: Select which sports, leagues, and conferences you want to see',
  'Display Settings': 'Display Settings: colors for each sport and league',
  'Map Type': 'Map Type: the plain map or satellite imagery',
  Games: 'Games: find any game and go to it',
  More: 'More: send feedback, or see this tour again',
}

/** The rail's groups of buttons, which Your controls lights and points at. */
const railGroups = () => document.querySelectorAll('.rail__buttons-inner > .rail__group')

/** The rail's Zoom in and Zoom out buttons, which Your controls' arrow aims at on a phone. */
const zoomButtons = () => document.querySelectorAll('.rail__buttons-inner > .rail__group:first-child > :nth-child(-n + 2)')

/** The app's phone layout, where Your controls' arrow runs from the top of its panel to the zoom buttons. */
const phoneScreen = '(max-width: 640px)'

/**
 * Your controls: how to move and zoom the globe, in words for the viewer's touchscreen or mouse, then
 * each of the rail's buttons and what it's for, with the rail lit and pointed at (on a
 * phone, from the top of its panel to the zoom buttons, so the arrow rises clear of the panel).
 */
function ControlsStep({ onNext }: { onNext: () => void }) {
  const panel = useRef<HTMLElement>(null)
  const [touch] = useState(() => window.matchMedia(touchPointer).matches)
  return (
    <>
      <TourPointer
        panel={panel}
        target={railGroups}
        aim={() => (window.matchMedia(phoneScreen).matches ? zoomButtons() : [])}
        fromTopWhen={phoneScreen}
      />
      <TourPanel ref={panel} heading="Your controls" action={<TourButton onClick={onNext}>Next</TourButton>}>
        <p className="welcome-tour__text welcome-tour__move">{moveAndZoomWords(touch)}</p>
        <ul className="welcome-tour__controls">
          {railButtons.map(({ name, icon }) => (
            <li key={name} className="welcome-tour__control">
              <RailIcon className="welcome-tour__control-icon">{icon}</RailIcon>
              {railButtonWords[name]}
            </li>
          ))}
        </ul>
      </TourPanel>
    </>
  )
}

/** The open game's panel, which The game panel lights. */
const openGamePanel = () => document.querySelectorAll('.game-panel:not(.game-panel--leaving)')

/** The game panel's tabs, which The game panel's arrow aims at. */
const gameDetailsTabs = () => document.querySelectorAll('.game-panel:not(.game-panel--leaving) .game-details-tabs')

/**
 * The game panel: what the panel Click a score card opened shows, with it lit and its tabs pointed at,
 * and that its game is live, changing as the viewer watches (the tour plays the open game more often,
 * see tourPlayTick). The panel stays usable, so the viewer can try its tabs and its TV button. Next
 * moves on to All set. With no panel open (closed, or the tour picked up here after a reload), it says
 * the same with nothing lit.
 */
function GamePanelStep({ onNext }: { onNext: () => void }) {
  const panel = useRef<HTMLElement>(null)
  return (
    <>
      <TourPointer panel={panel} target={openGamePanel} aim={gameDetailsTabs} />
      <TourPanel ref={panel} heading="The game panel" action={<TourButton onClick={onNext}>Next</TourButton>}>
        <p className="welcome-tour__text welcome-tour__live">
          ScoreMap is live: watch the score and clock change, here and on the game&apos;s card, as it happens. No need to refresh.
        </p>
        <ul className="welcome-tour__panel-parts">
          <li>Tabs: the score by period, scoring plays, drives, player stats and highlights, as the sport has them</li>
          <li>TV button: where to watch the game, and more about it</li>
          <li>Venue: click it to find it on Google Maps</li>
        </ul>
      </TourPanel>
    </>
  )
}

/** All set: the end of the tour, over the game's panel the score card opened, until Done finishes it. */
function AllSetStep({ onDone }: { onDone: () => void }) {
  return (
    <TourPanel heading="You're all set" action={<TourButton onClick={onDone}>Done</TourButton>}>
      <p className="welcome-tour__text">That's the end of the tour. Click Done to finish it and explore the games.</p>
    </TourPanel>
  )
}

/**
 * While `on`, sets the tour's --above-game-panel to how far up from its foot the open game panel's top
 * is, following it as it slides in or grows, so the step's panel sits right above it (see
 * .welcome-tour[data-above-game-panel]), and whether the middle of the screen is clear of it, for a
 * desktop's All set to sit there. With no game panel open, the step's panel stays in the middle.
 */
function useAboveGamePanel(screen: RefObject<HTMLElement | null>, on: boolean) {
  useEffect(() => {
    const element = screen.current
    if (!on || !element) return
    let frame = 0
    const look = () => {
      frame = requestAnimationFrame(look)
      const gamePanel = document.querySelector('.game-panel:not(.game-panel--leaving)')
      const screenBox = element.getBoundingClientRect()
      const above = gamePanel && screenBox.bottom - gamePanel.getBoundingClientRect().top
      const step = element.querySelector('.welcome-tour__panel')?.getBoundingClientRect()
      // Attributes rather than classes, which React would drop each time it renders the tour.
      element.toggleAttribute('data-above-game-panel', Boolean(gamePanel))
      element.toggleAttribute(
        'data-middle-clears-game-panel',
        Boolean(above && step && middleClearsGamePanel(screenBox.height, step.height, above)),
      )
      if (above) element.style.setProperty('--above-game-panel', `${above}px`)
    }
    look()
    return () => {
      cancelAnimationFrame(frame)
      element.removeAttribute('data-above-game-panel')
      element.removeAttribute('data-middle-clears-game-panel')
      element.style.removeProperty('--above-game-panel')
    }
  }, [screen, on])
}

interface ScoreCardStepProps {
  onOpenGame: (gameId: string) => void
  scoreCards: () => ShownScoreCard[]
}

/**
 * Click a score card: what a score card opens, pointing at one of the tour's games to try (see
 * scoreCardToTry), lit and pressable as part of the tour. The tour's camera keeps a card clear of the
 * panel; on a screen where none is, the step says the same without pointing. Nothing moves the globe
 * to bring a card into view. It has no Done: pressing the card moves on to The game panel, and its × closes the tour.
 */
function ScoreCardStep({ onOpenGame, scoreCards }: ScoreCardStepProps) {
  const panel = useRef<HTMLElement>(null)
  const toTry = useScoreCardToTry(panel, scoreCards)
  const card = () => scoreCards().filter((shown) => shown.gameId === toTry?.gameId)
  return (
    <>
      {toTry && (
        <TourPointer
          panel={panel}
          target={() => card().map((shown) => shown.element)}
          aim={() => card().flatMap((shown) => shown.rows)}
          onTargetClick={() => onOpenGame(toTry.gameId)}
          targetLabel={`Open ${toTry.label}`}
        />
      )}
      <TourPanel ref={panel} heading="Click a score card">
        {/* Neither wording until the panel has been measured and a card picked (or none). */}
        {toTry === null && (
          <p className="welcome-tour__text">
            Each game shows as a score card. Click one to open a panel with details for the event, venue,
            where to watch, and more
          </p>
        )}
        {toTry && (
          <p className="welcome-tour__text">
            Try this one: it opens a panel with details for the event, venue, where to watch, and more
          </p>
        )}
      </TourPanel>
    </>
  )
}

/** The score card Click a score card points at: its game, and its name as its own button gives it. */
interface CardToTry {
  gameId: string
  label: string
}

/**
 * The score card for Click a score card to point at, following the cards as they're laid out: null
 * for none, undefined until the panel has been measured. Once picked, a card is
 * kept for as long as it stays clear of the panel, so the arrow doesn't hop between cards; its name
 * follows its game (a new score, say).
 */
function useScoreCardToTry(panel: RefObject<HTMLElement | null>, scoreCards: () => ShownScoreCard[]): CardToTry | null | undefined {
  const [toTry, setToTry] = useState<CardToTry | null | undefined>(undefined)
  const latest = useRef(scoreCards)
  useEffect(() => {
    latest.current = scoreCards
  })
  useEffect(() => {
    let frame = 0
    const look = () => {
      frame = requestAnimationFrame(look)
      const panelBox = panel.current?.getBoundingClientRect()
      const screen = panel.current?.closest('.welcome-tour')?.getBoundingClientRect()
      if (!panelBox || !screen) return
      const cards = latest.current()
      setToTry((current) => {
        const kept = cards.filter((card) => card.gameId === current?.gameId)
        const gameId = scoreCardToTry(kept, panelBox, screen) ?? scoreCardToTry(cards, panelBox, screen)
        const picked = cards.find((card) => card.gameId === gameId)
        if (!picked) return null
        return current?.gameId === picked.gameId && current.label === picked.label ? current : { gameId: picked.gameId, label: picked.label }
      })
    }
    look()
    return () => cancelAnimationFrame(frame)
  }, [panel])
  return toTry
}

interface TourPanelProps {
  heading: string
  headingLevel?: 'h2' | 'h3'
  children: ReactNode
  /** The step's own buttons, in its action button panel at the panel's foot. */
  action?: ReactNode
  /** The panel itself, for a step's arrow to start from. */
  ref?: Ref<HTMLElement>
}

/**
 * A step's panel: centered, labeled by its heading, with a × in its top right corner, as the game
 * panel's, that closes the tour. Its content scrolls between the heading and the step's buttons.
 */
function TourPanel({ heading, headingLevel: Heading = 'h3', children, action, ref }: TourPanelProps) {
  const headingId = useId()
  const close = useContext(TourClose)
  return (
    <section ref={ref} className="welcome-tour__panel" role="dialog" aria-labelledby={headingId}>
      <Heading id={headingId} className="welcome-tour__heading">
        {heading}
      </Heading>
      {/* Scrolls on its own when it doesn't fit, so the heading and the step's buttons stay in view. */}
      <div className="welcome-tour__body">{children}</div>
      {action && <div className="welcome-tour__actions">{action}</div>}
      <button type="button" className="welcome-tour__close" onClick={close} aria-label="Close welcome tour">
        ×
      </button>
    </section>
  )
}

interface TourButtonProps {
  onClick: () => void
  disabled?: boolean
  /** Shown as unavailable, but still pressable, to say why ("Show these" with nothing picked). */
  unavailable?: boolean
  /** A way back rather than on (Back): outlined but not lit, so the step's own button stands out beside it. */
  quiet?: boolean
  children: ReactNode
}

function TourButton({ onClick, disabled, unavailable, quiet, children }: TourButtonProps) {
  return (
    <button
      type="button"
      className={quiet ? 'welcome-tour__button welcome-tour__button--quiet' : 'welcome-tour__button'}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={unavailable || undefined}
    >
      {children}
    </button>
  )
}
