import { useLayoutEffect, type RefObject } from 'react'

/**
 * Keeps --rail-bottom on the globe area as how far down it the rail reaches (its buttons, not its
 * popovers), so the game panel can stop short of it (see .game-panel's max-height): its close tab sits at
 * the panel's top right, under the rail. Kept as the rail folds and unfolds and as the screen changes size,
 * written straight to the page so nothing re-renders.
 */
export function useRailClearance(area: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const areaElement = area.current
    const rail = areaElement?.querySelector<HTMLElement>(':scope > .rail')
    if (!areaElement || !rail) return
    const update = () => {
      const bottom = rail.getBoundingClientRect().bottom - areaElement.getBoundingClientRect().top
      areaElement.style.setProperty('--rail-bottom', `${Math.max(0, bottom)}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(rail)
    observer.observe(areaElement)
    return () => observer.disconnect()
  }, [area])
}
