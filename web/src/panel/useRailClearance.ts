import { useLayoutEffect, type RefObject } from 'react'

/**
 * Keeps --rail-bottom on the globe area as how far down it the rail reaches (its buttons, not its
 * popovers), so the game panel can stop short of it (see .game-panel's max-height): its close tab sits at
 * the panel's top right, under the rail. And --rail-left-inset as how far in from the area's right edge
 * the rail's left edge is, so on a short screen the panel and the popovers can keep to the rail's left
 * instead (see "A short screen" in index.css). Kept as the rail folds and unfolds and as the screen
 * changes size, written straight to the page so nothing re-renders.
 */
export function useRailClearance(area: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const areaElement = area.current
    const rail = areaElement?.querySelector<HTMLElement>(':scope > .rail')
    if (!areaElement || !rail) return
    const update = () => {
      const areaBox = areaElement.getBoundingClientRect()
      const railBox = rail.getBoundingClientRect()
      areaElement.style.setProperty('--rail-bottom', `${Math.max(0, railBox.bottom - areaBox.top)}px`)
      areaElement.style.setProperty('--rail-left-inset', `${Math.max(0, areaBox.right - railBox.left)}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(rail)
    observer.observe(areaElement)
    return () => observer.disconnect()
  }, [area])
}
