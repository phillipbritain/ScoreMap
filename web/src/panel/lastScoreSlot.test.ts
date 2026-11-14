import { describe, expect, it } from 'vitest'
import type { Game, GameTeam } from '../games/game'
import { hasLastScoreSlot } from './lastScoreSlot'

const team = (abbreviation: string): GameTeam => ({ abbreviation, fullName: abbreviation, logoUrl: null, score: '0', rank: null, record: null, conference: null })
const sides: Game['contest'] = { kind: 'sides', home: team('KC'), away: team('BUF') }

describe('hasLastScoreSlot', () => {
  it('holds a last score for sports that score in plays', () => {
    for (const sport of ['Football', 'Basketball', 'Baseball', 'Hockey', 'Soccer', 'Rugby']) {
      expect(hasLastScoreSlot({ sport, contest: sides })).toBe(true)
    }
  })

  it('has none for tennis or cricket, whose feeds give no scoring plays', () => {
    expect(hasLastScoreSlot({ sport: 'Tennis', contest: sides })).toBe(false)
    expect(hasLastScoreSlot({ sport: 'Cricket', contest: sides })).toBe(false)
  })

  it('has none for a field or a fight card', () => {
    expect(hasLastScoreSlot({ sport: 'Racing', contest: { kind: 'field', entries: [] } })).toBe(false)
    expect(hasLastScoreSlot({ sport: 'Golf', contest: { kind: 'field', entries: [] } })).toBe(false)
    expect(hasLastScoreSlot({ sport: 'MMA', contest: { kind: 'bouts', bouts: [] } })).toBe(false)
  })
})
