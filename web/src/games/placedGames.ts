import type { Game, GameVenue } from './game'

/** A venue with a real position: looked up, given with the venue or corrected. */
export type PlacedVenue = GameVenue & { latitude: number; longitude: number }

/** A game whose venue is placed, so it can be drawn on the globe. */
export type PlacedGame = Game & { venue: PlacedVenue }

/**
 * The games that go on the globe: those whose venues are placed. A game whose venue lookup is still
 * pending, or found nothing, has no position, so it gets no pin until it's placed, though it stays in
 * the Games list and its panel.
 */
export function placedGames(games: readonly Game[]): PlacedGame[] {
  return games.filter(isPlaced)
}

function isPlaced(game: Game): game is PlacedGame {
  return game.venue.latitude !== null && game.venue.longitude !== null
}
