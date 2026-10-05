import { describe, expect, it } from 'vitest'
import type { Game } from '../games/game'
import { gameProgress } from './gameProgress'

const live: Pick<Game, 'status' | 'delayed' | 'clock' | 'period'> = {
  status: 'Live',
  delayed: false,
  clock: '4:12',
  period: 3,
}

describe('gameProgress', () => {
  it('shows the period and clock of a Live game', () => {
    expect(gameProgress(live)).toBe('Period 3 · 4:12')
  })

  it('shows "Delayed" in place of the clock for a delayed game', () => {
    expect(gameProgress({ ...live, delayed: true })).toBe('Period 3 · Delayed')
  })

  it('shows what it has when the period or clock is missing', () => {
    expect(gameProgress({ ...live, period: null })).toBe('4:12')
    expect(gameProgress({ ...live, clock: null })).toBe('Period 3')
  })

  it('names the status of a game that is not Live', () => {
    expect(gameProgress({ ...live, status: 'Final' })).toBe('Final')
    expect(gameProgress({ ...live, status: 'Upcoming', clock: null, period: null })).toBe('Upcoming')
  })
})
