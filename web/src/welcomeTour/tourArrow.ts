import type { ScreenBox } from '../globe/panelClearance'

/** A point on screen, in pixels. */
export interface ScreenPoint {
  x: number
  y: number
}

/** How far the spotlight's hole reaches past what it lights, on each side. */
export const spotlightPadding = 8

/** Room between the panel's edge and the arrow's start. */
const startGap = 8

/** Room between the arrow's head and what it points at: clear of the spotlight's hole. */
const endGap = spotlightPadding + 6

/** The pull of the arrow's ends along the way they face, as a share of the distance it runs. */
const bend = 0.45

/** A step's arrow: where it starts and ends, and its path (an SVG path's `d`). */
export interface TourArrow {
  from: ScreenPoint
  to: ScreenPoint
  path: string
}

/**
 * The welcome tour's arrow from a step's panel to what it points at (the rail, a score card): from
 * the middle of the panel's edge facing the target, a little out from it, to the middle of the
 * target's edge facing the panel, clear of its spotlight, curving out of the one and into the
 * other square to their edges. Both boxes are in the same pixels the arrow is drawn in.
 */
export function tourArrow(panel: ScreenBox, target: ScreenBox): TourArrow {
  const start = edgeFacing(panel, middleOf(target))
  const end = edgeFacing(target, middleOf(panel))
  const from = { x: start.point.x + start.out.x * startGap, y: start.point.y + start.out.y * startGap }
  const to = { x: end.point.x + end.out.x * endGap, y: end.point.y + end.out.y * endGap }
  const pull = bend * Math.hypot(to.x - from.x, to.y - from.y)
  const c1 = { x: from.x + start.out.x * pull, y: from.y + start.out.y * pull }
  const c2 = { x: to.x + end.out.x * pull, y: to.y + end.out.y * pull }
  return { from, to, path: `M${from.x} ${from.y} C${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}` }
}

/** The box around several boxes (the rail's groups), or null for none. */
export function boxAround(boxes: readonly ScreenBox[]): ScreenBox | null {
  if (boxes.length === 0) return null
  return {
    left: Math.min(...boxes.map((box) => box.left)),
    top: Math.min(...boxes.map((box) => box.top)),
    right: Math.max(...boxes.map((box) => box.right)),
    bottom: Math.max(...boxes.map((box) => box.bottom)),
  }
}

function middleOf(box: ScreenBox): ScreenPoint {
  return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 }
}

/**
 * The middle of a box's edge that faces a point, and the way out of it. Which edge is weighed by the
 * box's shape, so a wide panel points from its side only at what is well off to that side.
 */
function edgeFacing(box: ScreenBox, toward: ScreenPoint): { point: ScreenPoint; out: ScreenPoint } {
  const middle = middleOf(box)
  const dx = toward.x - middle.x
  const dy = toward.y - middle.y
  const width = Math.max(box.right - box.left, 1)
  const height = Math.max(box.bottom - box.top, 1)
  if (Math.abs(dx) / width > Math.abs(dy) / height) {
    return dx > 0
      ? { point: { x: box.right, y: middle.y }, out: { x: 1, y: 0 } }
      : { point: { x: box.left, y: middle.y }, out: { x: -1, y: 0 } }
  }
  return dy > 0
    ? { point: { x: middle.x, y: box.bottom }, out: { x: 0, y: 1 } }
    : { point: { x: middle.x, y: box.top }, out: { x: 0, y: -1 } }
}
