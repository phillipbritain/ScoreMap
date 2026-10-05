import { describe, expect, it } from 'vitest'
import type { Game } from './game'
import { progressLine } from './progressLine'

// The server writes the clock line in the sport's style, period included ("Q3 4:12", "Final/OT").
const live: Pick<Game, 'status' | 'delayed' | 'disruption' | 'clock'> = {
  status: 'Live',
  delayed: false,
  disruption: null,
  clock: 'Q3 4:12',
}
const disrupted = { ...live, status: 'Disrupted' as const, clock: null }

describe('progressLine in full, for the game panel', () => {
  it('shows the period and clock of a Live game', () => {
    expect(progressLine(live, 'full')).toBe('Q3 4:12')
  })

  it('shows "Delayed" beside where the game stopped for a delayed game', () => {
    expect(progressLine({ ...live, delayed: true }, 'full')).toBe('Q3 4:12 · Delayed')
    expect(progressLine({ ...live, delayed: true, clock: null }, 'full')).toBe('Delayed')
  })

  it('shows "Live" for a Live game with no clock line', () => {
    expect(progressLine({ ...live, clock: null }, 'full')).toBe('Live')
  })

  it("shows a Final game's own final line, or just Final", () => {
    expect(progressLine({ ...live, status: 'Final', clock: 'Final/OT' }, 'full')).toBe('Final/OT')
    expect(progressLine({ ...live, status: 'Final', clock: null }, 'full')).toBe('Final')
  })

  it('names an Upcoming game as such', () => {
    expect(progressLine({ ...live, status: 'Upcoming', clock: null }, 'full')).toBe('Upcoming')
  })

  it('says whether a Disrupted game was postponed, suspended or canceled', () => {
    expect(progressLine({ ...disrupted, disruption: 'Postponed' }, 'full')).toBe('Postponed')
    expect(progressLine({ ...disrupted, disruption: 'Suspended' }, 'full')).toBe('Suspended')
    expect(progressLine({ ...disrupted, disruption: 'Canceled' }, 'full')).toBe('Canceled')
  })
})

describe('progressLine in short, for pins and score cards', () => {
  it('shows the clock of a Live game', () => {
    expect(progressLine(live, 'short')).toBe('Q3 4:12')
  })

  it('shows "Delayed" in place of the clock for a delayed game', () => {
    expect(progressLine({ ...live, delayed: true }, 'short')).toBe('Delayed')
  })

  it("shows a Final game's own final line, or just Final", () => {
    expect(progressLine({ ...live, status: 'Final', clock: 'AET' }, 'short')).toBe('AET')
    expect(progressLine({ ...live, status: 'Final', clock: null }, 'short')).toBe('Final')
  })

  it('names the kind of disruption', () => {
    expect(progressLine({ ...disrupted, disruption: 'Postponed' }, 'short')).toBe('Postponed')
  })

  it('leaves the status to the pin colour when there is nothing more to say', () => {
    expect(progressLine({ ...live, status: 'Upcoming', clock: null }, 'short')).toBeNull()
    expect(progressLine({ ...live, clock: null }, 'short')).toBeNull()
  })
})
