import type { Camera } from '../globe/camera'
import { furthestOutZoom, maxZoom } from '../globe/zoomLevels'
import type { ViewerSettings } from '../settings/viewerSettings'

/**
 * How close to a zoom limit counts as at it: MapLibre stops a hair short of a limit it eases to, and
 * a step that far would do nothing anyone could see.
 */
const atLimit = 0.01

/**
 * Whether the rail's zoom buttons can step in and out from here: not at the furthest in the globe
 * goes, nor at the furthest out, which depends on the view's latitude (see furthestOutZoom).
 */
export function canZoom({ latitude, zoom }: Camera): { in: boolean; out: boolean } {
  return { in: zoom < maxZoom - atLimit, out: zoom > furthestOutZoom(latitude) + atLimit }
}

/** The rail's two toggles, in order, by the setting each switches and its name. */
export const railToggles = [
  { key: 'liveOnly', name: 'Live games only' },
  { key: 'showDisrupted', name: 'Show Disrupted games' },
] as const

export type RailToggle = (typeof railToggles)[number]['key']

/** The settings with one of the rail's toggles switched, and the toast saying what changed ("Live games only: on"). */
export function toggled(settings: ViewerSettings, key: RailToggle): { settings: ViewerSettings; toast: string } {
  const on = !settings[key]
  const name = railToggles.find((toggle) => toggle.key === key)!.name
  return { settings: { ...settings, [key]: on }, toast: `${name}: ${on ? 'on' : 'off'}` }
}

/** The rail's popovers: Leagues (which leagues show) and Colours (the colours picked for them). */
export type RailPopover = 'leagues' | 'colours'

/** What opens or closes a popover: its button pressed, Escape, or a click outside the open one. */
export type PopoverEvent = { press: RailPopover } | 'escape' | 'outside'

/**
 * The popover open after this, if any. One is open at a time: a popover's button opens it, closing
 * the other, or closes it if it's open already. Escape or a click outside closes it.
 */
export function nextPopover(open: RailPopover | null, event: PopoverEvent): RailPopover | null {
  if (typeof event === 'string') return null
  return open === event.press ? null : event.press
}
