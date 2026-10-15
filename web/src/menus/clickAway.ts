import { useEffect, useRef } from 'react'

/** How far, in pixels, a press can move and still count as a click rather than a drag. */
const clickSlop = 5

/** Where a press went down, and whether it was away from the menu. */
export interface Press {
  x: number
  y: number
  away: boolean
}

/**
 * Whether a click closes a menu: it went down and came up away from the menu without moving, so
 * dragging the globe (or pinching, or zooming with the wheel, which make no click) leaves it open.
 */
export function isClickAway(press: Press | null, up: { x: number; y: number; away: boolean }): boolean {
  return press !== null && press.away && up.away && Math.hypot(up.x - press.x, up.y - press.y) <= clickSlop
}

/**
 * Calls onAway while a menu is open, on a click away from it: not on one inside it (as `inside`
 * says), nor on the local-run tools or the rail's camera buttons ([data-keeps-popovers]), nor on a
 * drag, so turning or zooming the globe keeps it open. In the capture phase, so the globe can't keep
 * a click on it from closing the menu.
 */
export function useClickAway(open: boolean, inside: (target: Element) => boolean, onAway: () => void): void {
  // The latest of each, so the listeners added on opening needn't be added again as they change.
  const latest = useRef({ inside, onAway })
  useEffect(() => {
    latest.current = { inside, onAway }
  })

  useEffect(() => {
    if (!open) return
    let press: Press | null = null
    const away = (target: EventTarget | null) =>
      target instanceof Element && !target.closest('[data-keeps-popovers]') && !latest.current.inside(target)
    const onPointerDown = (event: PointerEvent) => {
      press = { x: event.clientX, y: event.clientY, away: away(event.target) }
    }
    const onClick = (event: MouseEvent) => {
      if (isClickAway(press, { x: event.clientX, y: event.clientY, away: away(event.target) })) latest.current.onAway()
      press = null
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('click', onClick, true)
    }
  }, [open])
}
