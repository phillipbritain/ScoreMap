import { describe, expect, it } from 'vitest'
import type { Game } from '../games/game'
import { finishedWhileShown, noneCelebrated, withCelebrated, withoutCelebrated } from './celebrated'

const game = (id: string) => ({ id }) as Game

describe('a game finishing while shown', () => {
  it('finished when the same game goes from Live to Final', () => {
    expect(finishedWhileShown({ id: 'a', status: 'Live' }, { id: 'a', status: 'Final' })).toBe(true)
  })

  it('finished when it goes straight from Upcoming to Final, as a game called at once does', () => {
    expect(finishedWhileShown({ id: 'a', status: 'Upcoming' }, { id: 'a', status: 'Final' })).toBe(true)
  })

  it('did not when it was already Final when first shown, as a panel opened after the game ended', () => {
    expect(finishedWhileShown(null, { id: 'a', status: 'Final' })).toBe(false)
    expect(finishedWhileShown({ id: 'a', status: 'Final' }, { id: 'a', status: 'Final' })).toBe(false)
  })

  it('did not when another game, already Final, takes its place', () => {
    expect(finishedWhileShown({ id: 'a', status: 'Live' }, { id: 'b', status: 'Final' })).toBe(false)
  })

  it('did not while it plays on, or once nothing is shown', () => {
    expect(finishedWhileShown({ id: 'a', status: 'Live' }, { id: 'a', status: 'Live' })).toBe(false)
    expect(finishedWhileShown({ id: 'a', status: 'Live' }, null)).toBe(false)
  })
})

describe('celebrated games', () => {
  it('leaves nothing out before any game is celebrated', () => {
    const games = [game('a'), game('b')]
    expect(withoutCelebrated(games, noneCelebrated)).toBe(games)
  })

  it('leaves a celebrated game off the board, whatever the server sends for it meanwhile', () => {
    const celebrated = withCelebrated(noneCelebrated, 'a', [game('a'), game('b')])
    expect(withoutCelebrated([game('a'), game('b')], celebrated).map(({ id }) => id)).toEqual(['b'])
  })

  it('lets go of a celebrated game once the server has dropped it too', () => {
    const first = withCelebrated(noneCelebrated, 'a', [game('a'), game('b')])
    const second = withCelebrated(first, 'b', [game('b')])
    expect([...second]).toEqual(['b'])
  })

  it('keeps a celebrated game the server still sends', () => {
    const first = withCelebrated(noneCelebrated, 'a', [game('a'), game('b')])
    expect([...withCelebrated(first, 'b', [game('a'), game('b')])].sort()).toEqual(['a', 'b'])
  })
})
