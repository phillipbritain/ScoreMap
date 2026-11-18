import { describe, expect, it } from 'vitest'
import type { VenuePhoto } from '../games/game'
import { tourGames } from './tourGames'
import { fetchVenuePhotos, venuePhotoAddress, withVenuePhotos } from './tourVenuePhotos'

const games = tourGames(Date.parse('2026-11-16T20:00:00Z'))
const photoOf = (venue: string): VenuePhoto => ({ url: `https://photos.test/${encodeURIComponent(venue)}.jpg`, credit: null })

/** A server that knows a photo for each venue but those named, and fails for those in `failing`. */
const server =
  ({ without = [] as string[], failing = [] as string[] } = {}) =>
  (address: string) => {
    const query = new URL(address, 'http://scoremap.test').searchParams
    const venue = query.get('name')!
    if (failing.includes(venue)) return Promise.reject(new TypeError('Failed to fetch'))
    if (without.includes(venue)) return Promise.resolve(new Response(null, { status: 204 }))
    return Promise.resolve(Response.json(photoOf(venue)))
  }

describe("the tour's venue photos", () => {
  it('are asked for by league, venue, city and the venue’s ESPN id, as the server finds a real game’s', () => {
    const query = new URL(venuePhotoAddress(games[0]), 'http://scoremap.test')

    expect(query.pathname).toBe('/api/venue-photo')
    expect(Object.fromEntries(query.searchParams)).toEqual({
      league: games[0].league,
      name: games[0].venue.name,
      city: games[0].venue.city,
      id: games[0].venue.espnId,
    })
    expect(games[0].venue.espnId).toBeTruthy()
  })

  it('are asked for without an id for a venue that has none', () => {
    const game = { ...games[0], venue: { ...games[0].venue, espnId: undefined } }

    expect(new URL(venuePhotoAddress(game), 'http://scoremap.test').searchParams.has('id')).toBe(false)
  })

  it('reach every tour game, each with its own venue’s photo', async () => {
    const shown = withVenuePhotos(games, await fetchVenuePhotos(games, server()))

    for (const game of shown) expect(game.venue.photo).toEqual(photoOf(game.venue.name!))
  })

  it('leave a game without one when its venue has none or the ask fails, and the rest still get theirs', async () => {
    const [none, failed, ...rest] = games.map((game) => game.venue.name!)
    const shown = withVenuePhotos(games, await fetchVenuePhotos(games, server({ without: [none], failing: [failed] })))

    expect(shown[0].venue.photo).toBeNull()
    expect(shown[1].venue.photo).toBeNull()
    expect(shown.slice(2).map((game) => game.venue.photo)).toEqual(rest.map(photoOf))
  })
})
