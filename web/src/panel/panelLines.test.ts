import { describe, expect, it } from 'vitest'
import type { GameEntrant, GameField } from '../games/game'
import { boutChip, chipSizers, fieldLines } from './panelLines'

const entrant = (position: number, score: string | null = null): GameEntrant => ({
  position,
  name: `Golfer ${position}`,
  shortName: `G. ${position}`,
  flagUrl: null,
  score,
})

const field = (...entries: GameEntrant[]): GameField => ({ kind: 'field', entries })

describe('fieldLines', () => {
  it('puts the top two in the score block and the whole rest of the field, from 3rd, in the band', () => {
    const entries = Array.from({ length: 72 }, (_, i) => entrant(i + 1))
    const { leaders, rest } = fieldLines(field(...entries))
    expect(leaders.map((e) => e.position)).toEqual([1, 2])
    expect(rest).toHaveLength(70)
    expect(rest[0].position).toBe(3)
    expect(rest.at(-1)?.position).toBe(72)
  })

  it('leaves the band empty for a field of two or fewer', () => {
    expect(fieldLines(field(entrant(1), entrant(2))).rest).toEqual([])
    expect(fieldLines(field()).leaders).toEqual([])
  })
})

describe('chipSizers', () => {
  it('takes one score of each length', () => {
    expect(chipSizers(field(entrant(1, '-12'), entrant(2, '-11'), entrant(3, '-9'), entrant(4, 'E'), entrant(5, '+3')))).toEqual([
      '-12',
      '-9',
      'E',
    ])
  })

  it('is none for a race, which has no scores', () => {
    expect(chipSizers(field(entrant(1), entrant(2)))).toEqual([])
  })
})

describe('boutChip', () => {
  const side = (winner: boolean) => ({ name: 'Tom Nolan', shortName: 'T. Nolan', flagUrl: null, record: null, winner })

  it('is W for the winner', () => {
    expect(boutChip(side(true))).toBe('W')
  })

  it('is none for a side that has not won, before, during or after its bout', () => {
    expect(boutChip(side(false))).toBeNull()
  })
})
