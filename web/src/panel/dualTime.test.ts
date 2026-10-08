import { describe, expect, it } from 'vitest'
import { clockTime, dualTime } from './dualTime'

const kickoff = '2026-10-04T17:00:00+00:00'

describe('dualTime', () => {
  it("shows the viewer's time with the venue's local time beside it", () => {
    const time = dualTime(kickoff, 'America/Chicago', { timeZone: 'America/New_York', locale: 'en-US' })

    expect(time).toEqual({ viewer: 'Sun, Oct 4, 1:00 PM EDT', venue: '12:00 PM CDT' })
  })

  it("adds the date to the venue's time when it falls on a different day", () => {
    const time = dualTime(kickoff, 'Australia/Sydney', { timeZone: 'America/Los_Angeles', locale: 'en-US' })

    expect(time).toEqual({ viewer: 'Sun, Oct 4, 10:00 AM PDT', venue: 'Mon, Oct 5, 4:00 AM GMT+11' })
  })

  it("leaves out the venue's time when the viewer is in the same time zone", () => {
    const time = dualTime(kickoff, 'Europe/London', { timeZone: 'Europe/London', locale: 'en-GB' })

    expect(time).toEqual({ viewer: 'Sun 4 Oct, 18:00 BST', venue: null })
  })

  it("leaves out the venue's time when the venue's time zone is unknown", () => {
    const time = dualTime(kickoff, null, { timeZone: 'Asia/Tokyo', locale: 'en-US' })

    expect(time).toEqual({ viewer: 'Mon, Oct 5, 2:00 AM GMT+9', venue: null })
  })
})

describe('clockTime', () => {
  it("shows a time to the second in the viewer's time, in the same format", () => {
    const time = clockTime(new Date('2026-10-04T17:47:12Z'), { timeZone: 'America/New_York', locale: 'en-US' })

    expect(time).toBe('Sun, Oct 4, 1:47:12 PM EDT')
  })
})
