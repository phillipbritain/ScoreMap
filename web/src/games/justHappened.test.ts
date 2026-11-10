import { describe, expect, it } from 'vitest'
import type { Game } from './game'
import type { GameChangeKind } from './gameChange'
import { changeSince, lastNumber, noneJustHappened, recordJustHappened, scorerOf, type JustHappened } from './justHappened'

const sides = (id: string, home: string | null = '0', away: string | null = '0') =>
  ({ id, contest: { kind: 'sides', home: { score: home }, away: { score: away } } }) as Game

/** These changes recorded one after another, each to a game whose score didn't change. */
const record = (recent: JustHappened, ...changes: [GameChangeKind, string][]) =>
  changes.reduce((r, [kind, id]) => recordJustHappened(r, sides(id), { kind, game: sides(id) }, 0), recent)

describe('what just happened', () => {
  it('has nothing for any game to begin with, as a snapshot brings', () => {
    expect(changeSince(noneJustHappened, 'a', 0)).toBeNull()
    expect(scorerOf(noneJustHappened, 'a')).toBeUndefined()
    expect(lastNumber(noneJustHappened)).toBe(0)
  })

  it('keeps each game’s change, for a globe that hasn’t played it yet', () => {
    const recent = record(noneJustHappened, ['Finished', 'a'], ['ScoreChanged', 'b'])

    expect(changeSince(recent, 'a', 0)).toBe('Finished')
    expect(changeSince(recent, 'b', 0)).toBe('ScoreChanged')
    expect(changeSince(recent, 'c', 0)).toBeNull()
  })

  it('has nothing new for a globe that has played up to the latest change', () => {
    const recent = record(noneJustHappened, ['Started', 'a'], ['ScoreChanged', 'b'])

    expect(changeSince(recent, 'a', lastNumber(recent))).toBeNull()
    expect(changeSince(recent, 'b', lastNumber(recent))).toBeNull()
  })

  it('gives only what came after the last change played', () => {
    const played = record(noneJustHappened, ['Started', 'a'])
    const recent = record(played, ['ScoreChanged', 'a'])

    expect(changeSince(recent, 'a', lastNumber(played))).toBe('ScoreChanged')
  })

  it('keeps no change for a game added or updated only', () => {
    const recent = record(noneJustHappened, ['Added', 'a'], ['Updated', 'b'])

    expect(changeSince(recent, 'a', 0)).toBeNull()
    expect(changeSince(recent, 'b', 0)).toBeNull()
    expect(recent).toBe(noneJustHappened)
  })

  it('keeps the side that scored, and when', () => {
    const recent = recordJustHappened(noneJustHappened, sides('a', '0', '0'), { kind: 'ScoreChanged', game: sides('a', '0', '1') }, 500)

    expect(scorerOf(recent, 'a')).toEqual({ side: 'away', at: 500 })
  })

  it('takes the latest score over an earlier one, whatever kind of change it came in', () => {
    const first = recordJustHappened(noneJustHappened, sides('a', '0', '0'), { kind: 'ScoreChanged', game: sides('a', '0', '1') }, 500)
    const recent = recordJustHappened(first, sides('a', '0', '1'), { kind: 'Finished', game: sides('a', '1', '1') }, 900)

    expect(scorerOf(recent, 'a')).toEqual({ side: 'home', at: 900 })
    expect(changeSince(recent, 'a', 0)).toBe('Finished')
  })

  it('keeps the last scorer through a change with no score in it', () => {
    const recent = recordJustHappened(noneJustHappened, sides('a', '0', '0'), { kind: 'ScoreChanged', game: sides('a', '0', '1') }, 500)

    expect(recordJustHappened(recent, sides('a', '0', '1'), { kind: 'Updated', game: sides('a', '0', '1') }, 900)).toBe(recent)
  })

  it('has no scorer for a game it had not seen', () => {
    expect(recordJustHappened(noneJustHappened, undefined, { kind: 'Added', game: sides('a', '2', '0') }, 500)).toBe(noneJustHappened)
  })

  it('clears a game removed: its changes and its scorer', () => {
    const recent = recordJustHappened(noneJustHappened, sides('a', '0', '0'), { kind: 'ScoreChanged', game: sides('a', '0', '1') }, 500)
    const removed = recordJustHappened(recent, undefined, { kind: 'Removed', game: sides('a', '0', '1') }, 900)

    expect(changeSince(removed, 'a', 0)).toBeNull()
    expect(scorerOf(removed, 'a')).toBeUndefined()
    expect(recordJustHappened(noneJustHappened, undefined, { kind: 'Removed', game: sides('b') }, 900)).toBe(noneJustHappened)
  })
})
