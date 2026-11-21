/** A box on screen, in pixels. */
export interface ScreenBox {
  left: number
  top: number
  right: number
  bottom: number
}

/** How far a small pin's selection ring reaches from its venue (its radius and stroke). */
export const smallPinReach = 16

/**
 * Where on the page a game picked from the Games list is centered: the middle of the globe (its box on the
 * page) above the event panel, a strip across its bottom; or of the whole globe with no panel, or one that
 * leaves no room above it.
 */
export function clearCenter(globe: ScreenBox, panel: ScreenBox | null): { x: number; y: number } {
  const x = (globe.left + globe.right) / 2
  if (!panel || panel.top <= globe.top || panel.top >= globe.bottom) return { x, y: (globe.top + globe.bottom) / 2 }
  return { x, y: (globe.top + panel.top) / 2 }
}
