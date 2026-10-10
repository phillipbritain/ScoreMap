/** A box on screen, in pixels. */
export interface ScreenBox {
  left: number
  top: number
  right: number
  bottom: number
}

/** How far a small pin's selection ring reaches from its venue (its radius and stroke). */
export const smallPinReach = 16

/** Room left between a selected pin and the game panel below it. */
export const panelGap = 16

/**
 * How far to lift the globe so a selected pin (its small pin, or its score card and the venue it
 * points to) sits clear of the game panel, with a gap above it: no further than that, and not at
 * all when the panel doesn't cover it, so selecting a game leaves the globe still where it can.
 */
export function liftClearOf(pin: ScreenBox, panel: ScreenBox | null): number {
  if (!panel || pin.right < panel.left || pin.left > panel.right || pin.top >= panel.bottom) return 0
  return Math.max(0, pin.bottom + panelGap - panel.top)
}
