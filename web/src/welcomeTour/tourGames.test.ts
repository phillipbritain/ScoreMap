import { describe, expect, it } from 'vitest'
import type { Game } from '../games/game'
import type { TourProgress } from './welcomeTour'
import { nextTourPlay, tourPlayStart, tourPlayTick } from './tourPlay'
import { showsTourGames, shownTourGames, tourCamera, tourGameToTry, tourGames } from './tourGames'

const now = Date.parse('2026-11-16T20:00:00Z')
const minutes = (iso: string | null) => (Date.parse(iso!) - now) / 60_000

/** A game less its times, which follow when the tour starts. */
const untimed = (game: Game) => ({ ...game, startTime: null, endTime: null })

describe("the welcome tour's games", () => {
  it('are the same six games every time the tour runs, whenever that is', () => {
    const first = tourGames(now)
    const later = tourGames(now + 3 * 24 * 60 * 60_000)

    expect(first).toHaveLength(6)
    expect(later.map(untimed)).toEqual(first.map(untimed))
    expect(new Set(first.map((game) => game.id)).size).toBe(6)
  })

  it('show every status, and more than one sport', () => {
    const games = tourGames(now)

    expect(new Set(games.map((game) => game.status))).toEqual(new Set(['Live', 'Upcoming', 'Final']))
    expect(new Set(games.map((game) => game.sport)).size).toBeGreaterThanOrEqual(5)
  })

  it('are timed from the tour: Live games under way, Upcoming ones soon, the Final one just over', () => {
    for (const game of tourGames(now)) {
      if (game.status === 'Live') expect(minutes(game.startTime)).toBeLessThan(0)
      if (game.status === 'Upcoming') expect(minutes(game.startTime)).toBeGreaterThan(0)
      if (game.status === 'Upcoming') expect(minutes(game.startTime)).toBeLessThanOrEqual(30)
      if (game.status === 'Final') expect(minutes(game.endTime)).toBeLessThan(0)
      if (game.status !== 'Final') expect(game.endTime).toBeNull()
    }
  })

  it('give scores to games under way or over, and none to games still to start', () => {
    for (const game of tourGames(now)) {
      if (game.contest.kind !== 'sides') throw new Error('Expected sides')
      const scores = [game.contest.home.score, game.contest.away.score]
      if (game.status === 'Upcoming') expect(scores).toEqual([null, null])
      else expect(scores.every((score) => score !== null)).toBe(true)
    }
  })

  it('make the game Click a score card points at (Ravens v Steelers) Live, with all a game under way shows', () => {
    const game = tourGames(now).find((tourGame) => tourGame.id === 'tour-nfl-pit')!
    if (game.contest.kind !== 'sides') throw new Error('Expected sides')

    expect(game.status).toBe('Live')
    expect(game.clock).not.toBeNull()
    expect([game.contest.away.record, game.contest.home.record].every((record) => record !== null)).toBe(true)
    expect(game.situation?.downAndDistance).not.toBeNull()
  })

  it('sit in a fixed place, around the camera the tour opens on', () => {
    for (const screen of ['wide', 'phone', 'short'] as const) {
      const camera = tourCamera(screen)
      for (const { venue } of tourGames(now)) {
        expect(Math.abs(venue.longitude! - camera.longitude)).toBeLessThan(10)
        expect(Math.abs(venue.latitude! - camera.latitude)).toBeLessThan(8)
      }
    }
  })
})

describe('when the globe shows the tour games', () => {
  it.each<TourProgress>(['welcome', 'controls', 'scoreCard', 'gamePanel', 'allSet'])('shows them through the tour (%s)', (progress) => {
    expect(showsTourGames(progress)).toBe(true)
  })

  it('goes back to real games once the tour is finished, even with a panel opened from Click a score card', () => {
    expect(showsTourGames('finished')).toBe(false)
  })
})

describe('the games shown for a Welcome choice', () => {
  const games = tourGames(now)

  it('keeps Welcome empty, so the globe starts with no cards', () => {
    expect(shownTourGames(false, games)).toEqual([])
  })

  it('shows the same six, all Live, whatever the choice, with Ravens v Steelers to try', () => {
    const shown = shownTourGames(true, games)
    expect(shown.map(({ id }) => id)).toEqual(games.map(({ id }) => id))
    expect(shown.every(({ status, endTime }) => status === 'Live' && endTime === null)).toBe(true)
    expect(shown.map(({ id }) => id)).toContain(tourGameToTry)
  })
})

describe('simulated event progress', () => {
  it('raises the score of just the side that scored and records the play', () => {
    const game = tourGames(now).find(({ id }) => id === 'tour-nfl-pit')!
    expect(nextTourPlay(game, 0)).toMatchObject({
      contest: { home: { score: '16' }, away: { score: '17' } },
    })
  })
})

describe('tour play ticks', () => {
  const live = () => tourGames(now).filter(({ status, contest }) => status === 'Live' && contest.kind === 'sides').slice(0, 3)
  const run = (games: readonly Game[], open: string | null, ticks: number) => {
    const played: string[] = []
    let state = tourPlayStart(games)
    for (let tick = 0; tick < ticks; tick++) {
      const before = state.games
      state = tourPlayTick(state, open, tick)
      played.push(state.games.find((game, at) => game !== before[at])!.id)
    }
    return { played, state }
  }

  it('gives each game a play in turn with no panel open', () => {
    const games = live()
    expect(run(games, null, 6).played).toEqual([...games, ...games].map(({ id }) => id))
  })

  it("gives the open game every other play, so its panel and card change as the viewer watches, the rest still taking turns", () => {
    const games = live()
    const open = games[1].id
    expect(run(games, open, 6).played).toEqual([open, games[0].id, open, games[2].id, open, games[0].id])
  })

  it('changes the open game score and records it for its card', () => {
    const games = live()
    const { state } = run(games, games[0].id, 1)
    expect(state.games[0].contest).not.toEqual(games[0].contest)
    expect(state.changes.has(games[0].id)).toBe(true)
  })

  it('takes turns as before once the open game is closed', () => {
    const games = live()
    expect(run(games, 'tour-not-on-the-globe', 3).played).toEqual(games.map(({ id }) => id))
  })
})
