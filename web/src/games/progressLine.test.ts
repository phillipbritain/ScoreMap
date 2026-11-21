import { describe, expect, it } from 'vitest'
import type { Game } from './game'
import { progressLine } from './progressLine'

// The server writes the clock line in the sport's style, period included ("Q3 4:12", "Final/OT").
const live: Pick<Game, 'status' | 'delayed' | 'clock' | 'startTime'> = {
  status: 'Live',
  delayed: false,
  clock: 'Q3 4:12',
  startTime: '2026-10-04T17:00:00+00:00',
}

// A viewer in New York, for start times.
const eastern = { timeZone: 'America/New_York', locale: 'en-US' }

describe('progressLine in full, for the event panel', () => {
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

  it("shows an Upcoming game's start time in the viewer's time", () => {
    expect(progressLine({ ...live, status: 'Upcoming', clock: null }, 'full', eastern)).toBe('1:00 PM')
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

  it("shows an Upcoming game's start time in the viewer's time", () => {
    expect(progressLine({ ...live, status: 'Upcoming', clock: null }, 'short', eastern)).toBe('1:00 PM')
  })

  it('leaves the status to the pin color when there is nothing more to say', () => {
    expect(progressLine({ ...live, clock: null }, 'short')).toBeNull()
  })
})
