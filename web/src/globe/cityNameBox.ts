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
  const { clearance } = look
  const lines = wrap(name, look, measure)
  const width = Math.max(...lines.map((line) => lineWidth(line, look, measure))) + 2 * clearance
  const height = lines.length * lineHeight * look.size + 2 * clearance
  return { x: dot.x, y: dot.y + look.offset - clearance + height / 2, width, height }
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
