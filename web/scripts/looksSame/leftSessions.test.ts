import { describe, expect, it } from 'vitest'
import { leftSessions, sessionFor } from './leftSessions.ts'

describe('leftSessions', () => {
  it("picks the check's sessions whose check has stopped", () => {
    const sessions = [sessionFor(101), sessionFor(102), sessionFor(103)]

    expect(leftSessions(sessions, (pid) => pid === 102)).toEqual([sessionFor(101), sessionFor(103)])
  })

  it('leaves every other session be', () => {
    const sessions = ['scoremap-104', 'scoremap-looks-same', 'scoremap-looks-same-x', 'my-scoremap-looks-same-101']

    expect(leftSessions(sessions, () => false)).toEqual([])
  })
})
