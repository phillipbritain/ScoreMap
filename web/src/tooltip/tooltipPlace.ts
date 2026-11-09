/** A box on the screen, in pixels. */
export interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** How far a tooltip sits from what it's for, and keeps from the screen's edges, in pixels. */
export const tooltipGap = 8

/** Which side of what it's for a tooltip is on. */
export type TooltipSide = 'above' | 'below' | 'left' | 'right'

/** The side asked for: above, or level on the left or the right. */
export type TooltipPrefer = 'above' | 'left' | 'right'

/**
 * Where a tooltip goes for what it's for: centered above it, or below it where there's no room above;
 * or, where asked, level with it on its left (the rail's buttons, so it covers none of the others) or
 * its right (a game in the Games list, clear of the list), unless there's no room there. Kept on the screen.
 */
export function tooltipPlace(
  anchor: Box,
  tooltip: { width: number; height: number },
  screen: { width: number; height: number },
  prefer: TooltipPrefer = 'above',
): { left: number; top: number; side: TooltipSide } {
  const keep = (value: number, size: number, room: number) => Math.max(tooltipGap, Math.min(value, room - tooltipGap - size))
  const level = () => keep(anchor.top + anchor.height / 2 - tooltip.height / 2, tooltip.height, screen.height)
  const leftOf = anchor.left - tooltipGap - tooltip.width
  if (prefer === 'left' && leftOf >= tooltipGap) return { left: leftOf, top: level(), side: 'left' }
  const rightOf = anchor.left + anchor.width + tooltipGap
  if (prefer === 'right' && rightOf + tooltip.width <= screen.width - tooltipGap) return { left: rightOf, top: level(), side: 'right' }
  const above = anchor.top - tooltipGap - tooltip.height
  const side = above < tooltipGap ? 'below' : 'above'
  const top = side === 'below' ? anchor.top + anchor.height + tooltipGap : above
  const left = keep(anchor.left + anchor.width / 2 - tooltip.width / 2, tooltip.width, screen.width)
  return { left, top, side }
}
