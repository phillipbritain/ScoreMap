import type { GameChange, GameChangeKind } from '../games/gameChange'

/**
 * How a pin (or the cluster it's in) draws attention to a change: a lively burst when the score
 * changes, a pulse when a game starts, and a calmer fade when it finishes. The styles live in CSS.
 */
export type PinAnimation = 'score' | 'start' | 'finish'

const animations: Partial<Record<GameChangeKind, PinAnimation>> = {
  ScoreChanged: 'score',
  Started: 'start',
  Finished: 'finish',
}

/** Which animation a change plays on its game's pin; null for changes that only redraw it. */
export function pinAnimation(change: GameChange): PinAnimation | null {
  return animations[change.kind] ?? null
}
