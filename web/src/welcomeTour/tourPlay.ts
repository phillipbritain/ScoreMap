import { useEffect, useState } from 'react'
import type { Game, GameTeam } from '../games/game'
import { noneJustHappened, recordJustHappened, type JustHappened } from '../games/justHappened'
import { sidesTopFirst } from '../games/sides'

const playIntervalMs = 3500

/** One simulated play, using what changes on a real card for that kind of contest. */
export function nextTourPlay(game: Game, turn: number): Game {
  if (game.status !== 'Live') return game
  const { contest } = game
  if (contest.kind === 'field') {
    if (game.sport === 'Racing') {
      const lap = Number(game.clock?.match(/\d+/)?.[0] ?? 42)
      const entries = turn % 2
        ? contest.entries
        : [...contest.entries].reverse().map((entry, index) => ({ ...entry, position: index + 1 }))
      return { ...game, clock: `Lap ${lap + 1}`, contest: { kind: 'field', entries } }
    }
    const entries = contest.entries.map((entry, index) =>
      index === turn % contest.entries.length ? { ...entry, score: golfScore(toPar(entry.score) - 1) } : entry,
    ).sort((a, b) => toPar(a.score) - toPar(b.score))
    const ranked = entries.map((entry) => ({
      ...entry, position: entries.findIndex(({ score }) => score === entry.score) + 1,
    }))
    return { ...game, contest: { kind: 'field', entries: ranked } }
  }
  if (contest.kind === 'bouts') {
    if (contest.bouts.length === 0) return game
    const bouts = contest.bouts.map((bout) => {
      const [minutes, seconds] = (bout.clock ?? '2:30').split(':').map(Number)
      const remaining = minutes * 60 + seconds - 8
      const round = bout.round ?? 1
      const advances = remaining <= 0 && round < bout.scheduledRounds
      const next = advances ? 300 + remaining : Math.max(1, remaining)
      return { ...bout, round: round + Number(advances), clock: `${Math.floor(next / 60)}:${String(next % 60).padStart(2, '0')}` }
    })
    return { ...game, clock: `R${bouts[0].round} ${bouts[0].clock}`, contest: { kind: 'bouts', bouts } }
  }

  const scoring = game.sport === 'Cricket' || turn % 2 === 0 ? 'home' : 'away'
  const team = contest[scoring]
  if (game.sport === 'Tennis') {
    const scoredTop = sidesTopFirst(game.sport, contest)[0] === team
    const score = scoredTop ? '1-0' : '0-1'
    const sets = game.scoreline?.sets ?? []
    const current = sets.at(-1)
    if (!current || current.winner) {
      return { ...game, clock: `Set ${sets.length + 1} · ${score}`, scoreline: { sets: [...sets, { name: setName(sets.length), score, winner: null }], ending: null, advanced: null } }
    }
    const [top, bottom] = current.score.split('-').map(Number)
    const nextTop = top + Number(scoredTop)
    const nextBottom = bottom + Number(!scoredTop)
    const won = Math.max(nextTop, nextBottom) >= 6 && Math.abs(nextTop - nextBottom) >= 2
      || Math.max(nextTop, nextBottom) === 7
    const updated = { ...current, score: won ? `${Math.max(nextTop, nextBottom)}-${Math.min(nextTop, nextBottom)}` : `${nextTop}-${nextBottom}`, winner: won ? team.abbreviation : null }
    return {
      ...game,
      clock: `Set ${sets.length} · ${updated.score}`,
      contest: won ? { ...contest, [scoring]: { ...team, score: String(Number(team.score) + 1) } } : contest,
      scoreline: { sets: [...sets.slice(0, -1), updated], ending: null, advanced: null },
    }
  }

  const [next, text] = scoreTeam(team, game.sport, turn)
  const clock = nextTeamClock(game.clock)
  return {
    ...game,
    clock,
    contest: { ...contest, [scoring]: next },
    lastScore: game.sport === 'Cricket' ? null : { team: team.abbreviation, text, when: clock },
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

function setName(index: number): string {
  return ['1st', '2nd', '3rd', '4th', '5th'][index] ?? String(index + 1)
}

function golfScore(score: number): string {
  return score === 0 ? 'E' : score > 0 ? `+${score}` : String(score)
}

function toPar(score: string | null): number {
  return score === 'E' ? 0 : Number(score)
}

function scoreTeam(team: GameTeam, sport: string, turn: number): [GameTeam, string] {
  if (sport === 'Cricket') {
    const [runs, wickets = '2'] = (team.score ?? '0').split('/')
    return [{ ...team, score: `${Number(runs) + (turn % 3 === 0 ? 4 : 1)}/${wickets}` }, 'Runs scored']
  }
  const points = sport === 'Football' ? 3 : sport === 'Basketball' ? 2 + turn % 2 : sport === 'Rugby' ? 5 : 1
  const action = sport === 'Football' ? 'Field goal' : sport === 'Basketball' ? 'Basket' : sport === 'Rugby' ? 'Try' : sport === 'Baseball' ? 'Run scored' : 'Goal'
  return [{ ...team, score: String(Number(team.score ?? '0') + points) }, action]
}

interface TourPlay {
  source: readonly Game[]
  games: readonly Game[]
  changes: JustHappened
  turns: number
}

/** Plays one local event at a time and passes it through the app's existing score animation record. */
export function useTourPlay(source: readonly Game[], active: boolean): Pick<TourPlay, 'games' | 'changes'> {
  const [played, setPlayed] = useState<TourPlay | null>(null)
  useEffect(() => {
    if (!active || source.length === 0) return
    const timer = window.setInterval(() => {
      const now = performance.now()
      setPlayed((before) => {
        const current = before?.source === source ? before : { source, games: source, changes: noneJustHappened, turns: 0 }
        const index = current.turns % current.games.length
        const old = current.games[index]
        const game = nextTourPlay(old, Math.floor(current.turns / current.games.length))
        return {
          ...current,
          games: current.games.map((other, at) => at === index ? game : other),
          changes: recordJustHappened(current.changes, old, { kind: game.sport === 'MMA' || game.sport === 'Racing' ? 'Updated' : 'ScoreChanged', game }, now),
          turns: current.turns + 1,
        }
      })
    }, playIntervalMs)
    return () => {
      window.clearInterval(timer)
    }
  }, [source, active])
  return active && played?.source === source ? played : { games: source, changes: noneJustHappened }
}
