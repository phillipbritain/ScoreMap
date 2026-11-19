import type { ScreenBox } from './cityNameBox'

/** A game's city's name where it would be written on screen. */
export interface NameOnScreen {
  /** The same for the same city from frame to frame, whatever else is named. */
  key: string
  population: number
  box: ScreenBox
}

/**
 * Which of the games' cities' names to write, by key: each, most populous first, unless a name
 * already written overlaps it. Each is sticky by `margin` pixels, from whether it was written
 * `before`: a name written stays until a written name overlaps it by more than the margin, and a name
 * left out comes back only once it clears every written name by more than the margin, so a pan
 * moving names a fraction of a pixel never flips one. A name not seen before is written whenever it
 * clears the names written.
 */
export function writtenNames(names: readonly NameOnScreen[], before: ReadonlyMap<string, boolean>, margin: number): Map<string, boolean> {
  const byPopulation = [...names].sort((a, b) => b.population - a.population || a.key.localeCompare(b.key))
  const placed: ScreenBox[] = []
  const now = new Map<string, boolean>()
  for (const { key, box } of byPopulation) {
    const was = before.get(key)
    // How far it must clear the names written: less than nothing (overlapping by the margin) if it was written.
    const clearBy = was === true ? -margin : was === false ? margin : 0
    const writes = placed.every((other) => clearance(box, other) > clearBy)
    now.set(key, writes)
    if (writes) placed.push(box)
  }
  return now
}

/** How far apart two boxes are, in pixels, along the axis they're furthest apart on: less than 0 where they overlap, by how much. */
function clearance(a: ScreenBox, b: ScreenBox): number {
  const across = Math.abs(a.x - b.x) - (a.width + b.width) / 2
  const down = Math.abs(a.y - b.y) - (a.height + b.height) / 2
  return Math.max(across, down)
}
