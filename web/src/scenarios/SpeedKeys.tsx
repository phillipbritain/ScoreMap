import { useState, type ReactNode } from 'react'
import { litKey, pressedSpeed, showsFasterIcon, type MediaKey, type ScenarioListing } from './scenarioPicker'
import { putScenarios } from './useScenarioControls'

/**
 * The media keys (ADR-0009): Pause, Play and Fast-forward for the scenario clock's speed, with no
 * label: the lit key is the speed, and Fast-forward grows a third triangle at Faster. Pressing one
 * changes the server's speed, and so every browser's, carrying on from where the scenario is. Shown
 * only where play can be controlled.
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
    <div className="speed-keys" role="group" aria-label="Scenario speed">
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
