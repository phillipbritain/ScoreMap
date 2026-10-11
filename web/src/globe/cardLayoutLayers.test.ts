import type { Feature, LineString, Point } from 'geojson'
import { describe, expect, it } from 'vitest'
import type { CardLayout, CardPlacement } from './cardLayout'
import { cardLayoutFeatures, type CardOnGlobe } from './cardLayoutLayers'

// A stand-in for the map's: screen pixels to longitude and latitude, simply scaled.
const unproject = (x: number, y: number): [number, number] => [x / 10, -y / 10]

const card = (gameId: string, venueX: number, venueY: number, lngLat: [number, number]): CardOnGlobe => ({
  gameId,
  status: 'Live',
  venueX,
  venueY,
  width: 100,
  height: 60,
  lngLat,
})

const sitting: CardPlacement = { offset: { dx: 0, dy: -6 }, inCardCluster: false, trail: null }
const moved: CardPlacement = { offset: { dx: 120, dy: -6 }, inCardCluster: false, trail: { x1: 170, y1: 200, x2: 100, y2: 200 } }
const clustered: CardPlacement = { ...sitting, inCardCluster: true }

const a = card('a', 100, 200, [10, -20.5])
const b = card('b', 100, 200, [10, -20.5])
const c = card('c', 300, 400, [30, -40.5])
const d = card('d', 300, 400, [30, -40.5])

const layout: CardLayout = {
  cards: new Map([
    ['a', sitting],
    ['b', moved],
    ['c', clustered],
    ['d', clustered],
  ]),
  cardClusters: [{ gameIds: ['c', 'd'], status: 'Final', x: 300, y: 400 }],
}

const features = (kind: string) =>
  cardLayoutFeatures([a, b, { ...c, status: 'Final' }, d], layout, unproject).features.filter(
    (feature) => feature.properties?.kind === kind,
  )

describe('cardLayoutFeatures', () => {
  it("draws a moved card's trail from the card's edge, turned back into a place, to its venue", () => {
    expect(features('trail')).toEqual([
      {
        type: 'Feature',
        properties: { kind: 'trail', status: 'Live' },
        geometry: { type: 'LineString', coordinates: [[17, -20], [10, -20.5]] },
      } satisfies Feature<LineString>,
    ])
  })

  it("marks a moved card's venue, where its trail ends, and no other", () => {
    expect(features('venue')).toEqual([
      {
        type: 'Feature',
        properties: { kind: 'venue', status: 'Live' },
        geometry: { type: 'Point', coordinates: [10, -20.5] },
      } satisfies Feature<Point>,
    ])
  })

  it("draws each card cluster at its first game's venue, with its count and the status it shows as", () => {
    expect(features('cardCluster')).toEqual([
      {
        type: 'Feature',
        properties: { kind: 'cardCluster', status: 'Final', count: 2, firstGameId: 'c' },
        geometry: { type: 'Point', coordinates: [30, -40.5] },
      } satisfies Feature<Point>,
    ])
  })

  it('gives every card with room a footprint where it is, moved or not', () => {
    expect(features('footprint').map((feature) => (feature.geometry as Point).coordinates)).toEqual([
      // Sitting above its venue: from the tip of its pointer, on the venue.
      [10, -20.5],
      // Moved, with no pointer: centred on the card, its centre at (220, 164), so its foot is half a
      // footprint (68) below that.
      [22, -19.8],
    ])
  })
})
