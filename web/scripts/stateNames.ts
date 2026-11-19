/**
 * Makes the list of state and province abbreviations the globe writes zoomed out (see placeNames):
 * Natural Earth's admin-1 states and provinces (public domain) for the United States and Canada
 * only, the states, provinces and territories (not the District of Columbia), each with its postal
 * code and the point Natural Earth places its label at.
 * Run it with `npm run state-names` from `web/` to fetch them again and rewrite
 * `src/globe/stateNames.json`.
 */
import { writeFile } from 'node:fs/promises'

const statesUrl =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson'
const namesFile = new URL('../src/globe/stateNames.json', import.meta.url)

/** The countries whose states are kept, by Natural Earth's names for them. */
const countries = ['United States of America', 'Canada']
/** Kinds of place kept, by Natural Earth's English names for them. */
const kinds = ['State', 'Province', 'Territory']

interface State {
  properties: { admin: string; type_en: string; name: string; postal: string; longitude: number; latitude: number }
}

const response = await fetch(statesUrl)
if (!response.ok) throw new Error(`Fetching Natural Earth's states failed: ${response.status}`)
const { features } = (await response.json()) as { features: State[] }

const states = features
  .map(({ properties }) => properties)
  .filter(({ admin, type_en }) => countries.includes(admin) && kinds.includes(type_en))
  .map(({ name, postal, longitude, latitude }) => ({ name, postal, longitude, latitude }))
  .sort((a, b) => a.postal.localeCompare(b.postal))

await writeFile(namesFile, '[\n' + states.map((state) => JSON.stringify(state)).join(',\n') + '\n]\n')
console.log(`Wrote ${states.length} states, provinces and territories.`)
