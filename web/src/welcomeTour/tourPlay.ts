import { useEffect, useState, type RefObject } from 'react'
import type { Game, GameTeam } from '../games/game'
import { noneJustHappened, recordJustHappened, type JustHappened } from '../games/justHappened'

/** How often one of the tour's games has a play: the open game every other time, so every 4 seconds. */
const playIntervalMs = 2000

/**
 * One simulated play on one of the tour's games (all two sides: see tourGames): the home side scores
 * on an even turn and the away side on an odd one, by what a score is worth in its sport, and a clock
 * runs on.
 */
export function nextTourPlay(game: Game, turn: number): Game {
  const { contest } = game
  if (game.status !== 'Live' || contest.kind !== 'sides') return game
  const scoring = turn % 2 === 0 ? 'home' : 'away'
  return {
    ...game,
    clock: nextTeamClock(game.clock),
    contest: { ...contest, [scoring]: scoreTeam(contest[scoring], game.sport, turn) },
  }
}

function nextTeamClock(clock: string | null): string | null {
  const countdown = clock?.match(/^(.* )(\d+):(\d{2})$/)
  if (countdown) {
    const [, period, minutes, seconds] = countdown
    const remaining = Math.max(1, Number(minutes) * 60 + Number(seconds) - 12)
    return `${period}${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
  }
  const minute = clock?.match(/^(\d+)'$/)
  return minute ? `${Math.min(89, Number(minute[1]) + 1)}'` : clock
}

function scoreTeam(team: GameTeam, sport: string, turn: number): GameTeam {
  const points = sport === 'Football' ? 3 : sport === 'Basketball' ? 2 + turn % 2 : 1
  return { ...team, score: String(Number(team.score ?? '0') + points) }
}

/**
 * The tour's games as played so far: the games, their score animations, how many plays each game has
 * had (for nextTourPlay's turn), how many ticks have gone, and where the round of the others has got to.
 */
export interface TourPlayState {
  games: readonly Game[]
  changes: JustHappened
  plays: Readonly<Record<string, number>>
  ticks: number
  next: number
}

export function tourPlayStart(games: readonly Game[]): TourPlayState {
  return { games, changes: noneJustHappened, plays: {}, ticks: 0, next: 0 }
}

/**
 * One tick of the tour's play: one game has a play. The game whose panel is open (`openGameId`) has
 * every other one, so the viewer sees its panel and card change as they watch; the rest take turns.
 */
export function tourPlayTick(state: TourPlayState, openGameId: string | null, now: number): TourPlayState {
  const { games } = state
  if (games.length === 0) return state
  const open = games.findIndex((game) => game.id === openGameId && game.status === 'Live')
  let index: number
  let next = state.next
  if (open >= 0 && (state.ticks % 2 === 0 || games.length === 1)) {
    index = open
  } else {
    index = next % games.length
    if (index === open) index = (index + 1) % games.length
    next = index + 1
  }
  const old = games[index]
  const turn = state.plays[old.id] ?? 0
  const game = nextTourPlay(old, turn)
  return {
    games: games.map((other, at) => (at === index ? game : other)),
    changes: recordJustHappened(state.changes, old, { kind: 'ScoreChanged', game }, now),
    plays: { ...state.plays, [old.id]: turn + 1 },
    ticks: state.ticks + 1,
    next,
  }
}

/**
 * Plays one local event at a time and passes it through the app's existing score animation record.
 * `openGameId` is read at each tick: the game whose panel is open then, if any.
 */
export function useTourPlay(
  source: readonly Game[],
  active: boolean,
  openGameId: RefObject<string | null>,
): Pick<TourPlayState, 'games' | 'changes'> {
  const [played, setPlayed] = useState<{ source: readonly Game[]; state: TourPlayState } | null>(null)
  useEffect(() => {
    if (!active || source.length === 0) return
    const timer = window.setInterval(() => {
      const now = performance.now()
      const open = openGameId.current
      setPlayed((before) => {
        const current = before?.source === source ? before.state : tourPlayStart(source)
        return { source, state: tourPlayTick(current, open, now) }
      })
    }, playIntervalMs)
    return () => {
      window.clearInterval(timer)
    }
  }, [source, active, openGameId])
  return active && played?.source === source ? played.state : { games: source, changes: noneJustHappened }
}
