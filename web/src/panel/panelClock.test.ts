import { describe, expect, it } from 'vitest'
import { panelClock } from './panelClock'

const live = (clock: string | null, delayed = false) =>
  panelClock({ status: 'Live', delayed, clock, startTime: '2026-11-21T18:00:00Z' })

describe('panelClock', () => {
  it('puts a running clock under its period in words', () => {
    expect(live('Q4 8:30')).toEqual({ label: '4th Quarter', main: '8:30', live: true })
    expect(live('P2 14:22')).toEqual({ label: '2nd Period', main: '14:22', live: true })
    expect(live('H1 12:05')).toEqual({ label: '1st Half', main: '12:05', live: true })
    expect(live('OT 3:10')).toEqual({ label: 'Overtime', main: '3:10', live: true })
    expect(live('Q1 10:00').label).toBe('1st Quarter')
    expect(live('Q3 0:42').label).toBe('3rd Quarter')
  })

  it('keeps a period it has no words for as the feed gives it', () => {
    expect(live('2OT 1:15')).toEqual({ label: '2OT', main: '1:15', live: true })
  })

  it('shows a period with no running clock as the big line, under Live', () => {
    expect(live('Bot 4th')).toEqual({ label: 'Live', main: 'Bot 4th', live: true })
    expect(live('Halftime')).toEqual({ label: 'Live', main: 'Halftime', live: true })
    expect(live("65'")).toEqual({ label: 'Live', main: "65'", live: true })
    expect(live(null)).toEqual({ label: 'Live', main: 'Live', live: true })
  })

  it('says a delayed game is delayed, its dot out', () => {
    expect(live('Q3 4:12', true)).toEqual({ label: '3rd Quarter · Delayed', main: '4:12', live: false })
    expect(live('Top 7th', true)).toEqual({ label: 'Delayed', main: 'Top 7th', live: false })
  })

  it('shows how a Final game ended, alone', () => {
    expect(panelClock({ status: 'Final', delayed: false, clock: 'Final/OT', startTime: '2026-11-21T18:00:00Z' }))
      .toEqual({ label: null, main: 'Final/OT', live: false })
    expect(panelClock({ status: 'Final', delayed: false, clock: null, startTime: '2026-11-21T18:00:00Z' }).main).toBe('Final')
  })

  it('shows an Upcoming game its start time, under Starts', () => {
    const clock = panelClock({ status: 'Upcoming', delayed: false, clock: null, startTime: '2026-11-21T18:00:00Z' })
    expect(clock.label).toBe('Starts')
    expect(clock.main).toMatch(/\d{1,2}:00/)
    expect(clock.live).toBe(false)
  })
})
