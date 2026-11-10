import type { GameChangeKind } from './gameChange'

/** The kinds of change the globe can animate (see globe/pinAnimation.ts), most notable first. */
const notable = ['Finished', 'Started', 'ScoreChanged'] as const satisfies readonly GameChangeKind[]

export type NotableChangeKind = (typeof notable)[number]

/** A notable change to a game, numbered in the order changes came. */
export interface NumberedChange {
  number: number
  kind: NotableChangeKind
}

/**
 * A game's notable changes since the last snapshot, as its GameChanges judged them: what the globe
 * animates (see justHappened.ts, which keeps them for each game). A globe remembers the number of the
 * last change it played, so showing the same changes again (a redraw for the viewer's settings) plays
 * nothing.
 *
 * A game keeps only what can still matter: a change drops its earlier ones that are no more notable,
 * so what's left runs from most notable to least, oldest first.
 */
export type GameChanges = readonly NumberedChange[]

/** No changes to a game. */
export const noGameChanges: GameChanges = []

// Counted across every record, and so every connection, so a globe that played the changes of one
// connection doesn't take the next one's, numbered afresh, as already played.
let numbered = 0

const rank = (kind: NotableChangeKind) => notable.indexOf(kind)
const isNotable = (kind: GameChangeKind): kind is NotableChangeKind => (notable as readonly GameChangeKind[]).includes(kind)

/**
 * A game's changes with one more from the server, numbered on from every change before it. A change
 * that isn't notable (a game added, or only updated) leaves them as they were: the same changes.
 */
export function withChange(changes: GameChanges, kind: GameChangeKind): GameChanges {
  if (!isNotable(kind)) return changes
  const kept = changes.filter((earlier) => rank(earlier.kind) < rank(kind))
  return [...kept, { number: ++numbered, kind }]
}

/** The most notable of a game's changes that came after the given number (the last a globe played), or null if none did. */
export function changeAfter(changes: GameChanges, played: number): NotableChangeKind | null {
  return changes.find((change) => change.number > played)?.kind ?? null
}
