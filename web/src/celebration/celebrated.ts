import type { Game, GameStatus } from '../games/game'

/** A game as last seen, to tell whether it has just finished. */
export interface SeenGame {
  id: string
  status: GameStatus
}

/**
 * Whether the game finished while it was shown: the same game seen before not Final, and Final now.
 * A game first seen already Final (its panel opened after it ended) didn't.
 */
export function finishedWhileShown(before: SeenGame | null, game: SeenGame | null): boolean {
  return !!before && !!game && before.id === game.id && before.status !== 'Final' && game.status === 'Final'
}

/**
 * The games whose celebration has run its course in the event panel, by id: the panel closed itself after
 * it, and the game left the globe with it, in this browser, before the server drops it (a few minutes
 * after it ends, ADR-0021). They stay off the globe until the server drops them too.
 */
export type Celebrated = ReadonlySet<string>

export const noneCelebrated: Celebrated = new Set()

/** The games without those celebrated: what the globe, the Games list and the event panel go on. */
export function withoutCelebrated(games: readonly Game[], celebrated: Celebrated): readonly Game[] {
  return celebrated.size ? games.filter((game) => !celebrated.has(game.id)) : games
}

/**
 * The celebrated games with one more; those the server has since dropped (no longer among `games`) are
 * let go, so the record keeps only what still needs leaving out.
 */
export function withCelebrated(celebrated: Celebrated, gameId: string, games: readonly Game[]): Celebrated {
  const onBoard = new Set(games.map((game) => game.id))
  return new Set([...celebrated].filter((id) => onBoard.has(id))).add(gameId)
}
