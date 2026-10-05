import { describe, expect, it } from 'vitest'
import type { Game } from '../games/game'
import { gameProgress } from './gameProgress'

// The server writes the clock line in the sport's style, period included ("Q3 4:12", "Final/OT").
const live: Pick<Game, 'status' | 'delayed' | 'disruption' | 'clock'> = {
  status: 'Live',
  delayed: false,
  disruption: null,
  clock: 'Q3 4:12',
}

describe('gameProgress', () => {
  it('shows the period and clock of a Live game', () => {
    expect(gameProgress(live)).toBe('Q3 4:12')
  })

  it('shows "Delayed" beside where the game stopped for a delayed game', () => {
    expect(gameProgress({ ...live, delayed: true })).toBe('Q3 4:12 · Delayed')
    expect(gameProgress({ ...live, delayed: true, clock: null })).toBe('Delayed')
  })

  it('shows "Live" for a Live game with no clock line', () => {
    expect(gameProgress({ ...live, clock: null })).toBe('Live')
  })

  it("shows a Final game's own final line", () => {
    expect(gameProgress({ ...live, status: 'Final', clock: 'Final/OT' })).toBe('Final/OT')
    expect(gameProgress({ ...live, status: 'Final', clock: null })).toBe('Final')
  })

  it('names an Upcoming game as such', () => {
    expect(gameProgress({ ...live, status: 'Upcoming', clock: null })).toBe('Upcoming')
  })

  it('says whether a Disrupted game was postponed, suspended or canceled', () => {
    const disrupted = { ...live, status: 'Disrupted' as const, clock: null }

    expect(gameProgress({ ...disrupted, disruption: 'Postponed' })).toBe('Postponed')
    expect(gameProgress({ ...disrupted, disruption: 'Suspended' })).toBe('Suspended')
    expect(gameProgress({ ...disrupted, disruption: 'Canceled' })).toBe('Canceled')
  })
})
