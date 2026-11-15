/**
 * Makes the state and province lines the globe draws at every zoom (see globeStyle): Natural Earth's
 * admin-1 lines (public domain) for the United States and Canada only, those it shows by zoom 5,
 * lightly simplified.
 * Run it with `npm run state-lines` from `web/` to fetch the lines again and rewrite
 * `src/globe/stateLines.json`.
 */
import { writeFile } from 'node:fs/promises'

const linesUrl =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces_lines.geojson'
const linesFile = new URL('../src/globe/stateLines.json', import.meta.url)

/** The most detailed lines kept: Natural Earth's own zoom for each, at which it starts showing it. */
const mostDetailed = 5
/** The countries whose lines are kept, by Natural Earth's names for them. */
const countries = ['United States of America', 'Canada']
/** How far a simplified line may stray from the original, in degrees (about 200 m), and how finely positions are kept. */
const tolerance = 0.002
const decimals = 3

type Position = [number, number]
interface Line {
  properties: { FEATURECLA: string; MIN_ZOOM: number; ADM0_NAME: string }
  geometry: { type: 'LineString'; coordinates: Position[] } | { type: 'MultiLineString'; coordinates: Position[][] }
}

/** Douglas–Peucker: the fewest of a line's points that keep it within `tolerance` of where it was. */
function simplified(line: Position[]): Position[] {
  if (line.length <= 2) return line
  const [ax, ay] = line[0]
  const [bx, by] = line[line.length - 1]
  const length = Math.hypot(bx - ax, by - ay)
  let furthest = 0
  let at = 0
  for (let i = 1; i < line.length - 1; i++) {
    const [px, py] = line[i]
    const distance =
      length === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length
    if (distance > furthest) {
      furthest = distance
      at = i
    }
  }
  if (furthest <= tolerance) return [line[0], line[line.length - 1]]
  return [...simplified(line.slice(0, at + 1)).slice(0, -1), ...simplified(line.slice(at))]
}

const rounded = ([x, y]: Position): Position => [Number(x.toFixed(decimals)), Number(y.toFixed(decimals))]

const response = await fetch(linesUrl)
if (!response.ok) throw new Error(`Fetching Natural Earth's lines failed: ${response.status}`)
const { features } = (await response.json()) as { features: Line[] }

const lines = features
  .filter(
    ({ properties }) =>
      countries.includes(properties.ADM0_NAME) && properties.MIN_ZOOM <= mostDetailed && !properties.FEATURECLA.includes('meta'),
  )
  .flatMap(({ geometry }) => (geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates))
  .map((line) => simplified(line).map(rounded))
  .filter((line) => line.length >= 2)

const collection = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } }],
}
await writeFile(linesFile, JSON.stringify(collection) + '\n')
console.log(`Wrote ${lines.length} lines, ${lines.reduce((n, line) => n + line.length, 0)} points.`)
