import type { Feature, FeatureCollection, Point } from 'geojson'
import type { Game, GameStatus } from '../games/game'

export interface PinProperties {
  gameId: string
  /** Drives the pin's style: Live most prominent, Upcoming dimmer, Final fading, Disrupted greyed out. */
  status: GameStatus
  /** The game's colour (see gameColour), for the pin's ring, glow and core (see smallPinLayers). */
  color: string
}

export type PinFeature = Feature<Point, PinProperties>

/**
 * Turns games into the GeoJSON the globe's pin source draws: one point per game, exactly at its
 * venue, in its colour (`colourOf`, see gameColour). Games sharing a venue cluster while pins are
 * small, and their score cards are moved apart on screen (see cardLayout), so each stays reachable.
 */
export function pinFeatures(games: readonly Game[], colourOf: (game: Game) => string): FeatureCollection<Point, PinProperties> {
  const features = games.map(
    (game): PinFeature => ({
      type: 'Feature',
      id: game.id,
      geometry: { type: 'Point', coordinates: [game.venue.longitude, game.venue.latitude] },
      properties: { gameId: game.id, status: game.status, color: colourOf(game) },
    }),
  )
  return { type: 'FeatureCollection', features }
}
