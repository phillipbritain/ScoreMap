import type { Game } from '../games/game'
import type { GameChange } from '../games/gameChange'

/** What a dev run can make happen on demand (see madeUpChange): a score, or a game finishing. */
export type MadeUpEvent = 'score' | 'finish'

/**
 * A change the server didn't send, for a dev run to check an effect on demand (`npm run page -- score`):
 * the first Live game `onScreen` picks scores (its home side gains a point; a two-sided game with numeric
 * scores), or finishes (Final from `now`). Null when no game on screen can. It is the tab's alone, and
 * lasts until the server's next change to that game.
 */
export function madeUpChange(games: readonly Game[], event: MadeUpEvent, onScreen: (game: Game) => boolean, now: Date): GameChange | null {
  const candidates = games.filter((game) => game.status === 'Live' && onScreen(game))
  if (event === 'finish') {
    const game = candidates[0]
    return game ? { kind: 'Finished', game: { ...game, status: 'Final', endTime: now.toISOString() } } : null
  }
  for (const game of candidates) {
    const { contest } = game
    if (contest.kind !== 'sides' || !numeric(contest.home.score) || !numeric(contest.away.score)) continue
    const home = { ...contest.home, score: String(Number(contest.home.score ?? 0) + 1) }
    return { kind: 'ScoreChanged', game: { ...game, contest: { ...contest, home } } }
  }
  return null
}

/** A score a point can be added to: none yet, or a whole number (not cricket's "186/6"). */
const numeric = (score: string | null) => score === null || /^\d+$/.test(score)

/** What a script driving a dev run's page can make happen in it (see `npm run page -- score`). */
export interface MadeUpChanges {
  /** Makes the event happen to a game on screen, this tab only; returns the change made, or null when no game on screen can. */
  happen: (event: MadeUpEvent, onScreen: (game: Game) => boolean) => GameChange | null
}

declare global {
  interface Window {
    scoremapGames?: MadeUpChanges
  }
}

/** Puts `happen` on `window.scoremapGames` in dev runs, feeding its changes to these live games; returns what takes it off. */
export function offerMadeUpChanges(live: { readonly state: { games: Game[] | null }; receive: (change: GameChange) => void }): () => void {
  if (!import.meta.env.DEV) return () => {}
  window.scoremapGames = {
    happen: (event, onScreen) => {
      const change = madeUpChange(live.state.games ?? [], event, onScreen, new Date())
      if (change) live.receive(change)
      return change
    },
  }
  return () => delete window.scoremapGames
}
