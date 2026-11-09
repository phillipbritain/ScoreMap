import type { Feature, Point } from 'geojson'
import { describe, expect, it } from 'vitest'
import type { CardLayout, CardPlacement } from './cardLayout'
import { cardLayoutDrawing, type CardOnGlobe, type VenueSizes } from './cardLayoutLayers'

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
  flames: false,
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

// A venue dot reaches 6 pixels from its venue, ring and all; a venue cluster of a few games 12, of
// more 15; a card cluster 15.
const venueSizes: VenueSizes = { dot: 6, cluster: (count) => (count < 5 ? 12 : 15), cardCluster: 15 }

const allFour = [a, b, { ...c, status: 'Final' as const }, { ...d, status: 'Final' as const }]

/** The features of this kind for these cards, laid out as `layout` has them: all four unless given. */
const features = (kind: string, cards: CardOnGlobe[] = allFour) =>
  cardLayoutDrawing(cards, layout, unproject, venueSizes).source.features.filter((feature) => feature.properties?.kind === kind)

/** The moved cards' trails for these cards, laid out as `layout` has them: all four unless given. */
const trails = (cards: CardOnGlobe[] = allFour) => cardLayoutDrawing(cards, layout, unproject, venueSizes).trails

describe('cardLayoutDrawing', () => {
  it("draws a card's trail from the card's edge, as far from its venue on screen as the card, to its venue, moved or not, in its game's colour, named for its game", () => {
    expect(trails([a])).toEqual([{ gameId: 'a', color: '#aaaaaa', venue: [10, -20.5], start: { dx: 0, dy: -6 }, end: [10, -20.5], dot: true }])
    expect(trails([b])).toEqual([{ gameId: 'b', color: '#bbbbbb', venue: [10, -20.5], start: { dx: 70, dy: 0 }, end: [10, -20.5], dot: true }])
  })

  it("ends a card's trail at a dot on its venue, but draws none for a game in a card cluster", () => {
    expect(trails([a, { ...c, status: 'Final' }, d]).map(({ gameId, dot }) => [gameId, dot])).toEqual([['a', true]])
  })

  it('has the trails of cards at one venue meet at a venue cluster, with no dots of their own', () => {
    expect(trails().map(({ gameId, dot }) => [gameId, dot])).toEqual([
      ['a', false],
      ['b', false],
    ])
    expect(features('venueCluster').map(({ properties }) => properties?.count)).toEqual([2])
  })

  it("draws each card cluster at its first game's venue, with its count and the status it shows as", () => {
    expect(features('cardCluster')).toEqual([
      {
        type: 'Feature',
        // c's and d's colours differ (see clusterColour).
        properties: { kind: 'cardCluster', status: 'Final', sharedColor: 'mixed', count: 2, firstGameId: 'c', flames: false },
        geometry: { type: 'Point', coordinates: [30, -40.5] },
      } satisfies Feature<Point>,
    ])
  })

  describe('a game with no room for its card, alone', () => {
    const lone = { ...c, flames: true }
    const alone: CardLayout = {
      cards: new Map([
        ['c', clustered],
        ['a', moved],
      ]),
      cardClusters: [{ gameIds: ['c'], status: 'Live', x: 300, y: 400 }],
    }

    it('is never a card cluster of one, but its small pin at its venue, named for its game', () => {
      const drawing = cardLayoutDrawing([lone], alone, unproject, venueSizes)
      expect(drawing.cardClusters).toEqual([])
      expect(drawing.smallPins).toEqual(['c'])
      expect(drawing.source.features).toEqual([
        {
          type: 'Feature',
          properties: { kind: 'smallPin', gameId: 'c', status: 'Live', color: '#cccccc', flames: true },
          geometry: { type: 'Point', coordinates: [30, -40.5] },
        } satisfies Feature<Point>,
      ])
    })

    it("is a card cluster of two when another game's venue dot would overlap it, and no small pin", () => {
      const near = card('a', 305, 400, [30.5, -40])
      const drawing = cardLayoutDrawing([lone, near], alone, unproject, venueSizes)
      expect(drawing.cardClusters.map(({ gameIds }) => gameIds)).toEqual([['c', 'a']])
      expect(drawing.smallPins).toEqual([])
      expect(drawing.source.features.filter((feature) => feature.properties?.kind === 'smallPin')).toEqual([])
    })
  })

  it('shows flames on a card cluster holding a game showing flames, but never on a venue cluster', () => {
    const flaming = [{ ...a, flames: true }, b, { ...c, status: 'Final' as const }, { ...d, status: 'Final' as const, flames: true }]

    expect(features('cardCluster', flaming).map(({ properties }) => properties?.flames)).toEqual([true])
    expect(features('venueCluster', flaming).map(({ properties }) => properties?.flames)).toEqual([undefined])
  })

  it('gives every card with room a footprint where it is, moved or not, at its venue and offset to it on screen', () => {
    expect(features('footprint').map(({ geometry, properties }) => [(geometry as Point).coordinates, properties?.offset])).toEqual([
      // Each centred on its card, 36 px above its venue and 120 px to the side when moved, so its foot
      // is half a footprint (68) below that.
      [[10, -20.5], [0, -2]],
      [[10, -20.5], [120, -2]],
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
      cardLayoutDrawing(cards, movedAway(...cards), unproject, venueSizes).source.features.filter(
        (feature) => feature.properties?.kind === kind,
      )
    const trailsOf = (...cards: CardOnGlobe[]) => cardLayoutDrawing(cards, movedAway(...cards), unproject, venueSizes).trails
    const marks = (kind: string, ...cards: CardOnGlobe[]) =>
      drawn(kind, ...cards).map(({ properties, geometry }) => [properties?.status, properties?.count, (geometry as Point).coordinates])

    it('show as a venue cluster in the middle of their venues, with the count and the status the most prominent shows as', () => {
      // e and f 10 pixels apart, g well clear of them.
      expect(marks('venueCluster', e, f, g)).toEqual([['Live', 2, [50.5, -50]]])
      expect(trailsOf(e, f, g).filter(({ dot }) => dot).map(({ color, end }) => [color, end])).toEqual([['#999999', [60, -50]]])
    })

    it("have their trails meet at the venue cluster, each in its own game's colour", () => {
      expect(trailsOf(e, f).map(({ color, end }) => [color, end])).toEqual([
        ['#eeeeee', [50.5, -50]],
        ['#ffffff', [50.5, -50]],
      ])
    })

    it('gather into the venue cluster a dot it would overlap, though the dot is clear of each dot in it', () => {
      // h is 12 pixels from f, just clear of its dot, but 17 from the middle of e and f, where the
      // venue cluster reaches 12.
      expect(marks('venueCluster', e, f, h).map(([, count]) => count)).toEqual([3])
      expect(trailsOf(e, f, h).filter(({ dot }) => dot)).toEqual([])
    })
  })
  describe('a card cluster that venue dots or another card cluster would overlap', () => {
    const onScreen: CardPlacement = { ...moved, trail: { x1: 0, y1: 0, x2: 0, y2: 0 } }
    // A card cluster of p and q, at their venue; r's and s's cards on screen, their venues 10 pixels
    // either side of it, where their venue cluster would sit on the card cluster; t's well clear.
    const p = card('p', 500, 500, [50, -50])
    const q = { ...card('q', 500, 500, [50, -50]), flames: true }
    const r = { ...card('r', 490, 500, [49, -50]), status: 'Upcoming' as const }
    const s = { ...card('s', 510, 500, [51, -50]), status: 'Final' as const }
    const t = card('t', 700, 500, [70, -50])
    const crowded: CardLayout = {
      cards: new Map([
        ['p', clustered],
        ['q', clustered],
        ['r', onScreen],
        ['s', onScreen],
        ['t', onScreen],
      ]),
      cardClusters: [{ gameIds: ['p', 'q'], status: 'Live', x: 500, y: 500 }],
    }
    const drawing = (cards: CardOnGlobe[] = [p, q, r, s, t]) => cardLayoutDrawing(cards, crowded, unproject, venueSizes)
    const drawn = (kind: string, cards?: CardOnGlobe[]) =>
      drawing(cards).source.features.filter((feature) => feature.properties?.kind === kind)

    it('becomes one card cluster in the middle of all their venues, counting every game, and no venue cluster', () => {
      expect(drawn('venueCluster')).toEqual([])
      expect(drawn('cardCluster').map(({ properties, geometry }) => [properties?.count, properties?.firstGameId, (geometry as Point).coordinates])).toEqual([
        [4, 'p', [50, -50]],
      ])
    })

    it('shows as the most prominent status among all its games, with flames only for a game with no room', () => {
      expect(drawn('cardCluster').map(({ properties }) => [properties?.status, properties?.flames])).toEqual([['Live', true]])
      const onlyOnScreenHot = [p, { ...q, flames: false }, { ...r, flames: true }, s, t]
      expect(drawn('cardCluster', onlyOnScreenHot).map(({ properties }) => properties?.flames)).toEqual([false])
    })

    it('has the trails of its games with cards on screen meet at it, and leaves a venue dot clear of it alone', () => {
      expect(drawing().trails.map(({ gameId, end, dot }) => [gameId, end, dot])).toEqual([
        ['r', [50, -50], false],
        ['s', [50, -50], false],
        ['t', [70, -50], true],
      ])
    })

    it('gives all its games, those with no room first, for selecting it to zoom to', () => {
      expect(drawing().cardClusters).toEqual([{ gameIds: ['p', 'q', 'r', 's'], lngLat: [50, -50] }])
    })

    it("stays at its first game's venue while nothing overlaps it", () => {
      expect(drawing([p, q, t]).cardClusters).toEqual([{ gameIds: ['p', 'q'], lngLat: [50, -50] }])
    })

    it('gathers another card cluster it would overlap into one', () => {
      const u = card('u', 520, 500, [52, -50])
      const twoClusters: CardLayout = {
        cards: new Map([
          ['p', clustered],
          ['u', clustered],
        ]),
        cardClusters: [
          { gameIds: ['p'], status: 'Live', x: 500, y: 500 },
          { gameIds: ['u'], status: 'Live', x: 520, y: 500 },
        ],
      }
      expect(cardLayoutDrawing([p, u], twoClusters, unproject, venueSizes).cardClusters).toEqual([{ gameIds: ['p', 'u'], lngLat: [51, -50] }])
    })
  })
})
