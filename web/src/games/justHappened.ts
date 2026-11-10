import type { Game } from './game'
import type { GameChange } from './gameChange'
import { changeAfter, noGameChanges, withChange, type GameChanges, type NotableChangeKind } from './recentChanges'
import { scoringSide, type Scorer } from './scorers'

/** What just happened to one game: its notable changes (see recentChanges.ts) and the side that last scored (see scorers.ts). */
interface GameJustHappened {
  changes: GameChanges
  scorer?: Scorer
}

/**
 * What just happened to each game since the last snapshot, by game id: the notable changes the globe
 * pulses, and the side that last scored, which the score card and the game panel light up for a
 * moment. A snapshot brings none: what changed while ScoreMap was away didn't just happen.
 */
export type JustHappened = ReadonlyMap<string, GameJustHappened>

/** Nothing just happened: what a snapshot brings, so it pulses and lights up nothing. */
export const noneJustHappened: JustHappened = new Map()

/**
 * This record with one more change from the server, given the game as it was before the change: a
 * notable change joins the game's changes, and a side that scored becomes its scorer, from now,
 * whatever kind the change was. A game removed is cleared. A change with nothing in it to keep
 * leaves the record as it was: the same record.
 */
export function recordJustHappened(record: JustHappened, before: Game | undefined, { kind, game }: GameChange, now: number): JustHappened {
  if (kind === 'Removed') {
    if (!record.has(game.id)) return record
    const left = new Map(record)
    left.delete(game.id)
    return left
  }
  const was = record.get(game.id)
  const earlier = was?.changes ?? noGameChanges
  const changes = withChange(earlier, kind)
  const side = before && scoringSide(before, game)
  if (changes === earlier && !side) return record
  return new Map(record).set(game.id, { changes, scorer: side ? { side, at: now } : was?.scorer })
}

/**
 * The most notable change to a game that came after the given number (the last a globe played), or
 * null if none did.
 */
export function changeSince(record: JustHappened, gameId: string, played: number): NotableChangeKind | null {
  const changes = record.get(gameId)?.changes
  return changes ? changeAfter(changes, played) : null
}

/** The number of the latest change recorded; 0 with none. */
export function lastNumber(record: JustHappened): number {
  let last = 0
  for (const { changes } of record.values()) last = Math.max(last, changes.at(-1)?.number ?? 0)
  return last
}

/** The side that last scored in a game, and when; none since the last snapshot. */
export function scorerOf(record: JustHappened, gameId: string): Scorer | undefined {
  return record.get(gameId)?.scorer
}
