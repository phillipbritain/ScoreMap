import { describe, expect, it } from 'vitest'
import type { Game } from '../games/game'
import { noneJustHappened, recordJustHappened } from '../games/justHappened'
import { streamLinks } from '../panel/streamLinks'
import { settingsStore } from '../settings/settingsStore'
import type { TourProgress } from './welcomeTour'
import { readWelcomeTour, startWelcomeTour, welcomeTourAfter } from './welcomeTourLifecycle'

const now = Date.parse('2026-11-16T20:00:00Z')
const noSnapshot = { games: null, justHappened: noneJustHappened, detailsOpen: true }
const read = (tour: ReturnType<typeof startWelcomeTour>, revealed = true) => readWelcomeTour(tour, noSnapshot, revealed)
const welcome = () => startWelcomeTour('welcome', now, 'wide')
const openFeatured = () => {
  const tour = startWelcomeTour('scoreCard', now, 'wide')
  return welcomeTourAfter(tour, { kind: 'gameOpened', gameId: read(tour).gameToTry })
}

describe('welcome tour lifecycle', () => {
  it('loads an empty globe and keeps the rail hidden through Welcome', () => {
    expect(read(welcome(), false)).toMatchObject({ games: [], step: null, railHidden: true })
    expect(read(welcome())).toMatchObject({ games: [], step: 'welcome', railHidden: true })
    expect(read(startWelcomeTour('finished', now, 'wide'))).toMatchObject({ games: null, step: null, railHidden: false, camera: null })
  })

  it.each(['topEvents', 'everything', 'myLeagues'] as const)('shows the same six Live games after choosing %s', (choice) => {
    const tour = welcomeTourAfter(welcome(), { kind: 'chose', choice })
    const { games, step, railHidden, gameToTry } = read(tour)
    expect(step).toBe('controls')
    expect(railHidden).toBe(false)
    expect(games!.map(({ id }) => id)).toEqual([
      'tour-nfl-nyg', 'tour-mlb-nyy', 'tour-nba-bkn', 'tour-nhl-tor', 'tour-mls-chi', 'tour-nfl-pit',
    ])
    for (const game of games!) {
      expect(game.status).toBe('Live')
      expect(Date.parse(game.startTime)).toBeLessThan(now)
      expect(game.endTime).toBeNull()
      if (game.contest.kind !== 'sides') throw new Error('Expected sides')
      expect(game.contest.home.score).not.toBeNull()
      expect(game.contest.away.score).not.toBeNull()
    }
    expect(games!.find(({ id }) => id === gameToTry)).toMatchObject({
      contest: { home: { abbreviation: 'PIT' }, away: { abbreviation: 'BAL' } },
    })
  })

  it('opens the featured game and unlocks its tabs on the Game details step', () => {
    const controls = welcomeTourAfter(welcome(), { kind: 'chose', choice: 'everything' })
    const tour = welcomeTourAfter(controls, { kind: 'next' })
    expect(read(tour).step).toBe('scoreCard')
    expect(read(welcomeTourAfter(tour, { kind: 'gameOpened', gameId: 'tour-nfl-nyg' })).openGameId).toBeNull()
    const { openGameId, games, gameToTry, step, tabsLocked, detailsOpen } = read(openFeatured())
    expect(openGameId).toBe(gameToTry)
    expect(step).toBe('eventPanel')
    expect(tabsLocked).toBe(true)
    expect(detailsOpen).toBe(false)
    const featured = games!.find(({ id }) => id === openGameId)!
    expect(featured.clock).not.toBeNull()
    expect(featured.situation?.downAndDistance).not.toBeNull()
    expect(featured.espnUrl).toBeTruthy()
    expect(streamLinks(featured.streamLinks)).toHaveLength(1)
    expect(read(welcomeTourAfter(openFeatured(), { kind: 'next' }))).toMatchObject({ step: 'panelTabs', tabsLocked: false })
  })

  it('advances when a Game details tab opens during that step and keeps the tab open', () => {
    const opened = openFeatured()
    const detailsTabOpened = { kind: 'detailsTabOpened' } as const
    expect(read(welcomeTourAfter(opened, detailsTabOpened)).step).toBe('eventPanel')
    const atTabs = welcomeTourAfter(opened, { kind: 'next' })
    const expanded = welcomeTourAfter(atTabs, { kind: 'detailsChanged', open: true })
    const watching = welcomeTourAfter(expanded, detailsTabOpened)
    expect(read(watching)).toMatchObject({ step: 'panelWatch', detailsOpen: true, tabsLocked: false })
    expect(read(welcomeTourAfter(watching, detailsTabOpened)).step).toBe('panelWatch')
    expect(read(welcomeTourAfter(watching, { kind: 'detailsChanged', open: false })).detailsOpen).toBe(false)
    expect(read(welcomeTourAfter(atTabs, { kind: 'next' })).step).toBe('panelWatch')
  })

  it('plays each game in turn, favoring the open game while its event panel is open', () => {
    let tour = startWelcomeTour('scoreCard', now, 'wide')
    const before = read(tour)
    const play = () => {
      const games = read(tour).games!
      tour = welcomeTourAfter(tour, { kind: 'play', now: 2_000 })
      return read(tour).games!.find((game, at) => game !== games[at])!
    }
    expect(before.games!.map(({ id }) => id)).toEqual(before.games!.map(() => play().id))

    tour = welcomeTourAfter(tour, { kind: 'gameOpened', gameId: before.gameToTry })
    const open = read(tour).games!.find(({ id }) => id === before.gameToTry)!
    const scored = play()
    expect(scored.id).toBe(open.id)
    expect(scored.contest).not.toEqual(open.contest)
    expect(read(tour).justHappened.has(open.id)).toBe(true)
    expect(play().id).not.toBe(open.id)
    expect(play().id).toBe(open.id)

    tour = welcomeTourAfter(tour, { kind: 'gameClosed' })
    expect(read(tour).openGameId).toBeNull()
    expect(new Set(before.games!.map(() => play().id)).size).toBe(6)
  })

  it.each(['wide', 'phone', 'short'] as const)('restarts with fresh scores, collapsed details and the %s camera target', (screen) => {
    const opened = openFeatured()
    const original = read(opened).games!
    const expanded = welcomeTourAfter(opened, { kind: 'detailsChanged', open: true })
    const played = welcomeTourAfter(expanded, { kind: 'play', now: 2_000 })
    const later = now + 60_000
    const again = welcomeTourAfter(played, { kind: 'again', now: later, screen })
    const restarted = read(again)
    expect(restarted).toMatchObject({
      step: 'welcome', games: [], openGameId: null, detailsOpen: false, tabsLocked: false, railHidden: true,
    })
    expect(restarted.justHappened).toBe(noneJustHappened)

    const camera = restarted.camera!
    const shown = read(welcomeTourAfter(again, { kind: 'chose', choice: 'everything' })).games!
    expect(shown).toEqual(original.map((game) => ({
      ...game, startTime: new Date(Date.parse(game.startTime) + 60_000).toISOString(),
    })))
    for (const { venue: { longitude, latitude } } of shown) {
      expect(Math.abs(longitude! - camera.longitude)).toBeLessThan(10)
      expect(Math.abs(latitude! - camera.latitude)).toBeLessThan(8)
    }
  })

  it('keeps tour venue photos with their games through play and restart', () => {
    const tour = openFeatured()
    const { gameToTry } = read(tour)
    const photo = { url: 'https://photos.test/pittsburgh.jpg', credit: null }
    const photographed = welcomeTourAfter(tour, { kind: 'photosLoaded', photos: new Map([[gameToTry, photo]]) })
    const played = welcomeTourAfter(photographed, { kind: 'play', now: 2_000 })
    const again = welcomeTourAfter(played, { kind: 'again', now, screen: 'wide' })
    for (const stage of [photographed, played, welcomeTourAfter(again, { kind: 'chose', choice: 'everything' })]) {
      expect(read(stage).games?.find(({ id }) => id === gameToTry)?.venue.photo).toEqual(photo)
    }
  })

  it.each<[TourProgress, TourProgress | null]>([
    ['welcome', 'welcome'], ['controls', 'controls'], ['scoreCard', 'scoreCard'],
    ['eventPanel', 'scoreCard'], ['panelTabs', 'scoreCard'], ['panelWatch', 'scoreCard'],
    ['allSet', null], ['finished', null],
  ])('reloads from %s into %s with no game open', (saved, step) => {
    const data = new Map<string, string>()
    const store = settingsStore(() => ({ getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) }))
    store.saveTourProgress(saved)
    const tour = startWelcomeTour(store.loadTourProgress(), now, 'wide')
    expect(read(tour)).toMatchObject({ step, openGameId: null })
    if (step === 'scoreCard') expect(read(tour).games).toHaveLength(6)
  })

  it.each(['done', 'closed'] as const)('hands back the latest running games, changes and details state on %s', (kind) => {
    let tour = openFeatured()
    for (let step = 0; step < 3; step++) tour = welcomeTourAfter(tour, { kind: 'next' })
    expect(read(tour).step).toBe('allSet')
    const runningGame: Game = { ...read(tour).games![0], id: 'running-game' }
    const running = {
      games: [runningGame],
      justHappened: recordJustHappened(noneJustHappened, undefined, { kind: 'Added', game: runningGame }, 3_000),
      detailsOpen: true,
    }
    expect(readWelcomeTour(tour, running, true).games).not.toBe(running.games)
    const finished = readWelcomeTour(welcomeTourAfter(tour, { kind }), running, true)
    expect(finished).toMatchObject({ step: null, camera: null, openGameId: null, detailsOpen: true, tabsLocked: false })
    expect(finished.games).toBe(running.games)
    expect(finished.justHappened).toBe(running.justHappened)
  })
})
