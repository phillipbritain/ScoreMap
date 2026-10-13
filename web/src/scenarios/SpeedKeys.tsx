import { useState, type ReactNode } from 'react'
import { litKey, pressedSpeed, showsFasterIcon, type MediaKey, type ScenarioListing } from './scenarioPicker'
import { putScenarios, switchScenario } from './useScenarioControls'

/**
 * The media keys (ADR-0009): Reset, then Pause, Play and Fast-forward for the scenario clock's speed,
 * with no label: the lit key is the speed, and Fast-forward grows a third triangle at Faster. Pressing
 * one changes the server's speed, and so every browser's, carrying on from where the scenario is.
 * Reset starts the running scenario afresh, at the same speed, as picking it again in the pill does.
 * Shown only where play can be controlled.
 */
export function SpeedKeys({
  listing,
  setListing,
}: {
  listing: ScenarioListing
  setListing: (listing: ScenarioListing) => void
}) {
  const [changing, setChanging] = useState(false)
  const lit = litKey(listing.speed)

  const press = (key: MediaKey) => {
    const speed = pressedSpeed(listing.speed, key)
    // A lit Play or Pause is already the speed.
    if (speed === listing.speed) return
    setChanging(true)
    putScenarios('speed', { speed })
      .then(setListing)
      .catch((error: unknown) => console.error(`Could not change the speed to ${speed}`, error))
      .finally(() => setChanging(false))
  }

  const reset = () => {
    setChanging(true)
    switchScenario(listing.running, setListing)
      .catch((error: unknown) => console.error(`Could not reset ${listing.running}`, error))
      .finally(() => setChanging(false))
  }

  const keyButton = (name: MediaKey, title: string, icon: ReactNode, className?: string) => (
    <button
      type="button"
      className={className}
      aria-label={title}
      aria-pressed={lit === name}
      title={title}
      disabled={changing}
      onClick={() => press(name)}
    >
      {icon}
    </button>
  )

  const faster = showsFasterIcon(listing.speed)
  return (
    <div className="speed-keys" role="group" aria-label="Scenario play">
      <button type="button" aria-label="Reset" title="Reset" disabled={changing} onClick={reset}>
        <ResetIcon />
      </button>
      {keyButton('pause', 'Pause', <PauseIcon />)}
      {keyButton('play', 'Play', <PlayIcon />)}
      {keyButton(
        'fastForward',
        `Fast-forward to ${pressedSpeed(listing.speed, 'fastForward')}`,
        faster ? <FasterIcon /> : <FastForwardIcon />,
        faster ? 'speed-keys__fast-forward speed-keys__fast-forward--faster' : 'speed-keys__fast-forward',
      )}
    </div>
  )
}

// Drawn on one grid, so the keys match in size and weight. Text glyphs (⏩, ⏸) show as emoji or as
// uneven blocks on Windows.
const triangle = (x: number) => `M${x} 3.6v8.8a.6.6 0 0 0 .9.5L${x + 7} 8.5a.6.6 0 0 0 0-1L${x + 0.9} 3.1a.6.6 0 0 0-.9.5z`

/** A ring with an arrowhead, turning back to the start. */
function ResetIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.2 8a4.8 4.8 0 1 0 1.4-3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M2.3 1.9v4.2a.6.6 0 0 0 .6.6h4.2a.6.6 0 0 0 .4-1L3.3 1.5a.6.6 0 0 0-1 .4z" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
      <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
    </svg>
  )
}

function FastForwardIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d={triangle(1)} />
      <path d={triangle(8)} />
    </svg>
  )
}

function FasterIcon() {
  return (
    <svg className="speed-keys__wide-icon" viewBox="0 0 23 16" aria-hidden="true">
      <path d={triangle(1)} />
      <path d={triangle(8)} />
      <path d={triangle(15)} />
    </svg>
  )
}
