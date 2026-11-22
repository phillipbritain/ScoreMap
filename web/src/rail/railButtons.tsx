import type { ReactNode } from 'react'
import { GamesIcon, HomeIcon, LeaguesIcon, DisplaySettingsIcon, MoreIcon, OrbitIcon, ScenarioIcon, ZoomInIcon, ZoomOutIcon } from './railIcons'

/**
 * The rail's buttons, top to bottom: each one's name (its label and tooltip) and its icon. The rail
 * draws its buttons with these, and the welcome tour's Your controls lists them.
 */
export const railButtons = [
  { name: 'Zoom in', icon: <ZoomInIcon /> },
  { name: 'Zoom out', icon: <ZoomOutIcon /> },
  { name: 'Home', icon: <HomeIcon /> },
  { name: 'Leagues', icon: <LeaguesIcon /> },
  { name: 'Events', icon: <GamesIcon /> },
  { name: 'Orbit', icon: <OrbitIcon /> },
  { name: 'Display Settings', icon: <DisplaySettingsIcon /> },
  { name: 'More', icon: <MoreIcon /> },
] as const

/**
 * The rail's buttons a touchscreen shows (see touchPointer): all but Zoom in, Zoom out and Home, as a
 * finger pinches to zoom and drags the globe, which leaves the rail short enough on a phone for the event
 * panel to fit under it. Elsewhere, all of them. The welcome tour's Your controls lists the same.
 */
export function shownRailButtons(touch: boolean): readonly (typeof railButtons)[number][] {
  return touch ? railButtons.filter(({ name }) => !(cameraButtons as readonly string[]).includes(name)) : railButtons
}

/** The rail's buttons that move the camera, which a touchscreen leaves out (see shownRailButtons). */
const cameraButtons = ['Zoom in', 'Zoom out', 'Home'] as const

/**
 * The local-run tools' buttons, on the top rail on local runs only: Scenario, opening the scenario
 * controls. Not in railButtons, so the welcome
 * tour, which shows the live site's rail, doesn't list them.
 */
export const localRunButtons = [
  { name: 'Scenario', icon: <ScenarioIcon /> },
] as const

/** The name of one of the live site's rail buttons. */
export type LiveRailButtonName = (typeof railButtons)[number]['name']

export type RailButtonName = LiveRailButtonName | (typeof localRunButtons)[number]['name']

/** A rail button's icon, by its name. */
export function railIcon(name: RailButtonName): ReactNode {
  return [...railButtons, ...localRunButtons].find((button) => button.name === name)!.icon
}
