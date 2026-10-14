import { kmApart, type GlobePoint } from './geo'
import listed from './cityList.json'
import settings from './cityLabelSettings.json'

/** A city in the city list labels are chosen from (see docs/city-labels.md). */
export interface ListedCity {
  /** Its English name, one line. */
  name: string
  country: string
  longitude: number
  latitude: number
  /** Its metro population. */
  population: number
  /** Whether it's a national capital. */
  capital: boolean
}

/** A city added to Big by hand, by its name and country as the city list has them. */
export interface BigListEntry {
  name: string
  country: string
}

/** What decides which cities are labelled (see docs/city-labels.md). */
export interface CityLabelSettings {
  /** A city of at least this metro population is Big. */
  bigCityPopulation: number
  /** A game is labelled by a city at most this far from it, in kilometres. */
  gameCityKm: number
  /** Cities that are Big whatever their population. */
  bigList: readonly BigListEntry[]
}

/** The settings the app labels cities by, from cityLabelSettings.json. */
export const cityLabelSettings: CityLabelSettings = settings

/** The city list included with the app, from cityList.json (made by `npm run city-list`), most populous first. */
export const cityList: readonly ListedCity[] = listed

/** The cities to label, by why. */
export interface CityLabels {
  /** Cities labelled for games: Big cities with a game near, and the Small cities games need. Always drawn. */
  gameCities: ListedCity[]
  /** Big cities with no game near, drawn where they have room. */
  bigCities: ListedCity[]
}

/**
 * Which cities to label for games at these venues (see docs/city-labels.md). Every Big city is
 * labelled. Then, going down the Small cities from most populous to least, a Small city is labelled
 * when some game within reach of it has no label within reach yet. The outcome depends only on the
 * venues, not their order.
 */
export function cityLabels(venues: readonly GlobePoint[], cities: readonly ListedCity[], settings: CityLabelSettings): CityLabels {
  const reach = settings.gameCityKm
  const near = (a: GlobePoint, b: GlobePoint) => Math.abs(a.latitude - b.latitude) <= reach / kmPerDegree && kmApart(a, b) <= reach
  const big = new Set(bigListCities(settings.bigList, cities))
  for (const city of cities) if (city.population >= settings.bigCityPopulation) big.add(city)

  const gameCities: ListedCity[] = []
  const bigCities: ListedCity[] = []
  for (const city of big) (venues.some((venue) => near(venue, city)) ? gameCities : bigCities).push(city)
  let unlabelled = venues.filter((venue) => !gameCities.some((city) => near(venue, city)))
  for (const city of [...cities].sort(byPopulation)) {
    if (unlabelled.length === 0) break
    if (big.has(city) || !unlabelled.some((venue) => near(venue, city))) continue
    gameCities.push(city)
    unlabelled = unlabelled.filter((venue) => !near(venue, city))
  }
  return { gameCities, bigCities }
}

// Kilometres per degree of latitude, roughly: a quick check that rules out most cities before
// working out how far apart they are.
const kmPerDegree = 110

/** Most populous first; cities as populous by name and country, so the order never depends on the list's. */
const byPopulation = (a: ListedCity, b: ListedCity) =>
  b.population - a.population || a.name.localeCompare(b.name) || a.country.localeCompare(b.country) || a.longitude - b.longitude

/** The cities on the Big list: every listed city of each entry's name and country. */
function bigListCities(bigList: readonly BigListEntry[], cities: readonly ListedCity[]): ListedCity[] {
  return cities.filter((city) => bigList.some((entry) => isEntry(city, entry)))
}

const isEntry = (city: ListedCity, { name, country }: BigListEntry) => city.name === name && city.country === country

/** The Big list entries that match no city in the list. */
export function notInList(bigList: readonly BigListEntry[], cities: readonly ListedCity[]): BigListEntry[] {
  return bigList.filter((entry) => !cities.some((city) => isEntry(city, entry)))
}
