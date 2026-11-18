import { describe, expect, it } from 'vitest'
import type { Game } from '../games/game'
import { firstVisitSettings } from '../settings/viewerSettings'
import { settingsForChoice, settingsForPicks, type TourProgress } from './welcomeTour'
import { nextTourPlay } from './tourPlay'
import { selectedTourGames, showsTourGames, tourCamera, tourCameraForGame, tourGames } from './tourGames'

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
  it.each<TourProgress>(['welcome', 'controls', 'scoreCard', 'allSet'])('shows them through the tour (%s)', (progress) => {
    expect(showsTourGames(progress)).toBe(true)
  })

  it('goes back to real games once the tour is finished, even with a panel opened from Click a score card', () => {
    expect(showsTourGames('finished')).toBe(false)
  })
})

describe('the games shown for a confirmed Welcome choice', () => {
  const leagues = [
    { name: 'NFL', sport: 'Football', conferences: [] },
    { name: 'NHL', sport: 'Hockey', conferences: [] },
    { name: 'NCAA Football', sport: 'Football', conferences: ['ACC', 'SEC'] },
    { name: 'Formula 1', sport: 'Racing', conferences: [] },
  ]
  const games = tourGames(now)

  it('keeps Welcome empty even when a returning viewer already has league settings', () => {
    const settings = settingsForPicks(firstVisitSettings, { leagues: ['NHL'], conferences: {} }, leagues)
    expect(selectedTourGames(false, games, settings, leagues)).toEqual([])
  })

  it('shows the featured examples for Top Events', () => {
    const settings = settingsForChoice(firstVisitSettings, 'topEvents', leagues)
    const ordinaryGame = { ...games[0], id: 'tour-ordinary', topEvent: false }
    const shown = selectedTourGames(true, [...games, ordinaryGame], settings, leagues)

    expect(shown.map(({ id }) => id)).toEqual(games.map(({ id }) => id))
    expect(shown.every(({ status, endTime }) => status === 'Live' && endTime === null)).toBe(true)
  })

  it('keeps the matching examples and supplies one for a picked league or conference without one', () => {
    const settings = settingsForPicks(firstVisitSettings, {
      leagues: ['NHL', 'NCAA Football', 'Formula 1'],
      conferences: { 'NCAA Football': ['ACC', 'SEC'] },
    }, leagues)
    const configuredGames = games.filter((game) => leagues.some((league) => league.name === game.league))
    const shown = selectedTourGames(true, configuredGames, settings, leagues)

    expect(shown.map((game) => game.league)).toEqual(['NHL', 'NCAA Football', 'NCAA Football', 'Formula 1'])
    expect(shown[0].id).toBe('tour-nhl-tor')
    expect(shown[1].contest).toMatchObject({ kind: 'sides', home: { conference: 'ACC' } })
    expect(shown[2].contest).toMatchObject({ kind: 'sides', home: { conference: 'SEC' } })
    expect(shown[3].contest.kind).toBe('field')
  })
})

describe('simulated event progress', () => {
  it('raises the score of just the side that scored and records the play', () => {
    const game = tourGames(now).find(({ id }) => id === 'tour-nfl-pit')!
    expect(nextTourPlay(game, 0)).toMatchObject({
      contest: { home: { score: '16' }, away: { score: '17' } },
    })
  })

  it('brings a distant selected race into view and advances its laps and positions', () => {
    const league = { name: 'Formula 1', sport: 'Racing', conferences: [] }
    const settings = settingsForPicks(firstVisitSettings, { leagues: [league.name], conferences: {} }, [league, { name: 'NFL', sport: 'Football', conferences: [] }])
    const [game] = selectedTourGames(true, [tourGames(now)[0]], settings, [league])
    expect(tourCameraForGame(game, 'wide')).toMatchObject({ longitude: game.venue.longitude })
    const advanced = nextTourPlay(game, 0)
    expect(advanced).toMatchObject({
      clock: 'Lap 43',
      contest: { kind: 'field', entries: [{ name: 'Oscar Piastri', position: 1 }, { name: 'Lando Norris', position: 2 }] },
    })
  })
})
