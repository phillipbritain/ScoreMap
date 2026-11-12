import type { Game } from '../games/game'
import type { GameChange } from '../games/gameChange'
import { applyChange } from '../games/gameStore'
import { noneJustHappened, recordJustHappened, type JustHappened } from '../games/justHappened'
import type { ScenarioListing } from '../scenarios/scenarioPicker'
import { watchForSleep, type PageVisibility } from './asleep'

/** What a connection to the server's games hub tells the browser. */
export interface GamesHubEvents {
  /** The full list of current games: on connect, and again after every reconnect. */
  snapshot: (games: Game[]) => void
  change: (change: GameChange) => void
  /** The scenario listing, after a switch or a change of speed made in any browser (local runs only). */
  scenarioChanged: (listing: ScenarioListing) => void
  /** The connection was lost and is being made again on its own. */
  reconnecting: () => void
  /** The connection closed, other than by stop: it has to be started again. */
  closed: () => void
}

/** One connection to the server's games hub, not yet started. */
export interface GamesHubConnection {
  start: () => Promise<void>
  stop: () => Promise<void>
}

/** Makes a connection to the games hub: SignalR in the app (see liveConnection.ts), a fake in tests. In a demo, to the demo's games (ADR-0019). */
export type GamesHub = (events: GamesHubEvents, demo: boolean) => GamesHubConnection

/** The games as the server last told them, and how the connection stands. */
export interface LiveGamesState {
  /** Null until the first snapshot arrives. */
  games: Game[] | null
  /**
   * What just happened in the games since the last snapshot: the changes the server judged notable, for
   * the globe to animate, and the side that last scored in each, for its score card and game panel to
   * light up. A snapshot brings none, so the globe shows it without pulses.
   */
  justHappened: JustHappened
  /** When ScoreMap was cut off from the server (the clock's time), until the next snapshot; null while connected. */
  cutOffSince: number | null
  /** Whether ScoreMap is waking up (see GLOSSARY.md "Asleep"): from when it's shown again until the next snapshot. */
  waking: boolean
}

const maxRetryDelayMs = 30_000

/** How long to wait before the next try at connecting, after the given number of failed tries. */
const backoffMs = (attempt: number) => Math.min(maxRetryDelayMs, 1000 * 2 ** attempt)

export const noLiveGames: LiveGamesState = {
  games: null,
  justHappened: noneJustHappened,
  cutOffSince: null,
  waking: false,
}

export interface LiveGamesOptions {
  page: PageVisibility
  /** How long the page can be hidden before ScoreMap falls asleep. */
  idleTimeoutMs: number
  demo: boolean
  hub: GamesHub
  onScenarioChanged: (listing: ScenarioListing) => void
  /** The clock cutOffSince and what just happened read: performance.now() in the app. */
  now?: () => number
}

export interface LiveGames {
  readonly state: LiveGamesState
  /** Takes a change as if the server had sent it: for a dev run to make one happen (see madeUpChange.ts). */
  receive: (change: GameChange) => void
  /** A new idle timeout: it counts from now if the page is hidden. */
  setIdleTimeout: (ms: number) => void
  /** Disconnects and stops watching the page. */
  stop: () => void
}

/**
 * ScoreMap's live games: connected to the server's games hub while awake, and keeping the games it
 * sends. Calls onState with each new state.
 */
export function startLiveGames(options: LiveGamesOptions, onState: (state: LiveGamesState) => void): LiveGames {
  const { hub, demo } = options
  let state = noLiveGames
  const update = (next: Partial<LiveGamesState>) => {
    state = { ...state, ...next }
    onState(state)
  }

  const now = options.now ?? (() => performance.now())
  const cutOff = () => {
    if (state.cutOffSince === null) update({ cutOffSince: now() })
  }

  // The snapshot always comes first; a change before it has nothing to apply to.
  const receive = (change: GameChange) => {
    if (!state.games) return
    const before = state.games.find((game) => game.id === change.game.id)
    update({
      games: applyChange(state.games, change),
      justHappened: recordJustHappened(state.justHappened, before, change, now()),
    })
  }

  /**
   * Connects to the games hub and stays connected: SignalR reconnects on its own, and the first start, or
   * a start after a close, is retried here with backoff, forever. The server sends a fresh snapshot on
   * every (re)connect, so the browser catches up on anything it missed. Returns a function that retires
   * the connection: anything it sends after that is ignored.
   */
  const connect = (): (() => void) => {
    let retired = false
    let retry: ReturnType<typeof setTimeout> | undefined
    // Whatever a retired connection still sends is ignored.
    const live =
      <A extends unknown[]>(handle: (...args: A) => void) =>
      (...args: A) => {
        if (!retired) handle(...args)
      }

    const connection = hub(
      {
        snapshot: live((games) => update({ games, justHappened: noneJustHappened, cutOffSince: null, waking: false })),
        // The server's own judgment of what changed is kept for the globe to animate (see GlobeMap.show).
        change: live(receive),
        // A switch or a change of speed made in any browser: every pill and clock follows.
        scenarioChanged: live(options.onScenarioChanged),
        reconnecting: live(cutOff),
        // SignalR's reconnect never gives up, so a close it didn't start is a start to make again.
        closed: live(() => {
          cutOff()
          retryIn(1_000)
        }),
      },
      demo,
    )

    const start = async (attempt = 0): Promise<void> => {
      if (retired) return
      try {
        await connection.start()
      } catch (error: unknown) {
        console.error('Could not connect to the ScoreMap server; retrying', error)
        retryIn(backoffMs(attempt), attempt + 1)
      }
    }
    const retryIn = (ms: number, attempt = 0) => {
      clearTimeout(retry)
      retry = setTimeout(() => void start(attempt), ms)
    }

    const started = start()
    return () => {
      retired = true
      clearTimeout(retry)
      void started.then(() => connection.stop())
    }
  }

  // Connected while awake: falling asleep disconnects, and waking connects afresh, for a fresh snapshot.
  let disconnect: (() => void) | null = connect()
  let idleTimeoutMs = options.idleTimeoutMs
  const watch = () =>
    watchForSleep(
      options.page,
      idleTimeoutMs,
      {
        onSleep: () => {
          disconnect?.()
          disconnect = null
        },
        onWake: () => {
          update({ waking: true, cutOffSince: now() })
          disconnect = connect()
        },
      },
      disconnect === null,
    )
  let stopWatching = watch()

  return {
    get state() {
      return state
    },
    receive,
    setIdleTimeout: (ms) => {
      if (ms === idleTimeoutMs) return
      idleTimeoutMs = ms
      stopWatching()
      stopWatching = watch()
    },
    stop: () => {
      stopWatching()
      disconnect?.()
      disconnect = null
    },
  }
}
