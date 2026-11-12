import { useEffect, useRef, useState } from 'react'
import type { ScenarioListing } from '../scenarios/scenarioPicker'
import { signalRGamesHub } from './liveConnection'
import { offerMadeUpChanges } from './madeUpChange'
import { noLiveGames, startLiveGames, type LiveGames, type LiveGamesState } from './liveGames'

/**
 * ScoreMap's live games, from the server over SignalR while awake (see liveGames.ts), in this page.
 * A new idle timeout takes effect without reconnecting.
 */
export function useLiveGames(
  idleTimeoutMs: number,
  demo: boolean,
  onScenarioChanged: (listing: ScenarioListing) => void,
): LiveGamesState {
  const [state, setState] = useState(noLiveGames)
  const live = useRef<LiveGames>(null)
  const latestIdleTimeout = useRef(idleTimeoutMs)

  useEffect(() => {
    const started = startLiveGames(
      { page: document, idleTimeoutMs: latestIdleTimeout.current, demo, hub: signalRGamesHub, onScenarioChanged },
      setState,
    )
    live.current = started
    const withdraw = offerMadeUpChanges(started)
    return () => {
      withdraw()
      started.stop()
      live.current = null
    }
  }, [demo, onScenarioChanged])
  useEffect(() => {
    latestIdleTimeout.current = idleTimeoutMs
    live.current?.setIdleTimeout(idleTimeoutMs)
  }, [idleTimeoutMs])

  return state
}
