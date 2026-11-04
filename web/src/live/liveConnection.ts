import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { demoQuery } from '../demo/demo'
import type { GamesHub } from './liveGames'

// Must match GamesHub.Path, GamesHub.SnapshotMessage, GamesHub.ChangeMessage and
// GamesHub.ScenarioChangedMessage on the server.
const hubPath = '/hubs/games'
const snapshotMessage = 'Snapshot'
const changeMessage = 'GameChanged'
const scenarioChangedMessage = 'ScenarioChanged'

const maxRetryDelayMs = 30_000

/**
 * The server's games hub, over SignalR: a connection that reconnects on its own with backoff, forever,
 * once started. In a demo, it watches the demo's games (ADR-0019). The live games module (liveGames.ts)
 * starts and stops it, and retries a start that fails.
 */
export const signalRGamesHub: GamesHub = (events, demo) => {
  const connection = new HubConnectionBuilder()
    .withUrl(demo ? `${hubPath}?${demoQuery}` : hubPath)
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: ({ previousRetryCount }) =>
        Math.min(maxRetryDelayMs, 1000 * 2 ** previousRetryCount),
    })
    .configureLogging(LogLevel.Warning)
    .build()

  connection.on(snapshotMessage, events.snapshot)
  connection.on(changeMessage, events.change)
  connection.on(scenarioChangedMessage, events.scenarioChanged)
  connection.onreconnecting(() => events.reconnecting())
  connection.onclose(() => events.closed())

  return { start: () => connection.start(), stop: () => connection.stop() }
}
