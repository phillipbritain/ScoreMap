import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react'
import { railButtons, type LiveRailButtonName } from '../rail/railButtons'
import { HideControlsIcon, RailIcon } from '../rail/railIcons'
import type { ViewerSettings } from '../settings/viewerSettings'
import { LeaguePicker } from '../rail/LeaguePicker'
import type { LeagueList } from '../settings/leagues'
import type { ShownScoreCard } from '../globe/scoreCardMarkers'
import { TourPointer } from './TourPointer'
import {
  canShowPicks,
  gamePanelSteps,
  overGamePanel,
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
  /** The game whose card Click a score card points at, whatever else is on screen (see tourGameToTry). */
  gameToTry: string
}

/**
 * The welcome tour (see GLOSSARY.md): its step's panel of glass in the middle of the screen, over a
 * light dim that keeps the globe and rail from being used beneath it. Each step moves on with its own
 * choice or button; its panel's ×, or Escape, closes the tour, which finishes it. There is no Skip or
 * dots. What each step does is welcomeTour's; this only draws it.
 */
export function WelcomeTourScreen({ progress, onEvent, leagueList, settings, onChange, onOpenGame, scoreCards, gameToTry }: WelcomeTourScreenProps) {
  const { leagues } = leagueList
  const choose = (choice: TourChoice) => {
    // My leagues applies its completed picks before making the choice.
    if (choice !== 'myLeagues') onChange(settingsForChoice(settings, choice, leagues))
    onEvent({ kind: 'chose', choice })
  }
  const close = () => onEvent({ kind: 'closed' })
  const screen = useRef<HTMLDivElement>(null)
  useAboveGamePanel(screen, overGamePanel(progress))
  // Escape closes the tour wherever focus is, as the panel's × does; but with one of the rail's popovers
  // open (More, or the Feedback panel, usable during the tour), it's the rail's, to close that popover,
  // whichever hears it first.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const forRail = event.defaultPrevented || document.getElementById('rail-popover')
      if (event.key === 'Escape' && !forRail) onEvent({ kind: 'closed' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onEvent])
  return (
    <TourClose.Provider value={close}>
      <div ref={screen} className={`welcome-tour welcome-tour--${progress}${overGamePanel(progress) ? ' welcome-tour--over-game-panel' : ''}`}>
        {/* Catches every press, so nothing under the tour can be used. */}
        <div className="welcome-tour__dim" />
        {progress === 'welcome' && (
          <WelcomeStep onChoose={choose} leagueList={leagueList} settings={settings} onChange={onChange} />
        )}
        {progress === 'controls' && <ControlsStep onNext={() => onEvent({ kind: 'next' })} />}
        {progress === 'scoreCard' && (
          <ScoreCardStep
            scoreCards={scoreCards}
            gameToTry={gameToTry}
            onOpenGame={(gameId) => {
              onOpenGame(gameId)
              onEvent({ kind: 'gameOpened' })
            }}
          />
        )}
        {isGamePanelStep(progress) && <GamePanelStep step={progress} onNext={() => onEvent({ kind: 'next' })} />}
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

/** The rail's groups of buttons, Hide controls' included, which Your controls lights. */
const railGroups = () => document.querySelectorAll('.rail > .rail__group--collapse, .rail__buttons-inner > .rail__group')

/**
 * Your controls: how to move and zoom the globe, in words for the viewer's touchscreen or mouse, then
 * each of the rail's buttons and what it's for, Hide controls first, with the rail lit (solid while it is,
 * see .globe-area:has(> .welcome-tour--controls)) and the step's panel right beside it, with no arrow.
 */
function ControlsStep({ onNext }: { onNext: () => void }) {
  const panel = useRef<HTMLElement>(null)
  const [touch] = useState(() => window.matchMedia(touchPointer).matches)
  return (
    <>
      <TourPointer panel={panel} target={railGroups} arrow={false} />
      <TourPanel ref={panel} heading="Your controls" action={<TourButton onClick={onNext}>Next</TourButton>}>
        <p className="welcome-tour__text welcome-tour__move">{moveAndZoomWords(touch)}</p>
        <ul className="welcome-tour__controls">
          <li className="welcome-tour__control">
            <RailIcon className="welcome-tour__control-icon">
              <HideControlsIcon />
            </RailIcon>
            Hide controls: fold these buttons away, and bring them back
          </li>
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

function isGamePanelStep(progress: TourProgress): progress is GamePanelStepName {
  return (gamePanelSteps as readonly TourProgress[]).includes(progress)
}

/** A part of the open game's panel, for one of the game panel's steps to light. */
const panelPart = (selector: string) => () => document.querySelectorAll(`.game-panel:not(.game-panel--leaving) ${selector}`)

/**
 * The game panel's steps (see gamePanelSteps): each lights one part of the panel Click a score card
 * opened, dimming the rest of it with the globe, with no arrow but for Where to watch's, to the small TV button. The panel stays usable, so the viewer
 * can try what's lit. With no panel open (closed, or the tour picked up here after a reload), a step says
 * the same with nothing lit.
 */
const gamePanelStepParts: Record<GamePanelStepName, { heading: string; part: string; words: string }> = {
  // The tour plays the open game more often, so its score is seen to change (see tourPlayTick).
  gamePanel: {
    heading: 'The game panel',
    part: '.game-panel__score',
    words: "ScoreMap is live: scores change here and on the game's card, as it happens. No need to refresh.",
  },
  panelTabs: {
    heading: 'Game details',
    part: '.game-details-tabs',
    words: 'Open a tab for the score breakdowns, scoring plays, drives, player stats, and highlights.',
  },
  panelWatch: {
    heading: 'Where to watch',
    part: '.game-details-tv',
    words: 'The TV button shows which platform is broadcasting the event plus possible streaming and event detail links.',
  },
}

type GamePanelStepName = (typeof gamePanelSteps)[number]

const panelParts = Object.fromEntries(
  Object.entries(gamePanelStepParts).map(([step, { part }]) => [step, panelPart(part)]),
) as Record<GamePanelStepName, () => NodeListOf<Element>>

function GamePanelStep({ step, onNext }: { step: GamePanelStepName; onNext: () => void }) {
  const panel = useRef<HTMLElement>(null)
  const { heading, words } = gamePanelStepParts[step]
  // Game details sits right above the tabs it lights, over the game panel; the others as All set does.
  useRightAbove(step === 'panelTabs', panel, panelParts[step])
  return (
    <>
      <TourPointer key={step} panel={panel} target={panelParts[step]} arrow={step === 'panelWatch'} flush />
      <TourPanel ref={panel} heading={heading} action={<TourButton onClick={onNext}>Next</TourButton>}>
        <p className="welcome-tour__text">{words}</p>
      </TourPanel>
    </>
  )
}

/** The least room between a step and the part of the game panel it sits right above, and the screen's edges. */
const rightAboveGap = 12

/**
 * While `on`, keeps a step's panel right above a part of the game panel (`part`), over the panel,
 * centered on the part as far as the room left of the rail allows (the tour's padding, see
 * .welcome-tour), as wide as a step's panel is in that room.
 */
function useRightAbove(on: boolean, panel: RefObject<HTMLElement | null>, part: () => Iterable<Element>) {
  useEffect(() => {
    const element = panel.current
    const layerElement = element?.closest<HTMLElement>('.welcome-tour')
    if (!on || !element || !layerElement) return
    let frame = 0
    const look = () => {
      frame = requestAnimationFrame(look)
      const target = [...part()][0]?.getBoundingClientRect()
      if (!target) return
      const layer = layerElement.getBoundingClientRect()
      const style = getComputedStyle(layerElement)
      const roomLeft = parseFloat(style.paddingLeft)
      const roomRight = layer.width - parseFloat(style.paddingRight)
      element.style.position = 'absolute'
      element.style.width = `min(calc(110 * var(--spacing)), ${roomRight - roomLeft}px)`
      const width = element.offsetWidth
      const middle = target.left - layer.left + target.width / 2
      element.style.left = `${Math.max(roomLeft, Math.min(middle - width / 2, roomRight - width))}px`
      element.style.top = `${Math.max(rightAboveGap, target.top - layer.top - rightAboveGap - element.offsetHeight)}px`
    }
    look()
    return () => {
      cancelAnimationFrame(frame)
      for (const property of ['position', 'width', 'left', 'top']) element.style.removeProperty(property)
    }
  }, [on, panel, part])
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
  gameToTry: string
}

/**
 * Click a score card: what a score card opens, pointing at the tour's game to try (Ravens v Steelers,
 * see tourGameToTry), lit and pressable as part of the tour, when it's clear of the panel (see
 * scoreCardToTry). The tour's camera keeps it so; on a screen where it isn't, the step says the same without pointing. Nothing moves the globe
 * to bring a card into view. It has no Done: pressing the card moves on to The game panel, and its × closes the tour.
 */
function ScoreCardStep({ onOpenGame, scoreCards, gameToTry }: ScoreCardStepProps) {
  const panel = useRef<HTMLElement>(null)
  const toTry = useScoreCardToTry(panel, scoreCards, gameToTry)
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
 * for none, undefined until the panel has been measured. Only `gameToTry`'s card is pointed at,
 * while it's clear of the panel; its name follows its game (a new score, say).
 */
function useScoreCardToTry(panel: RefObject<HTMLElement | null>, scoreCards: () => ShownScoreCard[], gameToTry: string): CardToTry | null | undefined {
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
      const cards = latest.current().filter((card) => card.gameId === gameToTry)
      setToTry((current) => {
        const gameId = scoreCardToTry(cards, panelBox, screen)
        const picked = cards.find((card) => card.gameId === gameId)
        if (!picked) return null
        return current?.gameId === picked.gameId && current.label === picked.label ? current : { gameId: picked.gameId, label: picked.label }
      })
    }
    look()
    return () => cancelAnimationFrame(frame)
  }, [panel, gameToTry])
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
