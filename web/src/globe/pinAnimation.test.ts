import { describe, expect, it } from 'vitest'
import type { Game, GameStatus } from '../games/game'
import { pinAnimation } from './pinAnimation'

function game(status: GameStatus, home: number | null, away: number | null): Game {
  return {
    status,
    home: { score: home },
    away: { score: away },
    clock: null,
    period: null,
  } as Game
}

describe('pinAnimation', () => {
  it('celebrates a score change, for either team', () => {
    expect(pinAnimation(game('Live', 0, 0), game('Live', 7, 0))).toBe('score')
    expect(pinAnimation(game('Live', 0, 0), game('Live', 0, 3))).toBe('score')
  })

  it('announces a game going from Upcoming to Live', () => {
    expect(pinAnimation(game('Upcoming', null, null), game('Live', 0, 0))).toBe('start')
  })

  it('marks a game going from Live to Final with its own, calmer animation', () => {
    expect(pinAnimation(game('Live', 21, 17), game('Final', 24, 17))).toBe('finish')
  })

  it('does not animate a change that only redraws the game', () => {
    const before = game('Live', 7, 3)
    expect(pinAnimation(before, { ...before, clock: '4:12', period: 2, delayed: true })).toBeNull()
  })

  it('does not animate other status changes without a new score', () => {
    expect(pinAnimation(game('Upcoming', null, null), game('Disrupted', null, null))).toBeNull()
    expect(pinAnimation(game('Live', 1, 0), game('Disrupted', 1, 0))).toBeNull()
    expect(pinAnimation(game('Disrupted', 1, 0), game('Live', 1, 0))).toBeNull()
  })
})
