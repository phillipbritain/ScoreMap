import { useId, useState, type ReactNode } from 'react'
import {
  isLeagueOn,
  leaguesBySport,
  sportSwitch,
  withLeague,
  withSport,
  type League,
  type ViewerSettings,
} from '../settings/viewerSettings'
import { canShowPicks, settingsForChoice, type TourChoice, type TourEvent, type TourProgress } from './welcomeTour'

interface WelcomeTourScreenProps {
  /** The step on show: the app shows the tour only while it isn't finished. */
  progress: Exclude<TourProgress, 'finished'>
  /** Moves the tour on (see tourProgressAfter). */
  onEvent: (event: TourEvent) => void
  leagues: readonly League[]
  settings: ViewerSettings
  /** Sets the viewer settings, as Leagues on the rail would, for the choice made on Welcome. */
  onChange: (settings: ViewerSettings) => void
}

/**
 * The welcome tour (see GLOSSARY.md): its step's panel of glass in the middle of the screen, over a
 * light dim that keeps the globe and rail from being used beneath it. There is no Ã—, Skip or dots, and
 * Escape does nothing: each step moves on only with its own choice or button. What each step does is
 * welcomeTour's; this only draws it.
 */
export function WelcomeTourScreen({ progress, onEvent, leagues, settings, onChange }: WelcomeTourScreenProps) {
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
      {progress === 'scoreCard' && <ScoreCardStep onDone={() => onEvent({ kind: 'done' })} />}
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
        Live sporting events around the globe. See what&apos;s happening in real time and where!
      </p>
      {picking ? (
        <>
          <h3 className="welcome-tour__question">Pick what you follow</h3>
          <p className="welcome-tour__text welcome-tour__note welcome-tour__note--above">
            You can change this any time in Leagues on the rail.
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
 * My leagues' picker: a chip for each sport, switching all its leagues as the sport's name does in
 * Leagues on the rail (dashed while only some are on), and its leagues as smaller chips under it. A
 * sport with one league has no league chips: its own chip is that league.
 */
function LeaguePicker({ leagues, settings, onChange }: Omit<WelcomeStepProps, 'onChoose'>) {
  return (
    <div className="welcome-tour__picker">
      {leaguesBySport(leagues).map((group) => {
        const state = sportSwitch(settings, group)
        return (
          <div key={group.sport} className="welcome-tour__sport">
            <button
              type="button"
              aria-pressed={state === 'on'}
              className={`rail-chip welcome-tour__sport-chip welcome-tour__sport-chip--${state}`}
              onClick={() => onChange(withSport(settings, group, state !== 'on'))}
            >
              {group.sport}
            </button>
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
  )
}

/** Your controls: the rail and what it's for. */
function ControlsStep({ onNext }: { onNext: () => void }) {
  return (
    <TourPanel heading="Your controls" action={<TourButton onClick={onNext}>Next</TourButton>}>
      <p className="welcome-tour__text">
        The buttons on the right zoom the globe, take you home, choose which games show and pick their colours.
      </p>
    </TourPanel>
  )
}

/** Click a score card: what a score card opens. */
function ScoreCardStep({ onDone }: { onDone: () => void }) {
  return (
    <TourPanel heading="Click a score card" action={<TourButton onClick={onDone}>Done</TourButton>}>
      <p className="welcome-tour__text">
        Try this one: it opens a panel with details for the event, venue, last score, where to watch, and more
      </p>
    </TourPanel>
  )
}

interface TourPanelProps {
  heading: string
  headingLevel?: 'h2' | 'h3'
  children: ReactNode
  /** The step's own button, at the panel's foot. */
  action?: ReactNode
}

/** A step's panel: glass, centred, labelled by its heading. */
function TourPanel({ heading, headingLevel: Heading = 'h3', children, action }: TourPanelProps) {
  const headingId = useId()
  return (
    <section className="welcome-tour__panel" role="dialog" aria-labelledby={headingId}>
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
