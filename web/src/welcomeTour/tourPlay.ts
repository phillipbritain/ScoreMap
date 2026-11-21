import { noneJustHappened, recordJustHappened, type JustHappened } from '../games/justHappened'
import { tourClockLine, type TourClock, type TourGame } from './tourGame'

/**
 * One simulated play on one of the tour's games (all two sides: see tourGames): the home side scores
 * on an even turn and the away side on an odd one, by what a score is worth in its sport, and a clock
 * runs on.
 */
function nextTourPlay(game: TourGame, turn: number): TourGame {
  const { contest, tourPlay } = game
  const scoring = turn % 2 === 0 ? 'home' : 'away'
  const points = game.sport === 'Football' ? 3 : game.sport === 'Basketball' ? 2 + turn % 2 : 1
  const score = tourPlay.scores[scoring] + points
  const clock = nextTourClock(tourPlay.clock)
  return {
    ...game,
    clock: tourClockLine(clock),
    contest: { ...contest, [scoring]: { ...contest[scoring], score: String(score) } },
    tourPlay: { ...tourPlay, clock, scores: { ...tourPlay.scores, [scoring]: score } },
  }
}

function nextTourClock(clock: TourClock): TourClock {
  switch (clock.kind) {
    case 'countdown':
      return { ...clock, seconds: Math.max(1, clock.seconds - 12) }
    case 'minute':
      return { ...clock, minute: Math.min(89, clock.minute + 1) }
    case 'fixed':
      return clock
  }
}

/**
 * The tour's games as played so far: the games, their score animations, how many plays each game has
 * had (for nextTourPlay's turn), how many ticks have gone, and where the round of the others has got to.
 */
export interface TourPlayState {
  games: readonly TourGame[]
  changes: JustHappened
  plays: Readonly<Record<string, number>>
  ticks: number
  next: number
}

export function tourPlayStart(games: readonly TourGame[]): TourPlayState {
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
