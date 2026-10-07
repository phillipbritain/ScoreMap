import type { Feature, Point } from 'geojson'
import { describe, expect, it } from 'vitest'
import { animationTarget } from './animationTarget'

const pin = (gameId: string, coordinates: [number, number]): Feature<Point> => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates },
  properties: { gameId, status: 'Live' },
})

const cluster = (clusterId: number, coordinates: [number, number]): Feature<Point> => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates },
  properties: { cluster: true, cluster_id: clusterId, point_count: 3 },
})

// Arrowhead Stadium, Kansas City.
const venue: [number, number] = [-94.48, 39.05]

describe('animationTarget', () => {
  it('animates the game’s own pin when it is not in a cluster', () => {
    expect(animationTarget('401', venue, [cluster(7, [-80, 35]), pin('401', venue)])).toEqual({
      kind: 'pin',
      lngLat: venue,
    })
  })

  it('otherwise looks for the game in the clusters, nearest its venue first and each once', () => {
    const features = [cluster(7, [-80, 35]), cluster(9, [-95, 39]), pin('402', [-75, 40]), cluster(7, [-80, 35])]

    expect(animationTarget('401', venue, features)).toEqual({
      kind: 'cluster',
      candidates: [
        { clusterId: 9, lngLat: [-95, 39] },
        { clusterId: 7, lngLat: [-80, 35] },
      ],
    })
  })

  it('measures nearness across the antimeridian', () => {
    // Fiji: a cluster just over the antimeridian is nearer than one 9° of longitude west.
    const fiji: [number, number] = [178.4, -18.1]
    const target = animationTarget('501', fiji, [cluster(1, [169.4, -18.1]), cluster(2, [-179.6, -18.1])])

    expect(target?.kind === 'cluster' && target.candidates.map((c) => c.clusterId)).toEqual([2, 1])
  })

  it('has nothing to animate when neither its pin nor any cluster is shown', () => {
    expect(animationTarget('401', venue, [pin('402', [-75, 40])])).toBeNull()
  })
})
