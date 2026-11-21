import type { Game, VenuePhoto } from '../games/game'

/**
 * The tour's games' venue photos (see GLOSSARY.md "Tour games", ADR-0027). A real game reaches the
 * browser with its venue's photo; the tour's games are made here, so the browser asks the server for
 * each venue's, which finds and saves it as it does a real game's (Program.cs, MapVenuePhoto).
 */

// Served by the server (Venues/VenuePhotoEndpoint.cs).
const venuePhotoPath = '/api/venue-photo'

/**
 * Where to ask for a game's venue photo: by its league's name, its venue's name and city, and the venue's
 * ESPN id where it has one, which a real game's scoreboard gives the server.
 */
export function venuePhotoAddress(game: Game): string {
  const query = new URLSearchParams({ league: game.league, name: game.venue.name ?? '' })
  if (game.venue.city) query.set('city', game.venue.city)
  if (game.venue.espnId) query.set('id', game.venue.espnId)
  return `${venuePhotoPath}?${query}`
}

/**
 * Each game's venue photo, by game id, asked for all at once; a venue with none, or whose ask failed,
 * is left out, and its game keeps the faint glow in place of a photo.
 */
export async function fetchVenuePhotos(
  games: readonly Game[],
  get: (address: string, init: { signal?: AbortSignal }) => Promise<Response> = fetch,
  signal?: AbortSignal,
): Promise<Map<string, VenuePhoto>> {
  const found = await Promise.all(
    games.map(async (game): Promise<[string, VenuePhoto] | null> => {
      try {
        const response = await get(venuePhotoAddress(game), { signal })
        if (response.status !== 200) return null
        return [game.id, (await response.json()) as VenuePhoto]
      } catch {
        return null
      }
    }),
  )
  return new Map(found.filter((entry) => entry !== null))
}

/** The games, each with its venue's photo where there is one. */
export function withVenuePhotos(games: readonly Game[], photos: ReadonlyMap<string, VenuePhoto>): Game[] {
  return games.map((game) => {
    const photo = photos.get(game.id)
    return photo ? { ...game, venue: { ...game.venue, photo } } : game
  })
}
