import { describe, expect, it } from 'vitest'
import type { GameSides, GameTeam } from './game'
import { sidesTopFirst } from './sides'

const side = (abbreviation: string): GameTeam => ({ abbreviation, fullName: abbreviation, logoUrl: null, score: null, rank: null, record: null })
const home = side('HOM')
const away = side('AWY')
const sides: GameSides = { kind: 'sides', home, away }

describe('sidesTopFirst', () => {
  it('puts the away team on top, as US scoreboards do', () => {
    expect(sidesTopFirst('Football', sides)).toEqual([away, home])
  })

  it('puts the home side on top in tennis, as ESPN lists its players', () => {
    expect(sidesTopFirst('Tennis', sides)).toEqual([home, away])
  })
})
