import { useCallback, useEffect, useRef, useState } from 'react'
import { pickerEntries, pillLabel, showsPill, togglesPill, type ScenarioListing } from './scenarioPicker'

// Served by the server in Development only (ScenarioEndpoints.cs); elsewhere it lists no scenarios.
const scenariosPath = '/api/scenarios'
const runningPath = '/api/scenarios/running'

async function readListing(response: Response): Promise<ScenarioListing> {
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`)
  return (await response.json()) as ScenarioListing
}

/**
 * The scenario picker (ADR-0009): a pill over the globe naming the running scenario, opening a list of
 * every scenario plus "Real games". Picking one switches the server, and so every browser: the server
 * then tells every browser what is running over the games hub, and the app passes that on in
 * `listing` (see `withRunning`), so each pill follows. Shows only when the server has scenarios,
 * which is never on the deployed site. Shift+S hides and shows it.
 */
export function ScenarioPill({
  listing,
  setListing,
}: {
  listing: ScenarioListing | null
  setListing: (listing: ScenarioListing) => void
}) {
  const [hidden, setHidden] = useState(false)
  const [switching, setSwitching] = useState(false)
  const details = useRef<HTMLDetailsElement>(null)

  // Fetched again on opening the list and on coming back to the tab, to pick up new scenario files
  // (and anything missed while disconnected from the games hub).
  const refresh = useCallback((signal?: AbortSignal) => {
    fetch(scenariosPath, { signal })
      .then(readListing)
      .then(setListing)
      .catch((error: unknown) => {
        if (!signal?.aborted) console.error('Could not load the scenario list', error)
      })
  }, [setListing])

  useEffect(() => {
    const abort = new AbortController()
    refresh(abort.signal)
    const onFocus = () => refresh(abort.signal)
    window.addEventListener('focus', onFocus)
    return () => {
      abort.abort()
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (togglesPill({ ...pick(event), target })) setHidden((was) => !was)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!listing || !showsPill(listing, { hidden })) return null

  const switchTo = (name: string) => {
    setSwitching(true)
    fetch(runningPath, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
      .then(readListing)
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

function pick({ key, shiftKey, ctrlKey, altKey, metaKey }: KeyboardEvent) {
  return { key, shiftKey, ctrlKey, altKey, metaKey }
}
