import { describe, expect, it } from 'vitest'
import type { Game } from '../games/game'
import type { TourProgress } from './welcomeTour'
import { showsTourGames, tourCamera, tourGames } from './tourGames'

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

  it('sit in a fixed place, around the camera the tour opens on', () => {
    for (const phone of [false, true]) {
      const camera = tourCamera(phone)
      for (const { venue } of tourGames(now)) {
        expect(Math.abs(venue.longitude! - camera.longitude)).toBeLessThan(10)
        expect(Math.abs(venue.latitude! - camera.latitude)).toBeLessThan(8)
      }
    }
  })
})

describe('when the globe shows the tour games', () => {
  it.each<TourProgress>(['welcome', 'controls', 'scoreCard'])('shows them through the tour (%s)', (progress) => {
    expect(showsTourGames(progress, null)).toBe(true)
  })

  it('goes back to real games once the tour is finished', () => {
    expect(showsTourGames('finished', null)).toBe(false)
  })

  it('keeps them while a panel opened from Click a score card stays open', () => {
    expect(showsTourGames('finished', 'tour-nfl-nyg')).toBe(true)
  })
})
