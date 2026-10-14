import type { Feature, LineString, Point } from 'geojson'
import { describe, expect, it } from 'vitest'
import type { CardLayout, CardPlacement } from './cardLayout'
import { cardLayoutFeatures, type CardOnGlobe, type VenueSizes } from './cardLayoutLayers'

// A stand-in for the map's: screen pixels to longitude and latitude, simply scaled.
const unproject = (x: number, y: number): [number, number] => [x / 10, -y / 10]

const card = (gameId: string, venueX: number, venueY: number, lngLat: [number, number]): CardOnGlobe => ({
  gameId,
  status: 'Live',
  color: `#${gameId}${gameId}${gameId}${gameId}${gameId}${gameId}`,
  venueX,
  venueY,
  width: 100,
  height: 60,
  lngLat,
})

const sitting: CardPlacement = { offset: { dx: 0, dy: -6 }, inCardCluster: false, moved: false, trail: { x1: 100, y1: 194, x2: 100, y2: 200 } }
const moved: CardPlacement = { offset: { dx: 120, dy: -6 }, inCardCluster: false, moved: true, trail: { x1: 170, y1: 200, x2: 100, y2: 200 } }
const clustered: CardPlacement = { ...sitting, inCardCluster: true }

// Each in a colour of its own: a's is #aaaaaa.
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

// A venue dot reaches 6 pixels from its venue, ring and all; a venue cluster of a few games 12, of more 15.
const venueSizes: VenueSizes = { dot: 6, cluster: (count) => (count < 5 ? 12 : 15) }

/** The features of this kind for these cards, laid out as `layout` has them: all four unless given. */
const features = (kind: string, cards: CardOnGlobe[] = [a, b, { ...c, status: 'Final' }, d]) =>
  cardLayoutFeatures(cards, layout, unproject, venueSizes).features.filter((feature) => feature.properties?.kind === kind)

describe('cardLayoutFeatures', () => {
  it("draws a card's trail from the card's edge, turned back into a place, to its venue, moved or not, in its game's colour, named for its game", () => {
    expect(features('trail', [a])).toEqual([
      {
        type: 'Feature',
        properties: { kind: 'trail', color: '#aaaaaa', gameId: 'a' },
        geometry: { type: 'LineString', coordinates: [[10, -19.4], [10, -20.5]] },
      } satisfies Feature<LineString>,
    ])
    expect(features('trail', [b])).toEqual([
      {
        type: 'Feature',
        properties: { kind: 'trail', color: '#bbbbbb', gameId: 'b' },
        geometry: { type: 'LineString', coordinates: [[17, -20], [10, -20.5]] },
      } satisfies Feature<LineString>,
    ])
  })

  it("marks a card's venue, where its trail ends, in its game's colour, named for its game, but not a venue whose cards are in a card cluster", () => {
    expect(features('venue', [a, { ...c, status: 'Final' }, d])).toEqual([
      {
        type: 'Feature',
        properties: { kind: 'venue', color: '#aaaaaa', gameId: 'a' },
        geometry: { type: 'Point', coordinates: [10, -20.5] },
      } satisfies Feature<Point>,
    ])
  })

  it('has the trails of cards at one venue meet at a venue cluster', () => {
    expect(features('venue')).toEqual([])
    expect(features('venueCluster').map(({ properties }) => properties?.count)).toEqual([2])
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
      // Each centred on its card, at (100, 164) above its venue and (220, 164) moved, so its foot is
      // half a footprint (68) below that.
      [10, -19.8],
      [22, -19.8],
    ])
  })

  describe('moved cards whose venue dots would overlap', () => {
    const trail = { x1: 0, y1: 0, x2: 0, y2: 0 }
    const e = { ...card('e', 500, 500, [50, -50]), status: 'Upcoming' as const }
    const f = card('f', 510, 500, [51, -50])
    const g = { ...card('g', 600, 500, [60, -50]), color: '#999999' }
    const h = card('h', 522, 500, [52.2, -50])
    const movedAway = (...cards: CardOnGlobe[]): CardLayout => ({
      cards: new Map(cards.map(({ gameId }) => [gameId, { ...moved, trail }])),
      cardClusters: [],
    })
    const drawn = (kind: string, ...cards: CardOnGlobe[]) =>
      cardLayoutFeatures(cards, movedAway(...cards), unproject, venueSizes).features.filter(
        (feature) => feature.properties?.kind === kind,
      )
    const marks = (kind: string, ...cards: CardOnGlobe[]) =>
      drawn(kind, ...cards).map(({ properties, geometry }) => [properties?.status, properties?.count, (geometry as Point).coordinates])

    it('show as a venue cluster in the middle of their venues, with the count and the status the most prominent shows as', () => {
      // e and f 10 pixels apart, g well clear of them.
      expect(marks('venueCluster', e, f, g)).toEqual([['Live', 2, [50.5, -50]]])
      expect(drawn('venue', e, f, g).map(({ properties, geometry }) => [properties?.color, (geometry as Point).coordinates])).toEqual([
        ['#999999', [60, -50]],
      ])
    })

    it("have their trails meet at the venue cluster, each in its own game's colour", () => {
      expect(drawn('trail', e, f).map(({ properties, geometry }) => [properties?.color, (geometry as LineString).coordinates[1]])).toEqual([
        ['#eeeeee', [50.5, -50]],
        ['#ffffff', [50.5, -50]],
      ])
    })

    it('gather into the venue cluster a dot it would overlap, though the dot is clear of each dot in it', () => {
      // h is 12 pixels from f, just clear of its dot, but 17 from the middle of e and f, where the
      // venue cluster reaches 12.
      expect(marks('venueCluster', e, f, h).map(([, count]) => count)).toEqual([3])
      expect(marks('venue', e, f, h)).toEqual([])
    })
  })
})
