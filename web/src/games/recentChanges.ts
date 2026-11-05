import type { GameChange, GameChangeKind } from './gameChange'

/** The kinds of change the globe can animate (see globe/pinAnimation.ts), most notable first. */
const notable = ['Finished', 'Started', 'ScoreChanged'] as const satisfies readonly GameChangeKind[]

export type NotableChangeKind = (typeof notable)[number]

/** A notable change to a game, numbered in the order changes came. */
export interface NumberedChange {
  number: number
  kind: NotableChangeKind
}

/**
 * The notable changes the server has sent for each game since the last snapshot, as its GameChanges
 * judged them: what the globe animates. A globe remembers the number of the last change it played,
 * so showing the same changes again (a redraw for the viewer's settings) plays nothing.
 *
 * Each game keeps only what can still matter: a change drops the game's earlier ones that are no more
 * notable, so what's left runs from most notable to least, oldest first.
 */
export type RecentChanges = ReadonlyMap<string, readonly NumberedChange[]>

/** No changes: what a snapshot brings, so it animates nothing. */
export const noRecentChanges: RecentChanges = new Map()

// Counted across every record, and so every connection, so a globe that played the changes of one
// connection doesn't take the next one's, numbered afresh, as already played.
let numbered = 0

const rank = (kind: NotableChangeKind) => notable.indexOf(kind)
const isNotable = (kind: GameChangeKind): kind is NotableChangeKind => (notable as readonly GameChangeKind[]).includes(kind)

/** These changes with one more from the server. A game added, or only updated, has no notable change. */
export function recordChange(recent: RecentChanges, { kind, game }: GameChange): RecentChanges {
  if (kind === 'Removed') {
    if (!recent.has(game.id)) return recent
    const left = new Map(recent)
    left.delete(game.id)
    return left
  }
  if (!isNotable(kind)) return recent
  const kept = (recent.get(game.id) ?? []).filter((earlier) => rank(earlier.kind) < rank(kind))
  return new Map(recent).set(game.id, [...kept, { number: ++numbered, kind }])
}

/**
 * The most notable change to a game that came after the given number (the last a globe played), or
 * null if none did.
 */
export function changeSince(recent: RecentChanges, gameId: string, played: number): NotableChangeKind | null {
  return recent.get(gameId)?.find((change) => change.number > played)?.kind ?? null
}

/** The number of the latest of these changes; 0 with none. */
export function lastNumber(recent: RecentChanges): number {
  let last = 0
  for (const changes of recent.values()) last = Math.max(last, changes.at(-1)?.number ?? 0)
  return last
}
