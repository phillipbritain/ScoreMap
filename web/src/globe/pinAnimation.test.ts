import { describe, expect, it } from 'vitest'
import type { Game, GameStatus } from '../games/game'
import { pinAnimation } from './pinAnimation'

function game(status: GameStatus, home: number | null, away: number | null): Game {
  return {
    sport: 'Football',
    status,
    clutchTime: false,
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

  it('celebrates a basketball score change only in clutch time', () => {
    const basketball = (home: number, away: number, clutchTime: boolean): Game => ({
      ...game('Live', home, away),
      sport: 'Basketball',
      clutchTime,
    })
    expect(pinAnimation(basketball(96, 100, false), basketball(98, 100, true))).toBe('score')
    expect(pinAnimation(basketball(60, 58, false), basketball(62, 58, false))).toBeNull()
    // Judged on the score after the basket: stretching a 5-point lead to 7 leaves clutch time.
    expect(pinAnimation(basketball(100, 95, true), basketball(102, 95, false))).toBeNull()
  })

  it('keeps basketball starting and finishing animated outside clutch time', () => {
    const basketball = (status: GameStatus, home: number | null, away: number | null): Game => ({
      ...game(status, home, away),
      sport: 'Basketball',
    })
    expect(pinAnimation(basketball('Upcoming', null, null), basketball('Live', 0, 0))).toBe('start')
    expect(pinAnimation(basketball('Live', 110, 90), basketball('Final', 112, 90))).toBe('finish')
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
