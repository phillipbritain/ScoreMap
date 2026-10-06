import type { CityNameLook } from './globeStyle'

/** A city the map names, as its tiles give it. */
export interface City {
  /** The tile feature's id, the same in every tile and at every zoom. */
  id: number
  /** The name as the map writes it, one line per entry when it has a second script. */
  name: string
  capital: boolean
  longitude: number
  latitude: number
}

/** A box on screen, in pixels, by its centre. */
export interface ScreenBox {
  x: number
  y: number
  width: number
  height: number
}

/** A game's venue is named by the nearest major city within this distance. */
const maxCityKm = 50

/**
 * The cities named for the games: for each venue, the nearest city the map names, if it's within
 * reach. A venue far from any named city has none. Each city is listed once, in the order found.
 */
export function gameCities(
  venues: readonly { longitude: number; latitude: number }[],
  cities: readonly City[],
): City[] {
  const found = new Map<number, City>()
  for (const venue of venues) {
    let nearest: City | undefined
    let nearestKm = maxCityKm
    for (const city of cities) {
      const km = distanceKm(venue, city)
      if (km <= nearestKm) {
        nearest = city
        nearestKm = km
      }
    }
    if (nearest && !found.has(nearest.id)) found.set(nearest.id, nearest)
  }
  return [...found.values()]
}

/**
 * Where a game city's name is written: centred below its dot at `dot` (see globeStyle's game city
 * names), wrapped as the map wraps it. `measure` gives a line's width in pixels in the name's font.
 * Its outline and a margin are included, since the box is for keeping cards clear of the name.
 */
export function cityNameBox(
  city: City,
  dot: { x: number; y: number },
  look: CityNameLook,
  measure: (text: string, font: string) => number,
): ScreenBox {
  const lines = city.name.split('\n').flatMap((line) => wrap(line, look, measure))
  const width = Math.max(...lines.map((line) => measure(line, look.font))) + 2 * nameMargin
  const height = lines.length * lineHeight * look.size + 2 * nameMargin
  return { x: dot.x, y: dot.y + look.offset - nameMargin + height / 2, width, height }
}

// The map's line height for names, in ems.
const lineHeight = 1.2
// Room around a name's letters: its 2 px outline and a little more.
const nameMargin = 4

/** Splits a line at spaces where it's wider than the map lets a name run (an approximation of MapLibre's wrapping). */
function wrap(line: string, look: CityNameLook, measure: (text: string, font: string) => number): string[] {
  const lines: string[] = []
  let current = ''
  for (const word of line.split(' ')) {
    const longer = current ? `${current} ${word}` : word
    if (current && measure(longer, look.font) > look.maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = longer
    }
  }
  return [...lines, current]
}

function distanceKm(a: { longitude: number; latitude: number }, b: { longitude: number; latitude: number }): number {
  const radians = Math.PI / 180
  const dLat = (b.latitude - a.latitude) * radians
  const dLon = (b.longitude - a.longitude) * radians
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h))
}
const earthRadiusKm = 6371
