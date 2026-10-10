import type { Feature, Point } from 'geojson'
import { describe, expect, it } from 'vitest'
import { cardPins } from './cardPins'

const pin = (gameId: string, coordinates: [number, number]): Feature<Point> => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates },
  properties: { gameId, status: 'Live' },
})

const cluster: Feature<Point> = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [-80, 35] },
  properties: { cluster: true, cluster_id: 7, point_count: 4 },
}

describe('cardPins', () => {
  it('places one card per game at its pin', () => {
    expect(cardPins([pin('401', [-94.48, 39.05]), pin('402', [-75.17, 39.9])])).toEqual([
      { gameId: '401', lngLat: [-94.48, 39.05] },
      { gameId: '402', lngLat: [-75.17, 39.9] },
    ])
  })

  it('leaves pin clusters out', () => {
    expect(cardPins([cluster, pin('401', [-94.48, 39.05])]).map((c) => c.gameId)).toEqual(['401'])
  })

  it('places a game once even when it appears in several map tiles', () => {
    expect(cardPins([pin('401', [-94.48, 39.05]), pin('401', [-94.48, 39.05])])).toHaveLength(1)
  })
})
