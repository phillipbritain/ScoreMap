import type { ScreenOffset } from './cardLayout'
import type { Point } from './trailRoute'

/**
 * Where a card's trail meets it, in pixels from the card's top left, for the dot drawn there (the
 * page's CSS): the trail's start, given from the card's venue, as the card sits `offset` from its
 * venue (its bottom middle; see CardPlacement).
 */
export function cardDotAt(start: ScreenOffset, offset: ScreenOffset, { width, height }: { width: number; height: number }): Point {
  return { x: start.dx - offset.dx + width / 2, y: start.dy - offset.dy + height }
}
