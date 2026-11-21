import type { Feature, FeatureCollection, Point } from 'geojson'
import type { Game, GameStatus } from '../games/game'
import type { PlacedGame } from '../games/placedGames'

export interface PinProperties {
  gameId: string
  /** Drives the pin's style: Live most prominent, Upcoming dimmer, Final fading. */
  status: GameStatus
  /** The game's color (see gameColor), for the pin's ring, glow and core (see smallPinLayers). */
  color: string
  /** Whether the game shows the hot indicator: a glowing outline on its small pin. */
  hotIndicator: boolean
}

export type PinFeature = Feature<Point, PinProperties>

/**
 * Turns games into the GeoJSON the globe's pin source draws: one point per game, exactly at its
 * venue, in its color (`colorOf`, see gameColor), marked if it shows the hot indicator (`hotIndicatorOf`). Games sharing a venue have
 * their score cards moved apart on screen (see cardLayout), so each stays reachable.
 */
export function pinFeatures(
  games: readonly PlacedGame[],
  colorOf: (game: Game) => string,
  hotIndicatorOf: (game: Game) => boolean,
): FeatureCollection<Point, PinProperties> {
  const features = games.map(
    (game): PinFeature => ({
      type: 'Feature',
      id: game.id,
      geometry: { type: 'Point', coordinates: [game.venue.longitude, game.venue.latitude] },
      properties: { gameId: game.id, status: game.status, color: colorOf(game), hotIndicator: hotIndicatorOf(game) },
    }),
  )
  return { type: 'FeatureCollection', features }
}
