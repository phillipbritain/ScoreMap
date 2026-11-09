import type { Camera } from '../globe/camera'
import { furthestOutZoom, zoomSettings, type ZoomSettings } from '../globe/zoomLevels'

/**
 * How close to a zoom limit counts as at it: MapLibre stops a hair short of a limit it eases to, and
 * a step that far would do nothing anyone could see.
 */
const atLimit = 0.01

/**
 * Whether the rail's zoom buttons can step in and out from here: not at the furthest in the globe
 * goes, nor at the furthest out, which depends on the view's latitude (see furthestOutZoom).
 */
export function canZoom({ latitude, zoom }: Camera, limits: ZoomSettings = zoomSettings): { in: boolean; out: boolean } {
  return { in: zoom < limits.maxZoom - atLimit, out: zoom > furthestOutZoom(latitude, limits.minZoom) + atLimit }
}

/**
 * The rail's popovers: Leagues (which leagues show), Display Settings (the colours picked for them,
 * and whether hot games show flames), Map Type (the plain map or the satellite
 * map) and Games (every game shown, to find one and go to it).
 */
export type RailPopover = 'leagues' | 'display' | 'mapType' | 'games'

/** What opens or closes a popover: its button pressed, Escape, or a click outside the open one. */
export type PopoverEvent<P extends string = RailPopover> = { press: P } | 'escape' | 'outside'

/**
 * The popover open after this, if any. One is open at a time: a popover's button opens it, closing
 * the other, or closes it if it's open already. Escape or a click outside closes it.
 */
export function nextPopover<P extends string = RailPopover>(open: P | null, event: PopoverEvent<P>): P | null {
  if (typeof event === 'string') return null
  return open === event.press ? null : event.press
}
