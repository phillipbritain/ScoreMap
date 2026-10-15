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
export type TooltipSide = 'above' | 'below' | 'left'

/**
 * Where a tooltip goes for what it's for: centred above it, or below it where there's no room above;
 * or, where asked (the rail's buttons, so it covers none of the others), level with it on its left,
 * unless there's no room there. Kept on the screen.
 */
export function tooltipPlace(
  anchor: Box,
  tooltip: { width: number; height: number },
  screen: { width: number; height: number },
  prefer: 'above' | 'left' = 'above',
): { left: number; top: number; side: TooltipSide } {
  const keep = (value: number, size: number, room: number) => Math.max(tooltipGap, Math.min(value, room - tooltipGap - size))
  const leftOf = anchor.left - tooltipGap - tooltip.width
  if (prefer === 'left' && leftOf >= tooltipGap) {
    const top = keep(anchor.top + anchor.height / 2 - tooltip.height / 2, tooltip.height, screen.height)
    return { left: leftOf, top, side: 'left' }
  }
  const above = anchor.top - tooltipGap - tooltip.height
  const side = above < tooltipGap ? 'below' : 'above'
  const top = side === 'below' ? anchor.top + anchor.height + tooltipGap : above
  const left = keep(anchor.left + anchor.width / 2 - tooltip.width / 2, tooltip.width, screen.width)
  return { left, top, side }
}
