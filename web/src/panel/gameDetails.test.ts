import { describe, expect, it } from 'vitest'
import { oddsLine } from './gameDetails'

describe('oddsLine', () => {
  it('gives the line and the total', () => {
    expect(oddsLine({ line: 'SEA -2.5', overUnder: 40.5, bookmaker: 'DraftKings' })).toBe('SEA -2.5 · O/U 40.5')
  })

  it('gives whichever half there is', () => {
    expect(oddsLine({ line: null, overUnder: 6.5, bookmaker: null })).toBe('O/U 6.5')
    expect(oddsLine({ line: 'EVEN', overUnder: null, bookmaker: null })).toBe('EVEN')
    expect(oddsLine({ line: null, overUnder: null, bookmaker: null })).toBeNull()
  })
})
