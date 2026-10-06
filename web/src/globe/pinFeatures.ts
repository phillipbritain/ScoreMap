import type { Feature, FeatureCollection, Point } from 'geojson'
import type { Game, GameStatus, GameTeam } from '../games/game'
import { progressLine } from '../games/progressLine'

export interface PinProperties {
  gameId: string
  /** Drives the pin's style: Live most prominent, Upcoming dimmer, Final fading, Disrupted greyed out. */
  status: GameStatus
  label: string
}

export type PinFeature = Feature<Point, PinProperties>

/**
 * Turns games into the GeoJSON the globe's pin source draws: one point per game, exactly at its
 * venue. Games sharing a venue cluster while pins are small, and their score cards are moved apart
 * on screen (see cardLayout), so each stays reachable.
 */
export function pinFeatures(games: readonly Game[]): FeatureCollection<Point, PinProperties> {
  const features = games.map(
    (game): PinFeature => ({
      type: 'Feature',
      id: game.id,
      geometry: { type: 'Point', coordinates: [game.venue.longitude, game.venue.latitude] },
      properties: { gameId: game.id, status: game.status, label: label(game) },
    }),
  )
  return { type: 'FeatureCollection', features }
}

function label(game: Game): string {
  const { away, home } = game
  const teams =
    hasScore(away) && hasScore(home)
      ? `${away.abbreviation} ${away.score} – ${home.score} ${home.abbreviation}`
      : `${away.abbreviation} @ ${home.abbreviation}`
  const progress = progressLine(game, 'short')
  return progress ? `${teams}\n${progress}` : teams
}

function hasScore(team: GameTeam): boolean {
  return team.score !== null
}
