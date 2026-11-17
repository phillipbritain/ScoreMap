import type { ScreenBox } from '../globe/panelClearance'

/**
 * Where the game panel sits on the page once it has opened: its box with no slide (see game-panel-in),
 * though it may still be sliding in. Measured as it opens, so the globe can bring the selected game clear
 * of it while it slides in, its box on screen would still be below the screen's foot.
 */
export function panelBox(panel: HTMLElement): ScreenBox {
  const parent = panel.offsetParent
  if (!parent) return panel.getBoundingClientRect()
  // The panel's own place in its parent, before its transform and its slide; then its transform (how it's
  // centered) back on, as a translation, all the panel's transform is.
  const origin = parent.getBoundingClientRect()
  const transform = getComputedStyle(panel).transform
  const { e, f } = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform)
  const left = origin.left + parent.clientLeft + panel.offsetLeft + e
  const top = origin.top + parent.clientTop + panel.offsetTop + f
  return { left, top, right: left + panel.offsetWidth, bottom: top + panel.offsetHeight }
}
