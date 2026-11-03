import { useCallback, useEffect, useState } from 'react'
import type { League } from './viewerSettings'

// Served by the server from its "Leagues" configuration (Program.cs).
const leaguesPath = '/api/leagues'

type LeagueListState =
  | { status: 'loading' | 'failed'; leagues: readonly [] }
  | { status: 'ready'; leagues: readonly League[] }

export type LeagueList = LeagueListState & { retry: () => void }

/** Configured leagues in order, with an explicit retry after a failed request. No background retries. */
export function useLeagues(): LeagueList {
  const [state, setState] = useState<LeagueListState>({ status: 'loading', leagues: [] })
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => {
    setState({ status: 'loading', leagues: [] })
    setAttempt((current) => current + 1)
  }, [])
  useEffect(() => {
    const abort = new AbortController()
    fetch(leaguesPath, { signal: abort.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
        return response.json() as Promise<League[]>
      })
      .then((leagues) => {
        if (!abort.signal.aborted) setState({ status: 'ready', leagues })
      })
      .catch(() => {
        if (!abort.signal.aborted) setState({ status: 'failed', leagues: [] })
      })
    return () => abort.abort()
  }, [attempt])
  return { ...state, retry }
}
