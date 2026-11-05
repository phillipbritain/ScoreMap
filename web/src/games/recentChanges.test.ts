import { describe, expect, it } from 'vitest'
import type { Game } from './game'
import type { GameChangeKind } from './gameChange'
import { changeSince, lastNumber, noRecentChanges, recordChange, type RecentChanges } from './recentChanges'

const game = (id: string) => ({ id }) as Game

const record = (recent: RecentChanges, ...changes: [GameChangeKind, string][]) =>
  changes.reduce((r, [kind, id]) => recordChange(r, { kind, game: game(id) }), recent)

describe('recent changes', () => {
  it('has no change for any game to begin with', () => {
    expect(changeSince(noRecentChanges, 'a', 0)).toBeNull()
  })

  it('keeps each game’s change, for a globe that hasn’t played it yet', () => {
    const recent = record(noRecentChanges, ['Finished', 'a'], ['ScoreChanged', 'b'])

    expect(changeSince(recent, 'a', 0)).toBe('Finished')
    expect(changeSince(recent, 'b', 0)).toBe('ScoreChanged')
    expect(changeSince(recent, 'c', 0)).toBeNull()
  })

  it('has nothing new for a globe that has played up to the latest change', () => {
    const recent = record(noRecentChanges, ['Started', 'a'], ['ScoreChanged', 'b'])

    expect(changeSince(recent, 'a', lastNumber(recent))).toBeNull()
    expect(changeSince(recent, 'b', lastNumber(recent))).toBeNull()
  })

  it('gives only what came after the last change played', () => {
    const played = record(noRecentChanges, ['Started', 'a'])
    const recent = record(played, ['ScoreChanged', 'a'])

    expect(changeSince(recent, 'a', lastNumber(played))).toBe('ScoreChanged')
  })

  it.each([
    [['Started', 'ScoreChanged'], 'Started'],
    [['ScoreChanged', 'Started'], 'Started'],
    [['ScoreChanged', 'Finished'], 'Finished'],
    [['Started', 'Finished'], 'Finished'],
    [['Finished', 'ScoreChanged'], 'Finished'],
    [['ScoreChanged', 'Updated'], 'ScoreChanged'],
  ] as const)('merges %j coming together to %s, the most notable', (kinds, merged) => {
    const recent = record(noRecentChanges, ...kinds.map((kind): [GameChangeKind, string] => [kind, 'a']))

    expect(changeSince(recent, 'a', 0)).toBe(merged)
  })

  it('does not hand back a change already played when a less notable one follows', () => {
    const played = record(noRecentChanges, ['Started', 'a'])
    const recent = record(played, ['ScoreChanged', 'a'], ['Updated', 'a'])

    expect(changeSince(recent, 'a', lastNumber(played))).toBe('ScoreChanged')
    expect(changeSince(record(played, ['Updated', 'a']), 'a', lastNumber(played))).toBeNull()
  })

  it('keeps no change for a game added, updated only, or removed', () => {
    const recent = record(noRecentChanges, ['Added', 'a'], ['Updated', 'b'], ['ScoreChanged', 'c'], ['Removed', 'c'])

    expect(changeSince(recent, 'a', 0)).toBeNull()
    expect(changeSince(recent, 'b', 0)).toBeNull()
    expect(changeSince(recent, 'c', 0)).toBeNull()
  })

  it('numbers changes on from those of any earlier record, so a globe that played them misses none', () => {
    const earlier = record(noRecentChanges, ['ScoreChanged', 'a'])
    const later = record(noRecentChanges, ['ScoreChanged', 'a'])

    expect(changeSince(later, 'a', lastNumber(earlier))).toBe('ScoreChanged')
  })
})
