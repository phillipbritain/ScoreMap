import { describe, expect, it } from 'vitest'
import type { Game, GameTeam } from '../games/game'
import { lastScoreSlot } from './lastScoreSlot'

const team = (abbreviation: string): GameTeam => ({ abbreviation, fullName: abbreviation, logoUrl: null, score: '0', rank: null, record: null, conference: null })
const sides: Game['contest'] = { kind: 'sides', home: team('KC'), away: team('BUF') }

describe('lastScoreSlot', () => {
  it('shows a last score for sports that score in plays', () => {
    for (const sport of ['Football', 'Basketball', 'Baseball', 'Hockey', 'Soccer', 'Rugby']) {
      expect(lastScoreSlot({ sport, contest: sides })).toBe('shown')
    }
  })

  it('holds the room in cricket, whose feed gives no scoring plays', () => {
    expect(lastScoreSlot({ sport: 'Cricket', contest: sides })).toBe('held')
  })

  it('has none for tennis, a field or a fight card', () => {
    expect(lastScoreSlot({ sport: 'Tennis', contest: sides })).toBe('none')
    expect(lastScoreSlot({ sport: 'Racing', contest: { kind: 'field', entries: [] } })).toBe('none')
    expect(lastScoreSlot({ sport: 'Golf', contest: { kind: 'field', entries: [] } })).toBe('none')
    expect(lastScoreSlot({ sport: 'MMA', contest: { kind: 'bouts', bouts: [] } })).toBe('none')
  })
})
