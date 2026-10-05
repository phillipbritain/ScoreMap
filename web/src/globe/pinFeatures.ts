import type { Feature, FeatureCollection, Point } from 'geojson'
import type { Game, GameStatus, GameTeam } from '../games/game'
import { fanOutColocated } from './colocatedPins'

export interface PinProperties {
  gameId: string
  /** Drives the pin's style: Live most prominent, Upcoming dimmer, Final fading, Disrupted greyed out. */
  status: GameStatus
  label: string
}

export type PinFeature = Feature<Point, PinProperties>

/**
 * Turns games into the GeoJSON the globe's pin source draws: one point per game at its venue,
 * with games sharing a spot fanned out around it so each stays reachable.
 */
export function pinFeatures(games: readonly Game[]): FeatureCollection<Point, PinProperties> {
  const atVenues = games.map(
    (game): PinFeature => ({
      type: 'Feature',
      id: game.id,
      geometry: { type: 'Point', coordinates: [game.venue.longitude, game.venue.latitude] },
      properties: { gameId: game.id, status: game.status, label: label(game) },
    }),
  )
  return { type: 'FeatureCollection', features: fanOutColocated(atVenues) }
}

function label(game: Game): string {
  const { away, home } = game
  const teams =
    hasScore(away) && hasScore(home)
      ? `${away.abbreviation} ${away.score} – ${home.score} ${home.abbreviation}`
      : `${away.abbreviation} @ ${home.abbreviation}`
  const clock = clockLine(game)
  return clock ? `${teams}\n${clock}` : teams
}

/**
 * The short clock line under a game's score: the clock while Live, "Delayed" in its place, the final
 * line, or the kind of disruption ("Postponed").
 */
export function clockLine({ status, delayed, disruption, clock }: Game): string | null {
  // The server writes the final line in the sport's style ("Final/OT", "FT", "AET").
  if (status === 'Final') return clock ?? 'Final'
  if (status === 'Live') return delayed ? 'Delayed' : clock
  if (status === 'Disrupted') return disruption
  return null
}

function hasScore(team: GameTeam): boolean {
  return team.score !== null
}
