import type { Game } from '../games/game'
import { statusKey } from '../globe/statusLook'
import { contrastRatio } from '../theme/palette'
import type { Theme } from '../theme/theme'
import type { ViewerSettings } from './viewerSettings'

/** The colours a viewer has picked, as their settings hold them. */
export type PickedColours = Pick<ViewerSettings, 'sportColours' | 'leagueColours'>

/** What a game's colour depends on. */
export type ColouredGame = Pick<Game, 'league' | 'sport' | 'status'>

/**
 * The colour a game shows in wherever it's drawn: its small pin, its score card, its trail, its
 * pulses and the game panel. The colour the viewer picked for it (see pickedColour), else the theme's
 * colour for its status. Colour stands for the game's league or sport, not its status (ADR-0012, ADR-0017), so
 * a picked colour stays the same whatever the status; but a Disrupted game always greys out, in the
 * theme's Disrupted colour.
 */
export function gameColour(colours: PickedColours, game: ColouredGame, theme: Theme): string {
  return pickedColour(colours, game) ?? theme.palette[statusKey(game.status)].main
}

/**
 * The colour of text written on a game's colour (the game panel's progress line, say): whichever of
 * the theme's light text and dark surface stands out from it more, so it stays readable whatever colour
 * the viewer picks.
 */
export function textOn(colour: string, theme: Theme): string {
  const light = theme.palette.text.primary
  const dark = theme.palette.background.paper
  return contrastRatio(colour, dark) > contrastRatio(colour, light) ? dark : light
}

/**
 * The colour the viewer picked for a game: its league's, else its sport's, so a league they've never
 * seen takes its sport's colour. Null when they picked neither, and for a
 * Disrupted game, which keeps the theme's look.
 */
export function pickedColour(colours: PickedColours, game: ColouredGame): string | null {
  if (game.status === 'Disrupted') return null
  return colours.leagueColours[game.league] ?? colours.sportColours[game.sport] ?? null
}
