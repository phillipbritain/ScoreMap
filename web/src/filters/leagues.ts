import { useEffect, useState } from 'react'
import type { League } from './viewerSettings'

// Served by the server from its "Leagues" configuration (Program.cs).
const leaguesPath = '/api/leagues'

/** The configured leagues in order, for the filter menu. Empty until they load. */
export function useLeagues(): League[] {
  const [leagues, setLeagues] = useState<League[]>([])
  useEffect(() => {
    const abort = new AbortController()
    fetch(leaguesPath, { signal: abort.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
        return response.json() as Promise<League[]>
      })
      .then(setLeagues)
      .catch((error: unknown) => {
        if (!abort.signal.aborted) console.error('Could not load the league list', error)
      })
    return () => abort.abort()
  }, [])
  return leagues
}
