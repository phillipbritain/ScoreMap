import type { ReactNode } from 'react'
import { DisruptedIcon, HomeIcon, LeaguesIcon, LiveIcon, PaletteIcon, ZoomInIcon, ZoomOutIcon } from './railIcons'

/**
 * The rail's buttons, top to bottom: each one's name (its label and tooltip) and its icon. The rail
 * draws its buttons with these, and the welcome tour's Your controls lists them.
 */
export const railButtons = [
  { name: 'Zoom in', icon: <ZoomInIcon /> },
  { name: 'Zoom out', icon: <ZoomOutIcon /> },
  { name: 'Home', icon: <HomeIcon /> },
  { name: 'Live games only', icon: <LiveIcon /> },
  { name: 'Show Disrupted games', icon: <DisruptedIcon /> },
  { name: 'Leagues', icon: <LeaguesIcon /> },
  { name: 'Display Settings', icon: <PaletteIcon /> },
] as const

export type RailButtonName = (typeof railButtons)[number]['name']

/** A rail button's icon, by its name. */
export function railIcon(name: RailButtonName): ReactNode {
  return railButtons.find((button) => button.name === name)!.icon
}
