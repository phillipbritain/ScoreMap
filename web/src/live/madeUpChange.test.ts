import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Game, GameStatus } from '../games/game'
import type { GameChange } from '../games/gameChange'
import { madeUpChange, offerMadeUpChanges } from './madeUpChange'

const now = new Date('2026-08-04T16:00:00Z')

const sides = (id: string, status: GameStatus, home: string | null, away: string | null = '0') =>
  ({ id, status, endTime: null, contest: { kind: 'sides', home: { abbreviation: 'H', score: home }, away: { abbreviation: 'A', score: away } } }) as unknown as Game
const field = (id: string) => ({ id, status: 'Live', endTime: null, contest: { kind: 'field', entries: [] } }) as unknown as Game

const everywhere = () => true

describe('madeUpChange', () => {
  it('scores a point for the home side of the first Live game on screen', () => {
    const games = [sides('upcoming', 'Upcoming', null), sides('off', 'Live', '1'), sides('on', 'Live', '2', '3')]
    const change = madeUpChange(games, 'score', (game) => game.id !== 'off', now)
    expect(change).toEqual({ kind: 'ScoreChanged', game: sides('on', 'Live', '3', '3') })
  })

  it('scores a first point where the home side has none yet', () => {
    expect(madeUpChange([sides('a', 'Live', null, null)], 'score', everywhere, now)?.game).toEqual(sides('a', 'Live', '1', null))
  })

  it('passes over games whose score takes no point: fields, and cricket’s runs and wickets', () => {
    const games = [field('race'), sides('cricket', 'Live', '186/6'), sides('soccer', 'Live', '1')]
    expect(madeUpChange(games, 'score', everywhere, now)?.game.id).toBe('soccer')
    expect(madeUpChange(games.slice(0, 2), 'score', everywhere, now)).toBeNull()
  })

  it('finishes the first Live game on screen, of any kind, from now', () => {
    const games = [sides('final', 'Final', '2'), field('race'), sides('soccer', 'Live', '1')]
    expect(madeUpChange(games, 'finish', everywhere, now)).toEqual({
      kind: 'Finished',
      game: { ...field('race'), status: 'Final', endTime: now.toISOString() },
    })
  })

  it('makes nothing happen with no Live game on screen', () => {
    const games = [sides('a', 'Live', '1'), sides('b', 'Final', '1')]
    expect(madeUpChange(games, 'finish', (game) => game.id === 'b', now)).toBeNull()
    expect(madeUpChange([], 'score', everywhere, now)).toBeNull()
  })
})

describe('offerMadeUpChanges', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lets a script make a change happen to these live games, until withdrawn', () => {
    vi.stubGlobal('window', {})
    const received: GameChange[] = []
    const withdraw = offerMadeUpChanges({ state: { games: [sides('a', 'Live', '1')] }, receive: (change) => received.push(change) })

    expect(window.scoremapGames?.happen('score', everywhere)?.game).toEqual(sides('a', 'Live', '2'))
    expect(window.scoremapGames?.happen('score', () => false)).toBeNull()
    expect(received).toEqual([{ kind: 'ScoreChanged', game: sides('a', 'Live', '2') }])

    withdraw()
    expect(window.scoremapGames).toBeUndefined()
  })
})
