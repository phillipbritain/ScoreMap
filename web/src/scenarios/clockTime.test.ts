import { describe, expect, it } from 'vitest'
import { clockTime } from './clockTime'

describe('clockTime', () => {
  it("shows a time to the second, with its date, in the viewer's time", () => {
    const time = clockTime(new Date('2026-10-04T17:47:12Z'), { timeZone: 'America/New_York', locale: 'en-US' })

    expect(time).toBe('Sun, Oct 4, 1:47:12 PM EDT')
  })
})
