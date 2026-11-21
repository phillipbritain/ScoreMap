/**
 * Swiping the event panel down to close it on a phone, where it's a bottom sheet: what makes a press a
 * drag, how far the panel follows it, and whether letting go closes it. See useSwipeToClose for the
 * gesture on the page.
 */

/** Where the pointer was, and when (ms). */
export interface DragSample {
  y: number
  t: number
}

/** How far (px) a press moves before it counts as a drag rather than a tap. */
export const dragSlop = 8
/** Let go past this share of the panel's height and it closes. */
export const closeShare = 0.3
/** Let go moving down faster than this (px/ms), a flick, and it closes however short the drag. */
export const flickSpeed = 0.5
/** How far back (ms) from the last move the speed at letting go is measured over. */
const speedWindow = 150
/** How much of a drag upward the panel follows, giving a little and stopping as a sheet at its top does. */
const upwardGive = 0.15

/**
 * What a press that has moved (dx, dy) from where it started is: still a tap, unless it moves further;
 * a drag down, which the panel follows; or not a drag at all (it went sideways first, or up), left to
 * whatever is under it.
 */
export function pressMove(dx: number, dy: number): 'tap' | 'drag' | 'not-a-drag' {
  if (Math.abs(dx) <= dragSlop && Math.abs(dy) <= dragSlop) return 'tap'
  if (dy > dragSlop && dy >= Math.abs(dx)) return 'drag'
  return 'not-a-drag'
}

/** How far down (px) the panel sits for a drag dy from where it started: all of it down, a little up. */
export function panelOffset(dy: number): number {
  return dy >= 0 ? dy : dy * upwardGive
}

/** How fast (px/ms, down positive) the pointer was moving at the last sample, over the moves just before it. */
export function downwardSpeed(samples: readonly DragSample[]): number {
  const last = samples.at(-1)
  if (!last) return 0
  const first = samples.find((sample) => last.t - sample.t <= speedWindow) ?? last
  return last.t === first.t ? 0 : (last.y - first.y) / (last.t - first.t)
}

/**
 * Whether letting go of a drag dy down, moving at speed, closes a panel height tall: past closeShare of
 * its height, or flicked down. Otherwise it springs back.
 */
export function closesOnRelease(dy: number, speed: number, height: number): boolean {
  return dy > closeShare * height || (dy > dragSlop && speed > flickSpeed)
}
