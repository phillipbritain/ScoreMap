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

/** Room between the tip of the arrow's head and what it points at: clear of the spotlight's hole. */
export const endGap = spotlightPadding + 6

/** The length of the arrow's head, from its base to its tip, in pixels. */
export const headLength = 15

/**
 * The straight run of line before the head, in pixels: the curve has turned by then, so the head
 * lines up with the line that leads into it. Longer than one of the line's dashes and its gap.
 */
export const straightRun = 20

/**
 * How far out past the straight run's start, the way the head points, the arrow starts at the least,
 * where it starts from the panel's top or bottom to end at a side: room for one smooth turn rather
 * than a hook back. Kept this far in from the panel's corners.
 */
const swing = 30
const cornerInset = 24

/** The pull of the arrow's ends along the way they face, as a share of the distance it runs. */
const bend = 0.45

/**
 * A step's arrow: where it starts, where its head's tip ends, and its line's path (an SVG path's
 * `d`), which ends at the head's base, where the head is drawn on (pointing the way the line ends).
 */
export interface TourArrow {
  from: ScreenPoint
  to: ScreenPoint
  path: string
}

/**
 * The welcome tour's arrow from a step's panel to what it points at (the rail, a score card): from
 * the middle of the panel's edge facing the target, a little out from it, to the middle of the
 * target's edge facing the panel, clear of its spotlight, curving out of the one and into the
 * other square to their edges. The curve turns before the end: a straight run leads into the head,
 * whose tip stops short of the spotlight. Both boxes are in the same pixels the arrow is drawn in.
 *
 * Ending at the target's `side`, it comes in at whichever of its left and right faces the panel's
 * middle, wherever the target is: a score card's teams, as its bottom is where its trail runs.
 * Starting at the panel's `top`, it leaves from the middle of its top edge, wherever the target is.
 */
export function tourArrow(
  panel: ScreenBox,
  target: ScreenBox,
  endAt: 'facing' | 'side' = 'facing',
  startAt: 'facing' | 'top' = 'facing',
): TourArrow {
  const start = startAt === 'top' ? topOf(panel) : edgeFacing(panel, middleOf(target))
  const end = endAt === 'side' ? sideFacing(target, middleOf(panel)) : edgeFacing(target, middleOf(panel))
  const out = (distance: number) => ({ x: end.point.x + end.out.x * distance, y: end.point.y + end.out.y * distance })
  const to = out(endGap)
  const base = out(endGap + headLength)
  const turned = out(endGap + headLength + straightRun)
  if (start.out.x === 0 && end.out.y === 0) start.point.x = swungOut(start.point.x, turned.x + end.out.x * swing, end.out.x, panel)
  const from = { x: start.point.x + start.out.x * startGap, y: start.point.y + start.out.y * startGap }
  const pull = bend * Math.hypot(turned.x - from.x, turned.y - from.y)
  const c1 = { x: from.x + start.out.x * pull, y: from.y + start.out.y * pull }
  const c2 = { x: turned.x + end.out.x * pull, y: turned.y + end.out.y * pull }
  return {
    from,
    to,
    path: `M${from.x} ${from.y} C${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${turned.x} ${turned.y} L${base.x} ${base.y}`,
  }
}

/**
 * Where along the panel's top or bottom edge an arrow ending at a side starts: where it would, unless
 * that's short of `least` (the way `way` faces), then there, as far as the panel's corners allow.
 */
function swungOut(x: number, least: number, way: number, panel: ScreenBox): number {
  const swung = way > 0 ? Math.max(x, least) : Math.min(x, least)
  return Math.min(Math.max(swung, panel.left + cornerInset), panel.right - cornerInset)
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

/** The middle of a box. */
export function middleOf(box: ScreenBox): ScreenPoint {
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
  if (Math.abs(dx) / width > Math.abs(dy) / height) return sideFacing(box, toward)
  return dy > 0
    ? { point: { x: middle.x, y: box.bottom }, out: { x: 0, y: 1 } }
    : { point: { x: middle.x, y: box.top }, out: { x: 0, y: -1 } }
}

/** The middle of a box's top edge, and the way out of it. */
function topOf(box: ScreenBox): { point: ScreenPoint; out: ScreenPoint } {
  return { point: { x: middleOf(box).x, y: box.top }, out: { x: 0, y: -1 } }
}

/** The middle of a box's left or right edge, whichever faces a point, and the way out of it. */
function sideFacing(box: ScreenBox, toward: ScreenPoint): { point: ScreenPoint; out: ScreenPoint } {
  const middle = middleOf(box)
  return toward.x > middle.x
    ? { point: { x: box.right, y: middle.y }, out: { x: 1, y: 0 } }
    : { point: { x: box.left, y: middle.y }, out: { x: -1, y: 0 } }
}
