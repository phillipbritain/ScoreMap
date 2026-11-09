import type { CircleLayerSpecification, GeoJSONSourceSpecification, SymbolLayerSpecification } from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'
import type { Theme } from '../theme/theme'
import type { CardLayout, ScreenCard } from './cardLayout'
import { clusterColour, sharedColorProperty, sharedColourKey } from './clusterColour'
import {
  byCount,
  clusterFlameLayout,
  clusterFlameOffset,
  clusterFootprintAcross,
  clusterFootprintLayout,
  clusterFootprintSizes,
  type PinSet,
} from './pinLayers'
import { byStatus, groupStatus } from './statusLook'
import type { TrailOnGlobe } from './trailLayer'

/**
 * What the score cards' layout adds to the map (see cardLayout): the venue clusters moved cards'
 * trails end at, card clusters, the small pins of lone games with no room for a card, and the cards' footprints; the trails themselves and their venue dots
 * are the trail layer's (see trailLayer). They're drawn by the map rather than the page, so the place
 * names can draw over them (ADR-0010): the trails and clusters are layers beneath the names. The
 * score cards themselves are page elements above the map.
 */
export const cardLayoutSource = 'card-layout'

const kindIs = (kind: string): ['==', ['get', string], string] => ['==', ['get', 'kind'], kind]
export const cardClusterLayer = 'card-clusters'

/** The first of the card layout's layers, which the trail layer goes beneath (see GlobeMap). */
export const overTrails = 'venue-cluster-glows'

/**
 * The small pins of lone games with no room for a score card, which no other cluster or venue dot
 * would overlap (see cardLayoutDrawing), among the card layout's features: drawn and selected as any
 * small pin is (see pinLayers).
 */
export const cardlessPins: PinSet = { source: cardLayoutSource, prefix: 'cardless-', only: kindIs('smallPin') }
export const cardlessSmallPinLayer = 'cardless-pins'
export const cardlessSelectedPinLayer = 'cardless-pin-selected'

export const cardLayoutSourceSpec: GeoJSONSourceSpecification = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }

/**
 * A score card as it's laid out on screen, with its venue on the globe, its game's colour (see
 * gameColour) and whether it shows flames (see showsFlames).
 */
export interface CardOnGlobe extends ScreenCard {
  lngLat: [number, number]
  color: string
  flames: boolean
}

/**
 * How far, on screen, a trail's venue dot reaches, a venue cluster of this many games, and a card
 * cluster, ring or outline and all.
 */
export interface VenueSizes {
  dot: number
  cluster: (count: number) => number
  cardCluster: number
}

/**
 * A card cluster as drawn: its games, those with no room first, then any whose trails meet at it
 * (see cardLayoutDrawing), and where on the globe it's drawn.
 */
export interface DrawnCardCluster {
  gameIds: string[]
  lngLat: [number, number]
}

/**
 * What the map draws of a card layout: its features for the card layout source, the cards' trails,
 * the card clusters, and the games with no room shown as their small pins.
 */
export interface CardLayoutDrawing {
  source: FeatureCollection
  trails: TrailOnGlobe[]
  cardClusters: DrawnCardCluster[]
  smallPins: string[]
}

/**
 * The venue clusters, card clusters and footprints of a card layout, as features for the map, the
 * cards' trails (see trailLayer), and the card clusters as drawn. The layout is worked out on screen,
 * so its positions are turned back into places on the globe with `unproject`; venues are given as they
 * are, and footprints at them, offset on screen. Venue dots, venue clusters and card clusters that
 * would overlap on screen become one cluster instead (see gatherMarks): a card cluster if any of its
 * games has no room, counting every game in it, the trails of those whose cards are on screen meeting
 * at it; otherwise a venue cluster, the trails meeting at it. A cluster is never of one game: a game
 * with no room that nothing gathers in shows as its small pin, at its venue.
 */
export function cardLayoutDrawing(
  cards: readonly CardOnGlobe[],
  layout: CardLayout,
  unproject: (x: number, y: number) => [number, number],
  venueSizes: VenueSizes,
): CardLayoutDrawing {
  const features: Feature[] = []
  const trails: TrailOnGlobe[] = []
  const cardClusters: DrawnCardCluster[] = []
  const smallPins: string[] = []
  const byGame = new Map(cards.map((card) => [card.gameId, card]))
  const withTrails: CardOnGlobe[] = []
  for (const card of cards) {
    const placement = layout.cards.get(card.gameId)
    if (!placement || placement.inCardCluster) continue
    const { offset, trail } = placement
    if (trail) withTrails.push(card)
    // Centred on the card, wherever it is: at its venue, and as far from it on screen as the card, so
    // it stays on the card as the globe turns.
    const foot = [offset.dx, offset.dy - card.height / 2 + cardFootprint.height / 2]
    features.push(feature({ kind: 'footprint', offset: foot }, { type: 'Point', coordinates: card.lngLat }))
  }
  const noRoom = layout.cardClusters
    .map(({ gameIds }) => gameIds.flatMap((id) => byGame.get(id) ?? []))
    .filter((games) => games.length > 0)
  for (const mark of gatherMarks(withTrails, noRoom, venueSizes)) {
    const games = [...mark.clustered, ...mark.cards]
    const lngLat = mark.at ?? unproject(mark.x, mark.y)
    const dot = games.length === 1 && mark.clustered.length === 0
    for (const card of mark.cards) {
      const { trail } = layout.cards.get(card.gameId)!
      const start = { dx: trail!.x1 - card.venueX, dy: trail!.y1 - card.venueY }
      trails.push({ gameId: card.gameId, color: card.color, venue: card.lngLat, start, end: lngLat, dot })
    }
    if (dot) continue
    if (games.length === 1) {
      const [{ gameId, status, color, flames, lngLat: venue }] = games
      smallPins.push(gameId)
      features.push(feature({ kind: 'smallPin', gameId, status, color, flames }, { type: 'Point', coordinates: venue }))
      continue
    }
    const shared = {
      status: groupStatus(games.map((card) => card.status)),
      [sharedColorProperty]: sharedColourKey(games),
      count: games.length,
    }
    if (mark.clustered.length === 0) {
      features.push(feature({ kind: 'venueCluster', ...shared }, { type: 'Point', coordinates: lngLat }))
      continue
    }
    cardClusters.push({ gameIds: games.map((card) => card.gameId), lngLat })
    features.push(
      feature(
        // Flames for a game with no room: one whose card is on screen shows its own.
        { kind: 'cardCluster', ...shared, firstGameId: games[0].gameId, flames: mark.clustered.some((card) => card.flames) },
        { type: 'Point', coordinates: lngLat },
      ),
    )
  }
  return { source: { type: 'FeatureCollection', features }, trails, cardClusters, smallPins }
}

/**
 * Where cards' trails end on screen, or a card cluster: a venue dot for one card, a venue cluster for
 * more, and a card cluster once it holds a game with no room.
 */
interface Mark {
  /** The games whose cards are on screen, their trails ending here. */
  cards: CardOnGlobe[]
  /** The games with no room for a card. */
  clustered: CardOnGlobe[]
  x: number
  y: number
  /** Where it is on the globe, while it's a venue dot or a card cluster as the layout made it: the venue it's at. */
  at?: [number, number]
}

/**
 * Gathers cards' venue dots and card clusters so no two overlap: the two marks that overlap most become
 * one in the middle of their games' venues on screen (a venue cluster is wider than a dot, and the
 * more games it holds the wider; a card cluster is as wide as one of some), and again until none
 * overlap; of two that overlap as much, the first. How far apart each pair is is worked out once, and
 * again only for the mark just made: a crowd of cards can make many clusters a frame.
 */
function gatherMarks(cards: readonly CardOnGlobe[], noRoom: readonly CardOnGlobe[][], sizes: VenueSizes): Mark[] {
  // The cards' venues, then the card clusters, each at its first game's venue (see CardCluster), in
  // order; a mark gathered into another leaves an empty place.
  const marks: (Mark | null)[] = [
    ...cards.map((card): Mark => ({ cards: [card], clustered: [], x: card.venueX, y: card.venueY, at: card.lngLat })),
    ...noRoom.map((games): Mark => ({ cards: [], clustered: games, x: games[0].venueX, y: games[0].venueY, at: games[0].lngLat })),
  ]
  const count = marks.length
  const reach = ({ cards, clustered }: Mark) =>
    clustered.length > 0 ? sizes.cardCluster : cards.length === 1 ? sizes.dot : sizes.cluster(cards.length)
  // How far apart two marks are, edge to edge, the first before the second: they overlap below 0.
  const gaps = new Float64Array(count * count)
  const gapBetween = (i: number, j: number) => {
    const [a, b] = [marks[i]!, marks[j]!]
    gaps[i * count + j] = Math.hypot(a.x - b.x, a.y - b.y) - reach(a) - reach(b)
  }
  for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) gapBetween(i, j)
  for (;;) {
    let most: { i: number; j: number; gap: number } | null = null
    for (let i = 0; i < count; i++) {
      if (!marks[i]) continue
      for (let j = i + 1; j < count; j++) {
        const gap = gaps[i * count + j]
        if (marks[j] && gap < 0 && (!most || gap < most.gap)) most = { i, j, gap }
      }
    }
    if (!most) return marks.filter((mark) => mark !== null)
    const [a, b] = [marks[most.i]!, marks[most.j]!]
    const cards = [...a.cards, ...b.cards]
    const clustered = [...a.clustered, ...b.clustered]
    const games = [...cards, ...clustered]
    const middle = (of: (card: CardOnGlobe) => number) => games.reduce((sum, card) => sum + of(card), 0) / games.length
    marks[most.i] = { cards, clustered, x: middle((card) => card.venueX), y: middle((card) => card.venueY) }
    marks[most.j] = null
    for (let k = 0; k < count; k++) {
      if (k === most.i || !marks[k]) continue
      if (k < most.i) gapBetween(k, most.i)
      else gapBetween(most.i, k)
    }
  }
}

function feature(properties: Feature['properties'], geometry: Feature['geometry']): Feature {
  return { type: 'Feature', properties, geometry }
}

/**
 * The venue clusters moved cards' trails end at, and card clusters, from the bottom up. Added beneath
 * the place names, so every name draws over them, and over the trails beneath them (see trailLayer).
 *
 * A venue cluster and a card cluster are each a disc outlined and lit in its games' colour (see
 * clusterColour), with the count in it, as a pin cluster is (see the theme's cluster): a venue
 * cluster as wide as a pin cluster of as many games, a card cluster as one of some. A card cluster
 * holding a game that shows flames has a flame on its top edge, as a pin cluster does; a venue cluster
 * never does, as its games' cards are on screen, flames and all.
 */
export function cardLayoutLayers(
  theme: Theme,
): [
  CircleLayerSpecification,
  CircleLayerSpecification,
  SymbolLayerSpecification,
  CircleLayerSpecification,
  CircleLayerSpecification,
  SymbolLayerSpecification,
  SymbolLayerSpecification,
] {
  const { Cluster: cluster } = theme.components
  // Each cluster in its games' colour (see clusterColour).
  const clusterPaint = clusterColour(theme)
  return [
    {
      id: 'venue-cluster-glows',
      type: 'circle',
      source: cardLayoutSource,
      filter: kindIs('venueCluster'),
      paint: {
        'circle-radius': byCount(cluster.glowRadius, 'count'),
        'circle-color': clusterPaint,
        'circle-blur': 1,
        'circle-opacity': byStatus(theme, 'own', (look) => look.glow.opacity * cluster.glowOpacity),
      },
    },
    {
      id: 'venue-clusters',
      type: 'circle',
      source: cardLayoutSource,
      filter: kindIs('venueCluster'),
      paint: {
        'circle-radius': byCount(cluster.radius, 'count'),
        'circle-color': cluster.fill,
        'circle-opacity': byStatus(theme, 'own', (look) => look.clusterOpacity),
        'circle-stroke-width': cluster.outlineWidth,
        'circle-stroke-color': clusterPaint,
        'circle-stroke-opacity': byStatus(theme, 'own', (look) => look.clusterOpacity),
      },
    },
    {
      id: 'venue-cluster-counts',
      type: 'symbol',
      source: cardLayoutSource,
      filter: kindIs('venueCluster'),
      layout: {
        'text-field': ['to-string', ['get', 'count']],
        'text-font': [theme.components.Cluster.count.font.name],
        'text-size': theme.components.Cluster.count.size,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': clusterPaint, 'text-opacity': byStatus(theme, 'own', (look) => look.clusterOpacity) },
    },
    {
      id: 'card-cluster-glows',
      type: 'circle',
      source: cardLayoutSource,
      filter: kindIs('cardCluster'),
      paint: {
        'circle-radius': cluster.glowRadius.some,
        'circle-color': clusterPaint,
        'circle-blur': 1,
        'circle-opacity': byStatus(theme, 'own', (look) => look.glow.opacity * cluster.glowOpacity),
      },
    },
    {
      id: cardClusterLayer,
      type: 'circle',
      source: cardLayoutSource,
      filter: kindIs('cardCluster'),
      paint: {
        // As wide as a pin cluster of some games, outline and all: the stroke is drawn outside the radius.
        'circle-radius': cluster.radius.some - cluster.outlineWidth,
        'circle-color': cluster.fill,
        'circle-opacity': byStatus(theme, 'own', (look) => look.clusterOpacity),
        'circle-stroke-width': cluster.outlineWidth,
        'circle-stroke-color': clusterPaint,
        'circle-stroke-opacity': byStatus(theme, 'own', (look) => look.clusterOpacity),
      },
    },
    {
      id: 'card-cluster-counts',
      type: 'symbol',
      source: cardLayoutSource,
      filter: kindIs('cardCluster'),
      layout: {
        'text-field': ['to-string', ['get', 'count']],
        'text-font': [theme.components.Cluster.count.font.name],
        'text-size': theme.components.Cluster.count.size,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': clusterPaint, 'text-opacity': byStatus(theme, 'own', (look) => look.clusterOpacity) },
    },
    {
      id: 'card-cluster-flames',
      type: 'symbol',
      source: cardLayoutSource,
      filter: ['all', kindIs('cardCluster'), ['==', ['get', 'flames'], true]],
      layout: clusterFlameLayout(theme, clusterFlameOffset(theme, cluster.radius.some)),
      paint: { 'icon-opacity': byStatus(theme, 'own', (look) => look.clusterOpacity) },
    },
  ]
}

/**
 * An invisible stand-in for each score card with room, where it is, moved or not: score cards are
 * page elements MapLibre can't see, so these give place names something to avoid (see pinLayers' pin
 * footprints). A typical score card with a small margin: cards vary with their teams'
 * names and clock line, and a footprint image has one size, so it's an approximation.
 */
export const cardFootprint = { image: 'card-footprint', width: 106, height: 68 }

/** On top of every name, so names are placed around the cards rather than under them. */
export const cardFootprintLayerSpec: SymbolLayerSpecification = {
  id: 'card-footprints',
  type: 'symbol',
  source: cardLayoutSource,
  filter: kindIs('footprint'),
  layout: {
    'icon-image': cardFootprint.image,
    'icon-anchor': 'bottom',
    // Its offset from its card's venue, in pixels, whichever way the globe turns.
    'icon-offset': ['get', 'offset'],
    // Always placed, whatever else is there, and still keeps names out.
    'icon-allow-overlap': true,
  },
  paint: { 'icon-opacity': 0 },
}

/**
 * An invisible stand-in for each venue cluster and card cluster, as a pin cluster has (see pinLayers'
 * clusterFootprintLayout): a venue cluster as wide as a pin cluster of as many games, a card cluster
 * as one of some, outline and all.
 */
export function cardClusterFootprintLayerSpec(theme: Theme): SymbolLayerSpecification {
  return {
    id: 'card-cluster-footprints',
    type: 'symbol',
    source: cardLayoutSource,
    filter: ['in', ['get', 'kind'], ['literal', ['venueCluster', 'cardCluster']]],
    layout: clusterFootprintLayout([
      'case',
      kindIs('cardCluster'),
      clusterFootprintAcross(theme.components.Cluster.radius.some),
      byCount(clusterFootprintSizes(theme), 'count'),
    ]),
    paint: { 'icon-opacity': 0 },
  }
}
