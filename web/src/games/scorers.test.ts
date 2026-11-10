import { describe, expect, it } from 'vitest'
import type { Game, GameContest } from './game'
import { noRecentScorers, recordScorer, scoringSide, spotlightElapsed, spotlightMs } from './scorers'

const sides = (home: string | null, away: string | null) =>
  ({ id: 'a', contest: { kind: 'sides', home: { score: home }, away: { score: away } } }) as Game

describe('scoring side', () => {
  it('is the one side whose score went up', () => {
    expect(scoringSide(sides('3', '1'), sides('4', '1'))).toBe('home')
    expect(scoringSide(sides('3', '1'), sides('3', '4'))).toBe('away')
  })

  it('counts a first score, from no score at all', () => {
    expect(scoringSide(sides(null, null), sides(null, '2'))).toBe('away')
  })

  it.each([
    ['neither side scored', sides('3', '1'), sides('3', '1')],
    ['both sides scored at once', sides('3', '1'), sides('4', '2')],
    ['a score was taken back', sides('3', '1'), sides('2', '1')],
    ['a score went away', sides('3', '1'), sides(null, '1')],
  ])('is none when %s', (_, before, after) => {
    expect(scoringSide(before, after)).toBeNull()
  })

  it('is none for a game without two sides', () => {
    const field = { id: 'a', contest: { kind: 'field', entries: [] } as unknown as GameContest } as Game

    expect(scoringSide(field, field)).toBeNull()
  })
})

describe('recent scorers', () => {
  it('keeps the side that scored, and when', () => {
    const recent = recordScorer(noRecentScorers, sides('0', '0'), { kind: 'ScoreChanged', game: sides('0', '1') }, 500)

    expect(recent.get('a')).toEqual({ side: 'away', at: 500 })
  })

  it('takes the latest score over an earlier one', () => {
    const first = recordScorer(noRecentScorers, sides('0', '0'), { kind: 'ScoreChanged', game: sides('0', '1') }, 500)
    const recent = recordScorer(first, sides('0', '1'), { kind: 'Finished', game: sides('1', '1') }, 900)

    expect(recent.get('a')).toEqual({ side: 'home', at: 900 })
  })

  it('keeps the last scorer through a change with no score in it', () => {
    const scored = recordScorer(noRecentScorers, sides('0', '0'), { kind: 'ScoreChanged', game: sides('0', '1') }, 500)

    expect(recordScorer(scored, sides('0', '1'), { kind: 'Updated', game: sides('0', '1') }, 900)).toBe(scored)
  })

  it('has no scorer for a game it had not seen, or one removed', () => {
    expect(recordScorer(noRecentScorers, undefined, { kind: 'Added', game: sides('2', '0') }, 500)).toBe(noRecentScorers)

    const scored = recordScorer(noRecentScorers, sides('0', '0'), { kind: 'ScoreChanged', game: sides('0', '1') }, 500)
    expect(recordScorer(scored, undefined, { kind: 'Removed', game: sides('0', '1') }, 900).has('a')).toBe(false)
  })
})

describe('spotlight', () => {
  const scorer = { side: 'home', at: 1_000 } as const

  it('runs from when the side scored', () => {
    expect(spotlightElapsed(scorer, 1_000)).toBe(0)
    expect(spotlightElapsed(scorer, 2_500)).toBe(1_500)
  })

  it('is over once its time is up', () => {
    expect(spotlightElapsed(scorer, 1_000 + spotlightMs)).toBeNull()
  })

  it('is none with no scorer', () => {
    expect(spotlightElapsed(undefined, 1_000)).toBeNull()
  })
})
