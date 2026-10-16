import { useEffect, useId, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react'
import { railButtons, type RailButtonName } from '../rail/railButtons'
import { RailIcon } from '../rail/railIcons'
import {
  isLeagueOn,
  leaguesBySport,
  sportSwitch,
  withAllLeagues,
  withLeague,
  withSport,
  type League,
  type ViewerSettings,
} from '../settings/viewerSettings'
import { TourPointer } from './TourPointer'
import {
  canShowPicks,
  scoreCardToTry,
  settingsForChoice,
  type CardOnScreen,
  type TourChoice, type TourEvent, type TourProgress } from './welcomeTour'

interface WelcomeTourScreenProps {
  /** The step on show: the app shows the tour only while it isn't finished. */
  progress: Exclude<TourProgress, 'finished'>
  /** Moves the tour on (see tourProgressAfter). */
  onEvent: (event: TourEvent) => void
  leagues: readonly League[]
  settings: ViewerSettings
  /** Sets the viewer settings, as Leagues on the rail would, for the choice made on Welcome. */
  onChange: (settings: ViewerSettings) => void
  /** Opens a game's panel, as clicking its score card on the globe would: Click a score card's lit card. */
  onOpenGame: (gameId: string) => void
}

/**
 * The welcome tour (see GLOSSARY.md): its step's panel of glass in the middle of the screen (on a
 * phone, a bottom sheet where the game panel sits), over a light dim that keeps the globe and rail
 * from being used beneath it. There is no ×, Skip or dots, and Escape does nothing: each step moves
 * on only with its own choice or button. What each step does is welcomeTour's; this only draws it.
 */
export function WelcomeTourScreen({ progress, onEvent, leagues, settings, onChange, onOpenGame }: WelcomeTourScreenProps) {
  const choose = (choice: TourChoice) => {
    // My leagues' settings were set as its picker opened, and the viewer has picked since.
    if (choice !== 'myLeagues') onChange(settingsForChoice(settings, choice, leagues))
    onEvent({ kind: 'chose', choice })
  }
  return (
    <div className="welcome-tour">
      {/* Catches every press, so nothing under the tour can be used. */}
      <div className="welcome-tour__dim" />
      {progress === 'welcome' && (
        <WelcomeStep onChoose={choose} leagues={leagues} settings={settings} onChange={onChange} />
      )}
      {progress === 'controls' && <ControlsStep onNext={() => onEvent({ kind: 'next' })} />}
      {progress === 'scoreCard' && (
        <ScoreCardStep
          onDone={() => onEvent({ kind: 'done' })}
          onOpenGame={(gameId) => {
            onOpenGame(gameId)
            onEvent({ kind: 'gameOpened' })
          }}
        />
      )}
    </div>
  )
}

interface WelcomeStepProps {
  onChoose: (choice: TourChoice) => void
  leagues: readonly League[]
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
}

/**
 * Welcome: what ScoreMap is, and what to see first. My leagues switches every league off and opens its
 * picker in the panel; "Show these" then makes the choice.
 */
function WelcomeStep({ onChoose, leagues, settings, onChange }: WelcomeStepProps) {
  const [picking, setPicking] = useState(false)
  const pickMyLeagues = () => {
    onChange(settingsForChoice(settings, 'myLeagues', leagues))
    setPicking(true)
  }
  return (
    <TourPanel
      heading="Welcome to ScoreMap"
      headingLevel="h2"
      action={
        picking && (
          <TourButton onClick={() => onChoose('myLeagues')} disabled={!canShowPicks(settings, leagues)}>
            Show these
          </TourButton>
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
          <LeaguePicker leagues={leagues} settings={settings} onChange={onChange} />
        </>
      ) : (
        <>
          <h3 className="welcome-tour__question">What would you like to see?</h3>
          <div className="welcome-tour__choices">
            <button type="button" className="welcome-tour__choice" onClick={() => onChoose('topEvents')}>
              <svg className="welcome-tour__star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <strong>Top Events</strong>
              <span>The biggest games right now, in every sport</span>
            </button>
            <button type="button" className="welcome-tour__choice" onClick={pickMyLeagues}>
              <strong>My leagues</strong>
              <span>Pick the sports and leagues you follow</span>
            </button>
            <button type="button" className="welcome-tour__choice" onClick={() => onChoose('everything')}>
              <strong>Everything</strong>
              <span>Every league ScoreMap shows</span>
            </button>
          </div>
          <p className="welcome-tour__text welcome-tour__note">You can change this any time in Leagues on the rail.</p>
        </>
      )}
    </TourPanel>
  )
}

/**
 * My leagues' picker: "Select all", switching every league as "All leagues" does in Leagues on the
 * rail, then a card for each sport, its switch switching all its leagues as the sport's name does
 * there, and its leagues as chips in it. A sport with one league has no chips: its switch is that
 * league. Each switch shows half-way while only some of its leagues are on.
 */
function LeaguePicker({ leagues, settings, onChange }: Omit<WelcomeStepProps, 'onChoose'>) {
  const leaguesOn = leagues.filter((league) => isLeagueOn(settings, league.name)).length
  const allState = leaguesOn === leagues.length ? 'on' : leaguesOn === 0 ? 'off' : 'mixed'
  return (
    <div className="welcome-tour__picker">
      <SwitchButton
        state={allState}
        className="welcome-tour__select-all"
        onClick={() => onChange(withAllLeagues(settings, leagues, allState !== 'on'))}
      >
        Select all
      </SwitchButton>
      <div className="welcome-tour__sports">
        {leaguesBySport(leagues).map((group) => {
          const state = sportSwitch(settings, group)
          return (
            <div key={group.sport} className={`welcome-tour__sport welcome-tour__sport--${state}`}>
              <SwitchButton
                state={state}
                className="welcome-tour__sport-switch"
                onClick={() => onChange(withSport(settings, group, state !== 'on'))}
              >
                {group.sport}
              </SwitchButton>
              {group.leagues.length > 1 && (
                <div className="leagues-chips welcome-tour__league-chips">
                  {group.leagues.map((league) => {
                    const on = isLeagueOn(settings, league.name)
                    return (
                      <button
                        key={league.name}
                        type="button"
                        aria-pressed={on}
                        className="rail-chip welcome-tour__league-chip"
                        onClick={() => onChange(withLeague(settings, league.name, !on))}
                      >
                        {league.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface SwitchButtonProps {
  /** On, off, or mixed while only some of the leagues it switches are on. */
  state: 'on' | 'off' | 'mixed'
  className: string
  onClick: () => void
  children: ReactNode
}

/** A label with a switch at its right, switching some leagues: all on, or all off when they're all on already. */
function SwitchButton({ state, className, onClick, children }: SwitchButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={state === 'mixed' ? 'mixed' : state === 'on'}
      className={`welcome-tour__switch-button ${className}`}
      onClick={onClick}
    >
      {children}
      <span className={`welcome-tour__switch welcome-tour__switch--${state}`} aria-hidden="true" />
    </button>
  )
}

/** A few words on each of the rail's buttons, which Your controls lists beside its icon. */
const railButtonWords: Record<RailButtonName, string> = {
  'Zoom in': 'Zoom in',
  'Zoom out': 'Zoom out',
  Home: 'Home: back to your part of the world',
  'Live games only': 'Live games only',
  'Show Disrupted games': 'Show Disrupted games: postponed, suspended or canceled',
  Leagues: 'Leagues: Top Events or your own picks',
  Colours: 'Colours for each sport and league',
}

/** The rail's groups of buttons, which Your controls lights and points at. */
const railGroups = () => document.querySelectorAll('.rail__group')

/** Your controls: each of the rail's buttons and what it's for, with the rail lit and pointed at. */
function ControlsStep({ onNext }: { onNext: () => void }) {
  const panel = useRef<HTMLElement>(null)
  return (
    <>
      <TourPointer panel={panel} target={railGroups} />
      <TourPanel ref={panel} heading="Your controls" action={<TourButton onClick={onNext}>Next</TourButton>}>
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

interface ScoreCardStepProps {
  onDone: () => void
  onOpenGame: (gameId: string) => void
}

/**
 * Click a score card: what a score card opens, pointing at a real one to try (see scoreCardToTry),
 * lit and pressable as part of the tour; or, with none clear of the panel, an example card in it.
 * Nothing moves the globe to bring a card into view.
 */
function ScoreCardStep({ onDone, onOpenGame }: ScoreCardStepProps) {
  const panel = useRef<HTMLElement>(null)
  const gameId = useScoreCardToTry(panel)
  const card = () => (gameId ? scoreCardElements(gameId) : [])
  return (
    <>
      {gameId && (
        <TourPointer
          panel={panel}
          target={card}
          aim={() => card().flatMap((element) => [...element.querySelectorAll('.score-card__team')])}
          onTargetClick={() => onOpenGame(gameId)}
          targetLabel={`Open ${cardName(card()[0])}`}
        />
      )}
      <TourPanel ref={panel} heading="Click a score card" action={<TourButton onClick={onDone}>Done</TourButton>}>
        {/* Neither wording until the panel has been measured and a card picked (or none). */}
        {gameId === null && (
          <>
            <p className="welcome-tour__text">
              Each game shows as a score card like this one. Click one to open a panel with details for the event,
              venue, last score, where to watch, and more
            </p>
            <ExampleScoreCard />
          </>
        )}
        {gameId && (
          <p className="welcome-tour__text">
            Try this one: it opens a panel with details for the event, venue, last score, where to watch, and more
          </p>
        )}
      </TourPanel>
    </>
  )
}

/**
 * The score card for Click a score card to point at, following the cards as they're laid out: null
 * for none (the example card), undefined until the panel has been measured. Once picked, a card is
 * kept for as long as it stays clear of the panel, so the arrow doesn't hop between cards.
 */
function useScoreCardToTry(panel: RefObject<HTMLElement | null>): string | null | undefined {
  const [gameId, setGameId] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let frame = 0
    const look = () => {
      frame = requestAnimationFrame(look)
      const panelBox = panel.current?.getBoundingClientRect()
      const screen = panel.current?.closest('.welcome-tour')?.getBoundingClientRect()
      if (!panelBox || !screen) return
      const cards = scoreCardsOnScreen()
      setGameId((current) => {
        const kept = cards.filter((card) => card.gameId === current)
        return scoreCardToTry(kept, panelBox, screen) ?? scoreCardToTry(cards, panelBox, screen)
      })
    }
    look()
    return () => cancelAnimationFrame(frame)
  }, [panel])
  return gameId
}

/** The score cards on the globe, but those whose games are counted in a card cluster (hidden). */
function scoreCardsOnScreen(): CardOnScreen[] {
  return [...document.querySelectorAll<HTMLElement>('.score-card[data-game-id]')]
    .filter((element) => !element.closest('[data-in-card-cluster]'))
    .map((element) => ({ gameId: element.dataset.gameId!, box: element.getBoundingClientRect() }))
}

function scoreCardElements(gameId: string): Element[] {
  return [...document.querySelectorAll(`.score-card[data-game-id="${CSS.escape(gameId)}"]`)]
}

/** A card's game by its teams, "BOS at NYK", for its button's name. */
function cardName(card: Element | undefined): string {
  const teams = [...(card?.querySelectorAll('.score-card__abbreviation') ?? [])].map((team) => team.textContent)
  return teams.length === 2 ? `${teams[0]} at ${teams[1]}` : 'this game'
}

/** A score card drawn as the globe draws a Live one, labelled as an example. */
function ExampleScoreCard() {
  return (
    <figure className="welcome-tour__example" aria-label="An example score card">
      <span className="welcome-tour__example-tag">Example</span>
      <div className="score-card score-card--live">
        <div className="score-card__header">
          <span className="score-card__light" />
          <span className="score-card__clock">Q3 4:12</span>
        </div>
        {[
          ['BOS', '88'],
          ['NYK', '84'],
        ].map(([abbreviation, score]) => (
          <div key={abbreviation} className="score-card__team">
            <span className="score-card__logo" />
            <span className="score-card__abbreviation">{abbreviation}</span>
            <span className="score-card__score">{score}</span>
          </div>
        ))}
      </div>
    </figure>
  )
}

interface TourPanelProps {
  heading: string
  headingLevel?: 'h2' | 'h3'
  children: ReactNode
  /** The step's own button, at the panel's foot. */
  action?: ReactNode
  /** The panel itself, for a step's arrow to start from. */
  ref?: Ref<HTMLElement>
}

/** A step's panel: glass, centred (a bottom sheet on a phone), labelled by its heading. */
function TourPanel({ heading, headingLevel: Heading = 'h3', children, action, ref }: TourPanelProps) {
  const headingId = useId()
  return (
    <section ref={ref} className="welcome-tour__panel" role="dialog" aria-labelledby={headingId}>
      <Heading id={headingId} className="welcome-tour__heading">
        {heading}
      </Heading>
      {children}
      {action && <div className="welcome-tour__actions">{action}</div>}
    </section>
  )
}

interface TourButtonProps {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}

function TourButton({ onClick, disabled, children }: TourButtonProps) {
  return (
    <button type="button" className="welcome-tour__button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}
