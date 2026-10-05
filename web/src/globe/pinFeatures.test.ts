import { describe, expect, it } from 'vitest'
import type { Game } from '../games/game'
import { pinFeatures } from './pinFeatures'

const arrowhead: Game = {
  id: '401',
  league: 'NFL',
  sport: 'American football',
  startTime: '2026-10-04T17:00:00+00:00',
  status: 'Live',
  delayed: false,
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
  },
  broadcasters: [{ name: 'CBS', country: 'USA' }],
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
          properties: { gameId: '401', status: 'Live', label: 'BUF 17 – 21 KC\n4:12' },
        },
      ],
    })
  })

  it('labels a game without scores by its teams', () => {
    const upcoming: Game = {
      ...arrowhead,
      status: 'Upcoming',
      clock: null,
      period: null,
      home: { ...arrowhead.home, score: null },
      away: { ...arrowhead.away, score: null },
    }

    expect(pinFeatures([upcoming]).features[0].properties.label).toBe('BUF @ KC')
  })

  it('shows "Delayed" in place of the clock for a delayed game', () => {
    const delayed: Game = { ...arrowhead, delayed: true }

    expect(pinFeatures([delayed]).features[0].properties.label).toBe('BUF 17 – 21 KC\nDelayed')
  })

  it('marks a Final game as final in place of the clock', () => {
    const final: Game = { ...arrowhead, status: 'Final', clock: null, endTime: '2026-10-04T20:10:00+00:00' }

    expect(pinFeatures([final]).features[0].properties).toMatchObject({
      status: 'Final',
      label: 'BUF 17 – 21 KC\nFinal',
    })
  })

  it("shows the sport's own final line when the server sends one", () => {
    const afterExtraTime: Game = {
      ...arrowhead,
      sport: 'Soccer',
      status: 'Final',
      clock: 'AET',
      endTime: '2026-10-04T20:10:00+00:00',
    }

    expect(pinFeatures([afterExtraTime]).features[0].properties.label).toBe('BUF 17 – 21 KC\nAET')
  })
})
