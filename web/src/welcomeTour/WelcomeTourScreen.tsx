import { useId, useRef, type ReactNode, type Ref } from 'react'
import {
  DisruptedIcon,
  HomeIcon,
  LeaguesIcon,
  LiveIcon,
  PaletteIcon,
  RailIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '../rail/railIcons'
import type { League, ViewerSettings } from '../settings/viewerSettings'
import { TourPointer } from './TourPointer'
import { settingsForChoice, type TourChoice, type TourEvent, type TourProgress } from './welcomeTour'

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
    onChange(settingsForChoice(settings, choice, leagues))
    onEvent({ kind: 'chose', choice })
  }
  return (
    <div className="welcome-tour">
      {/* Catches every press, so nothing under the tour can be used. */}
      <div className="welcome-tour__dim" />
      {progress === 'welcome' && <WelcomeStep onChoose={choose} />}
      {progress === 'controls' && <ControlsStep onNext={() => onEvent({ kind: 'next' })} />}
      {progress === 'scoreCard' && <ScoreCardStep onDone={() => onEvent({ kind: 'done' })} />}
    </div>
  )
}

/** Welcome: what ScoreMap is, and what to see first. */
function WelcomeStep({ onChoose }: { onChoose: (choice: TourChoice) => void }) {
  return (
    <TourPanel heading="Welcome to ScoreMap" headingLevel="h2">
      <p className="welcome-tour__text">
        Live sporting events around the globe. See what&apos;s happening in real time and where!
      </p>
      <h3 className="welcome-tour__question">What would you like to see?</h3>
      <div className="welcome-tour__choices">
        <button type="button" className="welcome-tour__choice" onClick={() => onChoose('topEvents')}>
          <svg className="welcome-tour__star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <strong>Top Events</strong>
          <span>The biggest games right now, in every sport</span>
        </button>
        <button type="button" className="welcome-tour__choice" onClick={() => onChoose('everything')}>
          <strong>Everything</strong>
          <span>Every league ScoreMap shows</span>
        </button>
      </div>
      <p className="welcome-tour__text welcome-tour__note">You can change this any time in Leagues on the rail.</p>
    </TourPanel>
  )
}

/** The rail's buttons, top to bottom: each with the rail's own icon and a few words on it. */
const railButtons = [
  { name: 'Zoom in', icon: <ZoomInIcon />, words: 'Zoom in' },
  { name: 'Zoom out', icon: <ZoomOutIcon />, words: 'Zoom out' },
  { name: 'Home', icon: <HomeIcon />, words: 'Home: back to your part of the world' },
  { name: 'Live games only', icon: <LiveIcon />, words: 'Live games only' },
  { name: 'Show Disrupted games', icon: <DisruptedIcon />, words: 'Show games that were called off' },
  { name: 'Leagues', icon: <LeaguesIcon />, words: 'Leagues: Top Events or your own picks' },
  { name: 'Colours', icon: <PaletteIcon />, words: 'Colours for each sport and league' },
]

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
          {railButtons.map(({ name, icon, words }) => (
            <li key={name} className="welcome-tour__control">
              <RailIcon className="welcome-tour__control-icon">{icon}</RailIcon>
              {words}
            </li>
          ))}
        </ul>
      </TourPanel>
    </>
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
  /** The panel itself, for a step's arrow to start from. */
  ref?: Ref<HTMLElement>
}

/** A step's panel: glass, centred, labelled by its heading. */
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

function TourButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="welcome-tour__button" onClick={onClick}>
      {children}
    </button>
  )
}
