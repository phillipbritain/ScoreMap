import { describe, expect, it } from 'vitest'
import type { GameEntrant, GameField } from '../games/game'
import { boutChip, chipSizers } from './panelLines'

const entrant = (position: number, score: string | null = null): GameEntrant => ({
  position,
  name: `Golfer ${position}`,
  shortName: `G. ${position}`,
  flagUrl: null,
  score,
})

const field = (...entries: GameEntrant[]): GameField => ({ kind: 'field', entries })

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
