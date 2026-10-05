import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import type { Game } from '../games/game'

// Must match GamesHub.Path and GamesHub.SnapshotMessage on the server.
const hubPath = '/hubs/games'
const snapshotMessage = 'Snapshot'

export interface LiveConnectionHandlers {
  onSnapshot: (games: Game[]) => void
}

/** Connects to the server's games hub. Returns a function that disconnects. */
export function connectToGames({ onSnapshot }: LiveConnectionHandlers): () => void {
  const connection = new HubConnectionBuilder()
    .withUrl(hubPath)
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build()

  connection.on(snapshotMessage, onSnapshot)

  const started = connection.start().catch((error: unknown) => {
    console.error('Could not connect to the ScoreMap server', error)
  })

  return () => {
    void started.then(() => connection.stop())
  }
}
