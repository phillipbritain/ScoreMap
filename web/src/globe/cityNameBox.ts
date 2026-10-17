import type { CityNameLook } from './placeNames'

/** A box on screen, in pixels, by its centre. */
export interface ScreenBox {
  x: number
  y: number
  width: number
  height: number
}

/** A line's width in pixels, written in a CSS font (see CityNameLook) whose size is `size` pixels. */
export type MeasureText = (text: string, font: string, size: number) => number

/**
 * Where a game city's name is written: centred below its dot at `dot` (see placeNames' game city
 * names), wrapped as the map wraps it. `measure` gives a line's width in the name's font. The look's
 * clearance (the name's outline and a little more) is included, since the box is for keeping cards
 * clear of the name.
 */
export function cityNameBox(name: string, dot: { x: number; y: number }, look: CityNameLook, measure: MeasureText): ScreenBox {
  return cityNameBoxOfSize(dot, look, cityNameSize(name, look, measure))
}

/** How big a game city's name's box is (see cityNameBox), wherever it's written. */
export interface CityNameSize {
  width: number
  height: number
}

/** How big a game city's name's box is, as cityNameBox works it out. */
export function cityNameSize(name: string, look: CityNameLook, measure: MeasureText): CityNameSize {
  const { clearance } = look
  const lines = wrap(name, look, measure)
  const width = Math.max(...lines.map((line) => lineWidth(line, look, measure))) + 2 * clearance
  const height = lines.length * lineHeight * look.size + 2 * clearance
  return { width, height }
}

/** Where a game city's name of this size is written, below its dot at `dot` (see cityNameBox). */
export function cityNameBoxOfSize(dot: { x: number; y: number }, look: CityNameLook, { width, height }: CityNameSize): ScreenBox {
  return { x: dot.x, y: dot.y + look.offset - look.clearance + height / 2, width, height }
}

// The map's line height for names, in ems.
const lineHeight = 1.2

/** A line of a name's width in pixels, its letters spaced as the look says. */
const lineWidth = (line: string, look: CityNameLook, measure: MeasureText) =>
  measure(line, look.font, look.size) + line.length * look.letterSpacing * look.size

/** Splits a name at spaces where it's wider than the map lets a name run (an approximation of MapLibre's wrapping). */
function wrap(name: string, look: CityNameLook, measure: MeasureText): string[] {
  const lines: string[] = []
  let current = ''
  for (const word of name.split(' ')) {
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
