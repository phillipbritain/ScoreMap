import type { Game } from '../games/game'
import type { NotableChangeKind } from '../games/recentChanges'

/**
 * How a pin (or the cluster it's in) draws attention to a change: the same pulse when the score
 * changes or a game starts, and none when it finishes. On a score card a score's new score lights up
 * too. The styles live in CSS.
 */
export type PinAnimation = 'score' | 'start'

/**
 * Which animation a game plays for a change the server pushed, as its GameChanges judged it (a field's
 * score changes when the lead changes hands, a fight card's when a bout finishes); null for none, as
 * for a game finishing.
 * Basketball scores so often that its score changes pulse only in clutch time, as the server judges
 * it on the score after the basket: the game as it is now.
 */
export function pinAnimation(kind: NotableChangeKind, game: Game): PinAnimation | null {
  switch (kind) {
    case 'Started':
      return 'start'
    case 'Finished':
      return null
    case 'ScoreChanged':
      return game.sport !== 'Basketball' || game.clutchTime ? 'score' : null
  }
}
