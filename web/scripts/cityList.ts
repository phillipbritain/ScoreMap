/**
 * Makes the city list city labels are chosen from (see docs/city-labels.md): Natural Earth's populated
 * places (public domain), cut down to each city's name, country, position, metro population and
 * whether it's a national capital, most populous first. Run it with `npm run city-list` from `web/`
 * to fetch the places again and rewrite `src/globe/cityList.json`.
 */
import { writeFile } from 'node:fs/promises'

const placesUrl =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson'
const listFile = new URL('../src/globe/cityList.json', import.meta.url)

interface Place {
  properties: { name: string; adm0name: string; latitude: number; longitude: number; pop_max: number | null; adm0cap: number }
}

const response = await fetch(placesUrl)
if (!response.ok) throw new Error(`Fetching ${placesUrl} gave ${response.status} ${response.statusText}`)
const { features } = (await response.json()) as { features: Place[] }

// To about 10 m, which is plenty for a 50 km reach and keeps the file small.
const rounded = (degrees: number) => Math.round(degrees * 1e4) / 1e4

const cities = features
  .map(({ properties: p }) => ({
    // One line: Natural Earth writes "Washington,  D.C." with two spaces.
    name: p.name.replace(/\s+/g, ' ').trim(),
    country: p.adm0name,
    longitude: rounded(p.longitude),
    latitude: rounded(p.latitude),
    population: p.pop_max ?? 0,
    capital: p.adm0cap === 1,
  }))
  .sort((a, b) => b.population - a.population || a.name.localeCompare(b.name) || a.country.localeCompare(b.country))

// One city a line, so a change to the list reads plainly in a diff.
await writeFile(listFile, `[\n${cities.map((city) => JSON.stringify(city)).join(',\n')}\n]\n`)
console.log(`Wrote ${cities.length} cities to ${listFile.pathname}`)
