import type { Feature, Point } from 'geojson'
import { describe, expect, it } from 'vitest'
import type { CardLayout, Gathering, Showing } from './cardLayout'
import { cardLayoutDrawing, type CardOnGlobe } from './cardLayoutLayers'

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

const sitting: Showing = { as: 'card', offset: { dx: 0, dy: -6 }, moved: false, trail: { x1: 100, y1: 194, x2: 100, y2: 200 } }
const moved: Showing = { as: 'card', offset: { dx: 120, dy: -6 }, moved: true, trail: { x1: 170, y1: 200, x2: 100, y2: 200 } }

// Each in a color of its own: a's is #aaaaaa.
const a = card('a', 100, 200, [10, -20.5])
const b = card('b', 100, 200, [10, -20.5])
const c = { ...card('c', 300, 400, [30, -40.5]), status: 'Final' as const }
const d = { ...card('d', 300, 400, [30, -40.5]), status: 'Final' as const }

/** A card layout's result, as the card layout would give it (see cardLayout). */
const laidOut = (showing: Record<string, Showing>, gatherings: Gathering[]): Pick<CardLayout, 'shows' | 'gatherings'> => ({
  shows: (gameId) => showing[gameId] ?? { as: 'notLaidOut' },
  gatherings: () => gatherings,
})

const dot = (gameId: string): Gathering => ({ kind: 'venueDot', trails: [gameId], noRoom: [], at: { venueOf: gameId } })

// a and b at one venue, their trails meeting at a venue cluster there; c and d in a card cluster at c's venue.
const allFour = laidOut(
  { a: sitting, b: moved, c: { as: 'inCardCluster', cardCluster: ['c', 'd'] }, d: { as: 'inCardCluster', cardCluster: ['c', 'd'] } },
  [
    { kind: 'venueCluster', trails: ['a', 'b'], noRoom: [], at: { x: 100, y: 200 } },
    { kind: 'cardCluster', trails: [], noRoom: ['c', 'd'], at: { venueOf: 'c' } },
  ],
)

const drawing = (cards: CardOnGlobe[] = [a, b, c, d], layout = allFour) => cardLayoutDrawing(cards, layout, unproject)
const features = (kind: string, cards?: CardOnGlobe[], layout?: Pick<CardLayout, 'shows' | 'gatherings'>) =>
  drawing(cards, layout).source.features.filter((feature) => feature.properties?.kind === kind)

describe('cardLayoutDrawing', () => {
  it("draws a card's trail from the card's edge, as far from its venue on screen as the card, to its venue dot, moved or not, in its game's color, named for its game", () => {
    expect(drawing([a], laidOut({ a: sitting }, [dot('a')])).trails).toEqual([
      { gameId: 'a', color: '#aaaaaa', venue: [10, -20.5], start: { dx: 0, dy: -6 }, end: [10, -20.5], dot: true },
    ])
    expect(drawing([b], laidOut({ b: moved }, [dot('b')])).trails).toEqual([
      { gameId: 'b', color: '#bbbbbb', venue: [10, -20.5], start: { dx: 70, dy: 0 }, end: [10, -20.5], dot: true },
    ])
  })

  it('draws no trail for a game in a card cluster', () => {
    expect(drawing().trails.map(({ gameId }) => gameId)).toEqual(['a', 'b'])
  })

  it('has the trails of a venue cluster meet at it, with no dots of their own, where it is on the globe', () => {
    expect(drawing().trails.map(({ gameId, end, dot }) => [gameId, end, dot])).toEqual([
      ['a', [10, -20], false],
      ['b', [10, -20], false],
    ])
    expect(features('venueCluster').map(({ properties, geometry }) => [properties?.count, (geometry as Point).coordinates])).toEqual([[2, [10, -20]]])
  })

  it('draws a venue cluster with the status the most prominent of its games shows as', () => {
    const upcoming = { ...a, status: 'Upcoming' as const }
    expect(features('venueCluster', [upcoming, b, c, d]).map(({ properties }) => properties?.status)).toEqual(['Live'])
  })

  it("draws a card cluster at its first game's venue, with its count and the status it shows as", () => {
    expect(features('cardCluster')).toEqual([
      {
        type: 'Feature',
        // c's and d's colors differ (see clusterColor).
        properties: { kind: 'cardCluster', status: 'Final', sharedColor: 'mixed', count: 2, firstGameId: 'c', flames: false },
        geometry: { type: 'Point', coordinates: [30, -40.5] },
      } satisfies Feature<Point>,
    ])
    expect(drawing().cardClusters).toEqual([{ gameIds: ['c', 'd'], lngLat: [30, -40.5] }])
  })

  it('draws a lone game with no room as its small pin at its venue, named for its game', () => {
    const lone = { ...c, status: 'Live' as const, flames: true }
    const alone = drawing([lone], laidOut({ c: { as: 'smallPin' } }, [{ kind: 'smallPin', trails: [], noRoom: ['c'], at: { venueOf: 'c' } }]))
    expect(alone.cardClusters).toEqual([])
    expect(alone.source.features).toEqual([
      {
        type: 'Feature',
        properties: { kind: 'smallPin', gameId: 'c', status: 'Live', color: '#cccccc', flames: true },
        geometry: { type: 'Point', coordinates: [30, -40.5] },
      } satisfies Feature<Point>,
    ])
  })

  it('shows flames on a card cluster holding a game showing flames, but never on a venue cluster', () => {
    const flaming = [{ ...a, flames: true }, b, c, { ...d, flames: true }]

    expect(features('cardCluster', flaming).map(({ properties }) => properties?.flames)).toEqual([true])
    expect(features('venueCluster', flaming).map(({ properties }) => properties?.flames)).toEqual([undefined])
  })

  it('gives every card with room a footprint where it is, moved or not, at its venue and offset to it on screen', () => {
    expect(features('footprint').map(({ geometry, properties }) => [(geometry as Point).coordinates, properties?.offset])).toEqual([
      // Each centered on its card, 36 px above its venue and 120 px to the side when moved, so its foot
      // is half a footprint (68) below that.
      [[10, -20.5], [0, -2]],
      [[10, -20.5], [120, -2]],
    ])
  })

  describe('a card cluster that cards’ trails meet at', () => {
    // p and q with no room, r's and s's cards on screen, their trails meeting at the card cluster between their venues.
    const p = card('p', 500, 500, [50, -50])
    const q = { ...card('q', 500, 500, [50, -50]), flames: true }
    const r = { ...card('r', 490, 500, [49, -50]), status: 'Upcoming' as const }
    const s = { ...card('s', 510, 500, [51, -50]), status: 'Final' as const }
    const games = ['p', 'q', 'r', 's']
    const layout = laidOut(
      {
        p: { as: 'inCardCluster', cardCluster: games },
        q: { as: 'inCardCluster', cardCluster: games },
        r: { ...moved, cardCluster: games },
        s: { ...moved, cardCluster: games },
      },
      [{ kind: 'cardCluster', trails: ['r', 's'], noRoom: ['p', 'q'], at: { x: 500, y: 500 } }],
    )
    const crowd = (cards: CardOnGlobe[] = [p, q, r, s]) => drawing(cards, layout)

    it('counts every game, and shows as the most prominent status among them, with flames only for a game with no room', () => {
      const [cluster] = crowd().source.features.filter((feature) => feature.properties?.kind === 'cardCluster')
      expect([cluster.properties?.count, cluster.properties?.status, cluster.properties?.flames]).toEqual([4, 'Live', true])
      const onlyOnScreenHot = [p, { ...q, flames: false }, { ...r, flames: true }, s]
      expect(crowd(onlyOnScreenHot).source.features.find((feature) => feature.properties?.kind === 'cardCluster')?.properties?.flames).toBe(false)
    })

    it('has the trails of its games with cards on screen meet at it, where it is on the globe', () => {
      expect(crowd().trails.map(({ gameId, end, dot }) => [gameId, end, dot])).toEqual([
        ['r', [50, -50], false],
        ['s', [50, -50], false],
      ])
    })

    it('gives all its games, those with no room first, for pulses over it', () => {
      expect(crowd().cardClusters).toEqual([{ gameIds: ['p', 'q', 'r', 's'], lngLat: [50, -50] }])
    })
  })
})
