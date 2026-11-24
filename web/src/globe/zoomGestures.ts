import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl'

/** How far apart the two clicks or taps can be, in screen pixels. */
export const zoomGestureDistance = 12

/** Gives MapLibre's built-in double-click and double-tap zoom the same proximity as double-right-click. */
export function constrainDoubleClickZoom(map: MapLibreMap): () => void {
  let lastClick: MapMouseEvent['point'] | undefined
  let nearbyClicks = false
  const rememberClick = ({ originalEvent, point }: MapMouseEvent) => {
    if (originalEvent.button !== 0) return
    nearbyClicks = lastClick !== undefined && lastClick.dist(point) <= zoomGestureDistance
    lastClick = point
  }
  const checkDoubleClick = (event: MapMouseEvent) => {
    if (!nearbyClicks) event.preventDefault()
    lastClick = undefined
    nearbyClicks = false
  }

  let lastTouch: Touch | undefined
  const checkTap = ({ touches }: TouchEvent) => {
    const touch = touches.length === 1 ? touches[0] : undefined
    if (touch && lastTouch && Math.hypot(touch.clientX - lastTouch.clientX, touch.clientY - lastTouch.clientY) > zoomGestureDistance) {
      // Reset the tap recognizer before MapLibre sees the new touch. Other touch handlers can still
      // use it for a pan or pinch, and this touch can start a new double tap.
      map.doubleClickZoom._tapZoom.touchcancel()
    }
    lastTouch = touch
  }
  const canvas = map.getCanvasContainer()
  canvas.addEventListener('touchstart', checkTap, { capture: true, passive: true })
  map.on('click', rememberClick)
  map.on('dblclick', checkDoubleClick)
  return () => {
    canvas.removeEventListener('touchstart', checkTap, true)
    map.off('click', rememberClick)
    map.off('dblclick', checkDoubleClick)
  }
}
