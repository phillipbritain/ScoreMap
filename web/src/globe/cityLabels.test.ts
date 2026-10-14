import { describe, expect, it } from 'vitest'
import { cityLabels, cityList, cityLabelSettings, notInList, type CityLabelSettings, type ListedCity } from './cityLabels'
import type { GlobePoint } from './geo'

const city = (name: string, population: number, longitude: number, latitude: number, capital = false): ListedCity => ({
  name,
  country: 'United States of America',
  longitude,
  latitude,
  population,
  capital,
})

// Florida, from Natural Earth's list.
const miami = city('Miami', 5_585_000, -80.2261, 25.7895)
const tampa = city('Tampa', 2_314_000, -82.4597, 27.9493)
const stPetersburg = city('St. Petersburg', 791_000, -82.6799, 27.7704)
const fortLauderdale = city('Fort Lauderdale', 1_103_000, -80.1439, 26.1361)
const orlando = city('Orlando', 1_350_000, -81.3823, 28.5122)
const cities = [miami, tampa, stPetersburg, fortLauderdale, orlando]

const tropicanaField = { longitude: -82.6533, latitude: 27.7681 }
const lightningArena = { longitude: -82.4519, latitude: 27.9427 }
const hardRockStadium = { longitude: -80.2389, latitude: 25.958 }
const evergladesCity = { longitude: -81.3851, latitude: 25.8573 }

const settings: CityLabelSettings = { bigCityPopulation: 4_000_000, gameCityKm: 50, bigList: [] }

const labels = (venues: GlobePoint[], given: Partial<CityLabelSettings> = {}) =>
  cityLabels(venues, cities, { ...settings, ...given })
const names = (list: readonly ListedCity[]) => list.map((c) => c.name).sort()

describe('cityLabels', () => {
  it('labels Big cities by metro population, whether or not a game is near', () => {
    expect(names(labels([]).otherBigCities)).toEqual(['Miami'])
    expect(labels([]).gameCities).toEqual([])
  })

  it('labels a city on the Big list as Big, whatever its population', () => {
    expect(names(labels([], { bigList: [{ name: 'Orlando', country: 'United States of America' }] }).otherBigCities)).toEqual([
      'Miami',
      'Orlando',
    ])
  })

  it('labels a game with the most populous Small city within 50 km, not the nearest', () => {
    // Tropicana Field is in St. Petersburg, 25 km from Tampa.
    expect(names(labels([tropicanaField]).gameCities)).toEqual(['Tampa'])
  })

  it('labels no Small city for a game with a label already within 50 km', () => {
    // Hard Rock Stadium is between Miami and Fort Lauderdale; Miami is Big.
    const { gameCities, otherBigCities } = labels([hardRockStadium])
    expect(names(gameCities)).toEqual(['Miami'])
    expect(otherBigCities).toEqual([])
  })

  it('labels no city for a game with none within 50 km', () => {
    expect(labels([evergladesCity]).gameCities).toEqual([])
  })

  it('lists a city once, however many games it labels', () => {
    expect(names(labels([tropicanaField, lightningArena]).gameCities)).toEqual(['Tampa'])
  })

  it('gives the same labels whatever order the games come in', () => {
    const venues = [tropicanaField, hardRockStadium, lightningArena, evergladesCity]
    expect(names(labels(venues).gameCities)).toEqual(names(labels([...venues].reverse()).gameCities))
  })

  it('changes with the settings', () => {
    expect(names(labels([], { bigCityPopulation: 2_000_000 }).otherBigCities)).toEqual(['Miami', 'Tampa'])
    // Miami is 116 km from Everglades City.
    expect(names(labels([evergladesCity], { gameCityKm: 150 }).gameCities)).toEqual(['Miami'])
  })
})

describe('the city list', () => {
  it('has every city on the Big list', () => {
    expect(notInList(cityLabelSettings.bigList, cityList)).toEqual([])
  })

  it('tells which Big list entries it lacks', () => {
    expect(notInList([{ name: 'Atlantis', country: 'Greece' }], cityList)).toEqual([{ name: 'Atlantis', country: 'Greece' }])
  })
})
