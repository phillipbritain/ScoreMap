import { describe, expect, it } from 'vitest'
import type { GameChangeKind } from './gameChange'
import { changeAfter, noGameChanges, withChange, type GameChanges } from './recentChanges'

const record = (changes: GameChanges, ...kinds: GameChangeKind[]) => kinds.reduce(withChange, changes)

const lastNumber = (changes: GameChanges) => changes.at(-1)?.number ?? 0

describe('recent changes', () => {
  it.each([
    [['Started', 'ScoreChanged'], 'Started'],
    [['ScoreChanged', 'Started'], 'Started'],
    [['ScoreChanged', 'Finished'], 'Finished'],
    [['Started', 'Finished'], 'Finished'],
    [['Finished', 'ScoreChanged'], 'Finished'],
    [['ScoreChanged', 'Updated'], 'ScoreChanged'],
  ] as const)('merges %j coming together to %s, the most notable', (kinds, merged) => {
    expect(changeAfter(record(noGameChanges, ...kinds), 0)).toBe(merged)
  })

  it('does not hand back a change already played when a less notable one follows', () => {
    const played = record(noGameChanges, 'Started')
    const recent = record(played, 'ScoreChanged', 'Updated')

    expect(changeAfter(recent, lastNumber(played))).toBe('ScoreChanged')
    expect(changeAfter(record(played, 'Updated'), lastNumber(played))).toBeNull()
  })

  it('leaves the changes as they were for a change that is not notable', () => {
    const recent = record(noGameChanges, 'ScoreChanged')

    expect(withChange(recent, 'Added')).toBe(recent)
    expect(withChange(recent, 'Updated')).toBe(recent)
  })

  it('numbers changes on from those of any earlier record, so a globe that played them misses none', () => {
    const earlier = record(noGameChanges, 'ScoreChanged')
    const later = record(noGameChanges, 'ScoreChanged')

    expect(changeAfter(later, lastNumber(earlier))).toBe('ScoreChanged')
  })
})
