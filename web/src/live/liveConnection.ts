import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import type { Game } from '../games/game'
import type { GameChange } from '../games/gameChange'

// Must match GamesHub.Path, GamesHub.SnapshotMessage, GamesHub.ChangeMessage and
// GamesHub.ScenarioSwitchedMessage on the server.
const hubPath = '/hubs/games'
const snapshotMessage = 'Snapshot'
const changeMessage = 'GameChanged'
const scenarioSwitchedMessage = 'ScenarioSwitched'

const maxRetryDelayMs = 30_000

export interface LiveConnectionHandlers {
  /** The full list of current games: on connect, and again after every reconnect. */
  onSnapshot: (games: Game[]) => void
  onChange: (change: GameChange) => void
  /** The scenario now running ("real" for real games), after a switch made in any browser (local runs only). */
  onScenarioSwitched: (running: string) => void
}

/**
 * Connects to the server's games hub and stays connected: it retries with backoff
 * forever, and the server sends a fresh snapshot on every (re)connect so the
 * browser catches up on anything it missed. Returns a function that disconnects.
 */
export function connectToGames({ onSnapshot, onChange, onScenarioSwitched }: LiveConnectionHandlers): () => void {
  const connection = new HubConnectionBuilder()
    .withUrl(hubPath)
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: ({ previousRetryCount }) =>
        Math.min(maxRetryDelayMs, 1000 * 2 ** previousRetryCount),
    })
    .configureLogging(LogLevel.Warning)
    .build()

  connection.on(snapshotMessage, onSnapshot)
  connection.on(changeMessage, onChange)
  connection.on(scenarioSwitchedMessage, onScenarioSwitched)

  let stopped = false
  let retry: ReturnType<typeof setTimeout> | undefined

  // The first start isn't retried by SignalR itself, so retry it here too.
  const start = async (attempt = 0): Promise<void> => {
    if (stopped) return
    try {
      await connection.start()
    } catch (error: unknown) {
      console.error('Could not connect to the ScoreMap server; retrying', error)
      retry = setTimeout(() => void start(attempt + 1), Math.min(maxRetryDelayMs, 1000 * 2 ** attempt))
    }
  }

  // Automatic reconnect never gives up, so a close is either our stop or a start failure.
  connection.onclose(() => {
    if (!stopped) retry = setTimeout(() => void start(), 1000)
  })

  const started = start()

  return () => {
    stopped = true
    clearTimeout(retry)
    void started.then(() => connection.stop())
  }
}
