import { describe, expect, it } from 'vitest'
import { boardTime } from './boardClock'

const at = '2026-11-18T05:00:00Z'
const reads = '2026-08-04T16:00:00Z'
const later = (seconds: number) => Date.parse(at) + seconds * 1000

describe('boardTime', () => {
  it("is the real time until the server has sent the board's clock", () => {
    expect(boardTime(null, later(5))).toBe(later(5))
  })

  it('runs the scenario clock forward from its reading at its speed', () => {
    expect(new Date(boardTime({ at, reads, times: 32 }, later(10))).toISOString()).toBe('2026-08-04T16:05:20.000Z')
  })

  it('stands still while paused', () => {
    expect(new Date(boardTime({ at, reads, times: 0 }, later(60))).toISOString()).toBe('2026-08-04T16:00:00.000Z')
  })
})
