/** A point on screen, in pixels. */
export interface Point {
  x: number
  y: number
}

/**
 * Which way a trail goes first from its card, drawn as a transit map's line: straight across (or up or
 * down) and then 45° into its venue, or 45° first and then straight.
 */
export type FirstLeg = 'straight' | 'diagonal'

// A trail within this many pixels of running straight, or at 45°, is drawn without a bend.
const nearlyStraight = 2

/**
 * A trail's corners on screen, from its card to its venue, as a transit map's line: across, up or down,
 * and at 45°, with one bend between, or none where it already runs one of those ways.
 */
export function trailCorners(from: Point, to: Point, firstLeg: FirstLeg = 'straight'): Point[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const across = Math.abs(dx)
  const down = Math.abs(dy)
  if (across < nearlyStraight || down < nearlyStraight || Math.abs(across - down) < nearlyStraight) return [from, to]
  const diagonal = Math.min(across, down)
  const bend =
    firstLeg === 'diagonal'
      ? { x: from.x + Math.sign(dx) * diagonal, y: from.y + Math.sign(dy) * diagonal }
      : across > down
        ? { x: to.x - Math.sign(dx) * diagonal, y: from.y }
        : { x: from.x, y: to.y - Math.sign(dy) * diagonal }
  return [from, bend, to]
}

// How far back from its bend, at most, a trail's rounded corner starts, in pixels; and the share of
// either piece it may take at most, so a short piece keeps a straight part.
const cornerRadius = 12
const cornerShare = 0.45
// How many straight pieces each rounded corner is drawn in.
const cornerPieces = 6

/** The points a trail is drawn through, from its card to its venue: its corners (see trailCorners), each bend rounded off. */
export function trailPoints(from: Point, to: Point, firstLeg: FirstLeg = 'straight'): Point[] {
  const corners = trailCorners(from, to, firstLeg)
  const points = [corners[0]]
  for (let i = 1; i < corners.length - 1; i++) {
    const bend = corners[i]
    const back = (toward: Point) => {
      const length = Math.hypot(toward.x - bend.x, toward.y - bend.y)
      const r = Math.min(cornerRadius, length * cornerShare)
      return { x: bend.x + ((toward.x - bend.x) / length) * r, y: bend.y + ((toward.y - bend.y) / length) * r }
    }
    // A curve from a little before the bend to a little after it, the bend pulling it round.
    const start = back(corners[i - 1])
    const end = back(corners[i + 1])
    for (let k = 0; k <= cornerPieces; k++) {
      const t = k / cornerPieces
      points.push({
        x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * bend.x + t ** 2 * end.x,
        y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * bend.y + t ** 2 * end.y,
      })
    }
  }
  points.push(corners[corners.length - 1])
  return points
}
