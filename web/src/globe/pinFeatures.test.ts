import { describe, expect, it } from 'vitest'
import type { Game } from '../games/game'
import type { PlacedGame } from '../games/placedGames'
import { pinFeatures } from './pinFeatures'

/** Every game in one color. */
const inRed = () => '#ff0000'

const arrowhead: PlacedGame = {
  id: '401',
  league: 'NFL',
  sport: 'Football',
  startTime: '2026-10-04T17:00:00+00:00',
  status: 'Live',
  delayed: false,
  endTime: null,
  contest: {
    kind: 'sides',
    home: { abbreviation: 'KC', fullName: 'Kansas City Chiefs', logoUrl: null, score: '21', rank: null, record: null },
    away: { abbreviation: 'BUF', fullName: 'Buffalo Bills', logoUrl: null, score: '17', rank: null, record: null },
  },
  clock: '4:12',
  period: 3,
  clutchTime: false,
  hot: false,
  venue: {
    name: 'GEHA Field at Arrowhead Stadium',
    city: 'Kansas City',
    region: 'Missouri',
    country: 'USA',
    latitude: 39.0489,
    longitude: -94.4839,
    timeZone: 'America/Chicago',
    photo: null,
    court: null,
  },
  broadcasters: [{ name: 'CBS', country: 'US', watchUrl: null }],
  streamLinks: [],
  note: null,
  situation: null,
  lastScore: null,
  keyEvents: [],
  topEvent: false,
  scoreline: null,
  espnUrl: null,
}

describe('pinFeatures', () => {
  it('places one pin per game at its venue, longitude first', () => {
    const collection = pinFeatures([arrowhead], inRed)

    expect(collection).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: '401',
          geometry: { type: 'Point', coordinates: [-94.4839, 39.0489] },
          properties: { gameId: '401', status: 'Live', color: '#ff0000', flames: false },
        },
      ],
    })
  })

  it('gives games at the same venue pins of their own, both exactly at the venue', () => {
    const [first, second] = pinFeatures([arrowhead, { ...arrowhead, id: '402' }], inRed).features

    expect(first.properties.gameId).toBe('401')
    expect(second.properties.gameId).toBe('402')
    expect(first.geometry.coordinates).toEqual([-94.4839, 39.0489])
    expect(second.geometry.coordinates).toEqual([-94.4839, 39.0489])
  })

  it("colors each pin in its game's color", () => {
    const colorOf = (game: Game) => (game.id === '401' ? '#123456' : '#654321')

    const colors = pinFeatures([arrowhead, { ...arrowhead, id: '402' }], colorOf).features.map((pin) => pin.properties.color)

    expect(colors).toEqual(['#123456', '#654321'])
  })
})
