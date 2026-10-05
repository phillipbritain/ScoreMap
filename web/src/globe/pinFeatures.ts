import type { Feature, FeatureCollection, Point } from 'geojson'
import type { Game, GameTeam } from '../games/game'

export interface PinProperties {
  gameId: string
  label: string
}

export type PinFeature = Feature<Point, PinProperties>

/** Turns games into the GeoJSON the globe's pin source draws: one point per game at its venue. */
export function pinFeatures(games: readonly Game[]): FeatureCollection<Point, PinProperties> {
  return {
    type: 'FeatureCollection',
    features: games.map(
      (game): PinFeature => ({
        type: 'Feature',
        id: game.id,
        geometry: { type: 'Point', coordinates: [game.venue.longitude, game.venue.latitude] },
        properties: { gameId: game.id, label: label(game) },
      }),
    ),
  }
}

function label({ away, home }: Game): string {
  return hasScore(away) && hasScore(home)
    ? `${away.abbreviation} ${away.score} – ${home.score} ${home.abbreviation}`
    : `${away.abbreviation} @ ${home.abbreviation}`
}

function hasScore(team: GameTeam): boolean {
  return team.score !== null
}
