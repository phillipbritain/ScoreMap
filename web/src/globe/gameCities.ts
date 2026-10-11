import { kmApart, type GlobePoint } from './geo'
import type { CityNameLook } from './placeNames'

/** A city, town or village the map can name, as its tiles give it. */
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

/**
 * A place from the map's tiles as a City: its id, where it is, and its name as the map writes it, in
 * Latin letters with its own script on a second line when it has one. None for a place without a
 * numeric id or a single point.
 */
export function cityOfPlace(place: {
  id?: string | number
  properties: Record<string, unknown>
  geometry: { type: string; coordinates?: unknown }
}): City | undefined {
  const { id, properties, geometry } = place
  if (typeof id !== 'number' || geometry.type !== 'Point') return undefined
  const [longitude, latitude] = geometry.coordinates as [number, number]
  const text = (key: string) => (typeof properties[key] === 'string' ? (properties[key] as string) : undefined)
  const nonLatin = text('name:nonlatin')
  const name = nonLatin ? `${text('name:latin') ?? ''}\n${nonLatin}` : (text('name_en') ?? text('name') ?? '')
  return { id, name, capital: properties.capital === 2, longitude, latitude }
}

/** A game's venue is named by the nearest place within this distance. */
const maxCityKm = 50

/**
 * The places named for the games: for each venue, the nearest of `cities`, however small, if it's
 * within reach. A venue far from all of them has none. Each is listed once, in the order found.
 */
export function gameCities(venues: readonly GlobePoint[], cities: readonly City[]): City[] {
  const found = new Map<number, City>()
  for (const venue of venues) {
    let nearest: City | undefined
    let nearestKm = maxCityKm
    for (const city of cities) {
      const km = kmApart(venue, city)
      if (km <= nearestKm) {
        nearest = city
        nearestKm = km
      }
    }
    if (nearest && !found.has(nearest.id)) found.set(nearest.id, nearest)
  }
  return [...found.values()]
}

/** A line's width in pixels, written in a CSS font (see CityNameLook) whose size is `size` pixels. */
export type MeasureText = (text: string, font: string, size: number) => number

/**
 * Where a game city's name is written: centred below its dot at `dot` (see placeNames' game city
 * names), wrapped as the map wraps it. `measure` gives a line's width in the name's font. The look's
 * clearance (the name's outline and a little more) is included, since the box is for keeping cards
 * clear of the name.
 */
export function cityNameBox(city: City, dot: { x: number; y: number }, look: CityNameLook, measure: MeasureText): ScreenBox {
  const { clearance } = look
  const lines = city.name.split('\n').flatMap((line) => wrap(line, look, measure))
  const width = Math.max(...lines.map((line) => lineWidth(line, look, measure))) + 2 * clearance
  const height = lines.length * lineHeight * look.size + 2 * clearance
  return { x: dot.x, y: dot.y + look.offset - clearance + height / 2, width, height }
}

// The map's line height for names, in ems.
const lineHeight = 1.2

/** A line of a name's width in pixels, its letters spaced as the look says. */
const lineWidth = (line: string, look: CityNameLook, measure: MeasureText) =>
  measure(line, look.font, look.size) + line.length * look.letterSpacing * look.size

/** Splits a line at spaces where it's wider than the map lets a name run (an approximation of MapLibre's wrapping). */
function wrap(line: string, look: CityNameLook, measure: MeasureText): string[] {
  const lines: string[] = []
  let current = ''
  for (const word of line.split(' ')) {
    const longer = current ? `${current} ${word}` : word
    if (current && lineWidth(longer, look, measure) > look.maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = longer
    }
  }
  return [...lines, current]
}
