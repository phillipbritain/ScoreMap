import { describe, expect, it } from 'vitest'
import { cityNameBox, cityOfPlace, gameCities, type City } from './gameCities'
import { cityNameLook } from './placeNames'

const tampa: City = { id: 1, name: 'Tampa', capital: false, longitude: -82.4584, latitude: 27.9478 }
const miami: City = { id: 2, name: 'Miami', capital: false, longitude: -80.1937, latitude: 25.7743 }
const tropicanaField = { longitude: -82.6533, latitude: 27.7681 }
const lightningArena = { longitude: -82.4519, latitude: 27.9427 }
const hardRockStadium = { longitude: -80.2389, latitude: 25.958 }
const disneyWorld = { longitude: -81.5639, latitude: 28.3852 }

describe('gameCities', () => {
  it("names each venue by the nearest city, even when it's in a smaller city nearby", () => {
    // Tropicana Field is in St. Petersburg, which the map doesn't name.
    expect(gameCities([tropicanaField, hardRockStadium], [miami, tampa])).toEqual([tampa, miami])
  })

  it('lists a city once however many games are there', () => {
    expect(gameCities([tropicanaField, lightningArena], [tampa, miami])).toEqual([tampa])
  })

  it('names no city for a venue far from every city the map names', () => {
    expect(gameCities([disneyWorld], [tampa, miami])).toEqual([])
  })

  it('names a venue by the nearest place however small, over a bigger city further off', () => {
    const stPetersburg: City = { id: 3, name: 'St. Petersburg', capital: false, longitude: -82.6403, latitude: 27.7703 }
    expect(gameCities([tropicanaField], [tampa, stPetersburg])).toEqual([stPetersburg])
  })
})

describe('cityOfPlace', () => {
  const point = (longitude: number, latitude: number) => ({ type: 'Point', coordinates: [longitude, latitude] })

  it("reads a place from the map's tiles, named as the map writes it", () => {
    expect(
      cityOfPlace({ id: 9, properties: { name: 'Tampa', name_en: 'Tampa', capital: 4 }, geometry: point(-82.46, 27.95) }),
    ).toEqual({ id: 9, name: 'Tampa', capital: false, longitude: -82.46, latitude: 27.95 })
  })

  it('writes a name in another script on a second line, and marks national capitals', () => {
    const tokyo = cityOfPlace({
      id: 1,
      properties: { 'name:latin': 'Tokyo', 'name:nonlatin': '東京都', capital: 2 },
      geometry: point(139.7, 35.7),
    })
    expect(tokyo).toMatchObject({ name: 'Tokyo\n東京都', capital: true })
  })

  it('skips a place without a numeric id or a single point', () => {
    expect(cityOfPlace({ id: 'x', properties: {}, geometry: point(0, 0) })).toBeUndefined()
    expect(cityOfPlace({ id: 1, properties: {}, geometry: { type: 'MultiPoint', coordinates: [] } })).toBeUndefined()
  })
})

describe('cityNameBox', () => {
  // Every letter 10 px wide.
  const measure = (text: string) => text.length * 10
  const look = cityNameLook(4, false)

  it('sits centred below the dot, past the offset, with room for the outline', () => {
    const box = cityNameBox(tampa, { x: 100, y: 200 }, look, measure)
    expect(box.x).toBe(100)
    expect(box.width).toBeGreaterThan(50)
    expect(box.y - box.height / 2).toBeLessThanOrEqual(200 + look.offset)
    expect(box.y - box.height / 2).toBeGreaterThan(200)
    expect(box.y + box.height / 2).toBeGreaterThanOrEqual(200 + look.offset + look.size)
  })

  it('wraps a long name onto more lines, as the map does', () => {
    const long = { ...tampa, name: 'Ciudad de la Santísima Trinidad' }
    const box = cityNameBox(long, { x: 0, y: 0 }, look, measure)
    expect(box.width).toBeLessThanOrEqual(look.maxWidth + 8)
    expect(box.height).toBeGreaterThan(2 * look.size)
  })
})
