import { useCallback, useEffect, useState } from 'react'
import { showsScenarioControls, togglesScenarioControls, type ScenarioListing } from './scenarioPicker'

// Served by the server in Development only (ScenarioEndpoints.cs); elsewhere it lists no scenarios.
const scenariosPath = '/api/scenarios'

async function readListing(response: Response): Promise<ScenarioListing> {
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`)
  return (await response.json()) as ScenarioListing
}

/** Puts `body` to one of the scenario endpoints, which answers with the listing as it now is. */
export async function putScenarios(path: 'running' | 'speed', body: object): Promise<ScenarioListing> {
  const response = await fetch(`${scenariosPath}/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return readListing(response)
}

export interface ScenarioControls {
  /** What the server says about scenarios; null until it has said. */
  listing: ScenarioListing | null
  setListing: (listing: ScenarioListing) => void
  /** Fetches the listing again, to pick up new scenario files. */
  refresh: () => void
  /** Whether the scenario pill, the media keys and the clock show. */
  shown: boolean
}

/**
 * The scenario controls' state (ADR-0009): the listing, fetched on start and again on coming back to
 * the tab (for anything missed while disconnected from the games hub), and whether Shift+S has hidden
 * the controls. The app passes on the listings the server sends over the games hub to `setListing`, so
 * every tab follows a switch or a change of speed made in any of them.
 */
export function useScenarioControls(): ScenarioControls {
  const [listing, setListing] = useState<ScenarioListing | null>(null)
  const [hidden, setHidden] = useState(false)

  const load = useCallback((signal?: AbortSignal) => {
    fetch(scenariosPath, { signal })
      .then(readListing)
      .then(setListing)
      .catch((error: unknown) => {
        if (!signal?.aborted) console.error('Could not load the scenario list', error)
      })
  }, [])

  useEffect(() => {
    const abort = new AbortController()
    load(abort.signal)
    const onFocus = () => load(abort.signal)
    window.addEventListener('focus', onFocus)
    return () => {
      abort.abort()
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { key, shiftKey, ctrlKey, altKey, metaKey } = event
      const target = event.target instanceof HTMLElement ? event.target : null
      if (togglesScenarioControls({ key, shiftKey, ctrlKey, altKey, metaKey, target })) setHidden((was) => !was)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const refresh = useCallback(() => load(), [load])
  return { listing, setListing, refresh, shown: showsScenarioControls(listing, { hidden }) }
}
