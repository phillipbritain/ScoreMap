import { describe, expect, it } from 'vitest'
import type { GlobePoint } from './geo'
import { outerPinGames } from './pinSources'
import { cardRadius } from './zoomLevels'

const at = (id: string, longitude: number, latitude = 0) => ({ id, venue: { longitude, latitude } })
const center: GlobePoint = { longitude: 0, latitude: 0 }
const nothingBehind = () => false
const ids = (games: readonly { id: string }[]) => games.map((game) => game.id)

describe('outerPinGames', () => {
  it('gives none while pins are small, as every game is in the pin source then', () => {
    const games = [at('NEAR', 0), at('FAR', cardRadius + 10)]
    expect(outerPinGames(games, { size: 'small', center }, nothingBehind)).toEqual([])
  })

  it('gives the games with no score card at card zoom: those past the card radius', () => {
    const games = [at('NEAR', 10), at('EDGE', cardRadius), at('PAST', cardRadius + 0.5), at('FAR', -60, 20)]
    expect(ids(outerPinGames(games, { size: 'card', center }, nothingBehind))).toEqual(['PAST', 'FAR'])
  })

  it('measures the card radius from the center of the view, so the outer pins follow the globe as it turns', () => {
    const games = [at('A', 0), at('B', 60)]
    expect(ids(outerPinGames(games, { size: 'card', center: { longitude: 0, latitude: 0 } }, nothingBehind))).toEqual(['B'])
    expect(ids(outerPinGames(games, { size: 'card', center: { longitude: 60, latitude: 0 } }, nothingBehind))).toEqual(['A'])
  })

  it('leaves out the games behind the globe', () => {
    const games = [at('SEEN', 60), at('HIDDEN', 120)]
    const behind = ({ longitude }: GlobePoint) => longitude > 90
    expect(ids(outerPinGames(games, { size: 'card', center }, behind))).toEqual(['SEEN'])
  })
})
