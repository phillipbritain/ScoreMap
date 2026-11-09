import type { Game } from '../games/game'
import { statusKey, type Theme } from '../theme/theme'
import type { ViewerSettings } from './viewerSettings'

/** The colors a viewer has picked, as their settings hold them. */
export type PickedColors = Pick<ViewerSettings, 'sportColors' | 'leagueColors'>

/** What a game's color depends on. */
export type ColoredGame = Pick<Game, 'league' | 'sport' | 'status'>

/**
 * The color a game shows in wherever it's drawn: its small pin, its score card, its trail, its
 * pulses and the game panel. The color the viewer picked for it (see pickedColor), else the theme's
 * color for its status. Color stands for the game's league or sport, not its status (ADR-0012, ADR-0017), so
 * a picked color stays the same whatever the status.
 */
export function gameColor(colors: PickedColors, game: ColoredGame, theme: Theme): string {
  return pickedColor(colors, game) ?? theme.palette[statusKey(game.status)].main
}

/**
 * The colors a viewer can pick for a sport or league, in the rail's Display Settings: ten hues round the
 * wheel, each light and deeper, worked out in OKLCH at the dark theme's lightness and chroma so they
 * sit with its gold (whose 300 and 500 steps are the amber pair) and stand out on its navy globe.
 */
export const pickableColors = [
  ['#febab4', '#ffbd99', '#f3ca81', '#cbd591', '#a4dfaf', '#85e1d5', '#87dcf7', '#aed1fe', '#d1c4fe', '#f3b8e5'],
  ['#eb827b', '#e58b55', '#d4ac63', '#a2ae44', '#62bb78', '#08beaf', '#09b7dc', '#6aa7f4', '#ab93ed', '#d684c5'],
].flat()

/**
 * The theme's accent: Live's color. A cluster of games of different colors shows in it, and the
 * rail's Display Settings shows it for a sport with no color picked, whose games take the theme's color for
 * their status.
 */
export const accentColor = (theme: Theme): string => theme.palette.live.main

/**
 * The color the viewer picked for a game: its league's, else its sport's, so a league they've never
 * seen takes its sport's color. Null when they picked neither.
 */
export function pickedColor(colors: PickedColors, game: ColoredGame): string | null {
  return colors.leagueColors[game.league] ?? colors.sportColors[game.sport] ?? null
}
