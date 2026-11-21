import type { Game, GameSides } from '../games/game'

export type TourClock =
  | { kind: 'countdown'; label: string; seconds: number }
  | { kind: 'minute'; minute: number }
  | { kind: 'fixed'; line: string }

/** A tour game keeps its play facts alongside the score and clock lines that the globe shows. */
export interface TourGame extends Game {
  contest: GameSides
  tourPlay: {
    scores: { home: number; away: number }
    phase: 'Playing' | 'InningBottom'
    clock: TourClock
  }
}

export function tourClockLine(clock: TourClock): string {
  switch (clock.kind) {
    case 'countdown':
      return `${clock.label} ${Math.floor(clock.seconds / 60)}:${String(clock.seconds % 60).padStart(2, '0')}`
    case 'minute':
      return `${clock.minute}'`
    case 'fixed':
      return clock.line
  }
}
