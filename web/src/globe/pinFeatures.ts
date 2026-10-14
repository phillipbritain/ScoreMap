import type { Feature, FeatureCollection, Point } from 'geojson'
import type { Game, GameStatus } from '../games/game'
import { gameColour, pickedColour, type PickedColours } from '../settings/gameColour'
import type { Theme } from '../theme/theme'
import { statusLook } from './statusLook'

export interface PinProperties {
  gameId: string
  /** Drives the pin's style: Live most prominent, Upcoming dimmer, Final fading, Disrupted greyed out. */
  status: GameStatus
  /** The game's colour (see gameColour), for the pin's ring and glow. */
  color: string
  /**
   * The colour of the pin's bright core: the colour the viewer picked for its game, or with none, the
   * theme's core colour for its status.
   */
  coreColor: string
}

export type PinFeature = Feature<Point, PinProperties>

/**
 * Turns games into the GeoJSON the globe's pin source draws: one point per game, exactly at its
 * venue, in its colour from the viewer's picked colours and the theme. Games sharing a venue cluster
 * while pins are small, and their score cards are moved apart on screen (see cardLayout), so each
 * stays reachable.
 */
export function pinFeatures(
  games: readonly Game[],
  colours: PickedColours,
  theme: Theme,
): FeatureCollection<Point, PinProperties> {
  const features = games.map(
    (game): PinFeature => ({
      type: 'Feature',
      id: game.id,
      geometry: { type: 'Point', coordinates: [game.venue.longitude, game.venue.latitude] },
      properties: {
        gameId: game.id,
        status: game.status,
        color: gameColour(colours, game, theme),
        coreColor: pickedColour(colours, game) ?? statusLook(theme, game.status).core.color,
      },
    }),
  )
  return { type: 'FeatureCollection', features }
}
