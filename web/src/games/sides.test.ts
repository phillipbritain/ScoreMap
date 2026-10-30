import { describe, expect, it } from 'vitest'
import type { Game, GameTeam } from './game'
import { sidesTopFirst } from './sides'

const side = (abbreviation: string): GameTeam => ({ abbreviation, fullName: abbreviation, logoUrl: null, score: null, rank: null, record: null })
const home = side('HOM')
const away = side('AWY')

describe('sidesTopFirst', () => {
  it('puts the away team on top, as US scoreboards do', () => {
    expect(sidesTopFirst({ sport: 'Football', home, away })).toEqual([away, home])
  })

  it('puts the home side on top in tennis, as ESPN lists its players', () => {
    expect(sidesTopFirst({ sport: 'Tennis', home, away } satisfies Pick<Game, 'sport' | 'home' | 'away'>)).toEqual([home, away])
  })
})
