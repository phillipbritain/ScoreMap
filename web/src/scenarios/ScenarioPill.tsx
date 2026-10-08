import { useRef, useState } from 'react'
import { pickerEntries, pillLabel, type ScenarioListing } from './scenarioPicker'
import { putScenarios } from './useScenarioControls'

/**
 * The scenario picker (ADR-0009): a pill naming the running scenario, opening a list of every scenario
 * plus "Real games". Picking one switches the server, and so every browser: the server then sends every
 * browser the new listing over the games hub, so each pill follows.
 */
export function ScenarioPill({
  listing,
  setListing,
  refresh,
}: {
  listing: ScenarioListing
  setListing: (listing: ScenarioListing) => void
  refresh: () => void
}) {
  const [switching, setSwitching] = useState(false)
  const details = useRef<HTMLDetailsElement>(null)

  const switchTo = (name: string) => {
    setSwitching(true)
    putScenarios('running', { name })
      .then((switched) => {
        setListing(switched)
        if (details.current) details.current.open = false
      })
      .catch((error: unknown) => console.error(`Could not switch to ${name}`, error))
      .finally(() => setSwitching(false))
  }

  return (
    <details
      ref={details}
      className="scenario-pill"
      onToggle={(event) => {
        // Fetched again on opening the list, to pick up new scenario files.
        if (event.currentTarget.open) refresh()
      }}
    >
      <summary>{pillLabel(listing)} ▾</summary>
      <ul>
        {pickerEntries(listing).map((entry) => (
          <li key={entry.name}>
            <button
              type="button"
              aria-current={entry.running}
              disabled={switching}
              onClick={() => switchTo(entry.name)}
            >
              {entry.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
