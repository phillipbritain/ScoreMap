import { describe, expect, it } from 'vitest'
import type { Game } from '../games/game'
import { pinFeatures } from './pinFeatures'

/** Every game in one colour. */
const inRed = () => '#ff0000'

const arrowhead: Game = {
  id: '401',
  league: 'NFL',
  sport: 'Football',
  startTime: '2026-10-04T17:00:00+00:00',
  status: 'Live',
  delayed: false,
  disruption: null,
  endTime: null,
  home: { abbreviation: 'KC', fullName: 'Kansas City Chiefs', logoUrl: null, score: '21', rank: null, record: null },
  away: { abbreviation: 'BUF', fullName: 'Buffalo Bills', logoUrl: null, score: '17', rank: null, record: null },
  clock: '4:12',
  period: 3,
  clutchTime: false,
  venue: {
    name: 'GEHA Field at Arrowhead Stadium',
    city: 'Kansas City',
    region: 'Missouri',
    country: 'USA',
    latitude: 39.0489,
    longitude: -94.4839,
    timeZone: 'America/Chicago',
    photo: null,
  },
  broadcasters: [{ name: 'CBS', country: 'US', watchUrl: null }],
  streamLinks: [],
  note: null,
  attendance: null,
  odds: null,
  situation: null,
  lastScore: null,
  keyEvents: [],
  topEvent: false,
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
          properties: { gameId: '401', status: 'Live', color: '#ff0000' },
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

  it("colours each pin in its game's colour", () => {
    const colourOf = (game: Game) => (game.id === '401' ? '#123456' : '#654321')

    const colours = pinFeatures([arrowhead, { ...arrowhead, id: '402' }], colourOf).features.map((pin) => pin.properties.color)

    expect(colours).toEqual(['#123456', '#654321'])
  })
})
