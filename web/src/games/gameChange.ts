// A change event as the server pushes it over SignalR.
// Mirrors server/src/ScoreMap.Server/Games/GameChange.cs (ADR-0003: shapes are defined on both sides).

import type { Game } from './game'

export type GameChangeKind = 'added' | 'removed' | 'scoreChanged' | 'started' | 'finished' | 'updated'

export interface GameChange {
  kind: GameChangeKind
  /** The game's current state; its last state when removed. */
  game: Game
}
