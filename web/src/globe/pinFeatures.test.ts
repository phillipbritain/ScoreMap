import { describe, expect, it } from 'vitest'
import type { Game } from '../games/game'
import { pinFeatures } from './pinFeatures'

const arrowhead: Game = {
  id: '401',
  league: 'NFL',
  sport: 'Football',
  startTime: '2026-10-04T17:00:00+00:00',
  status: 'Live',
  delayed: false,
  disruption: null,
  endTime: null,
  home: { abbreviation: 'KC', fullName: 'Kansas City Chiefs', logoUrl: null, score: 21 },
  away: { abbreviation: 'BUF', fullName: 'Buffalo Bills', logoUrl: null, score: 17 },
  clock: '4:12',
  period: 3,
  venue: {
    name: 'GEHA Field at Arrowhead Stadium',
    city: 'Kansas City',
    country: 'USA',
    latitude: 39.0489,
    longitude: -94.4839,
    timeZone: 'America/Chicago',
    photo: null,
  },
  broadcasters: [{ name: 'CBS', country: 'US', watchUrl: null }],
  streamLinks: [],
}

describe('pinFeatures', () => {
  it('places one pin per game at its venue, longitude first', () => {
    const collection = pinFeatures([arrowhead])

    expect(collection).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: '401',
          geometry: { type: 'Point', coordinates: [-94.4839, 39.0489] },
          properties: { gameId: '401', status: 'Live' },
        },
      ],
    })
  })

  it('gives games at the same venue pins of their own, both exactly at the venue', () => {
    const [first, second] = pinFeatures([arrowhead, { ...arrowhead, id: '402' }]).features

    expect(first.properties.gameId).toBe('401')
    expect(second.properties.gameId).toBe('402')
    expect(first.geometry.coordinates).toEqual([-94.4839, 39.0489])
    expect(second.geometry.coordinates).toEqual([-94.4839, 39.0489])
  })
})
