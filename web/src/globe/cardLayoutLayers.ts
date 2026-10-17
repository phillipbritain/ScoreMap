import type { CircleLayerSpecification, GeoJSONSourceSpecification, SymbolLayerSpecification } from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'
import type { Theme } from '../theme/theme'
import type { CardLayout, ScreenCard } from './cardLayout'
import { clusterColour, sharedColorProperty, sharedColourKey } from './clusterColour'
import { byCount } from './pinLayers'
import { byStatus, groupStatus } from './statusLook'
import type { TrailOnGlobe } from './trailLayer'

/**
 * What the score cards' layout adds to the map (see cardLayout): the venue clusters moved cards'
 * trails end at, card clusters, and the cards' footprints; the trails themselves and their venue dots
 * are the trail layer's (see trailLayer). They're drawn by the map rather than the page, so the place
 * names can draw over them (ADR-0010): the trails and clusters are layers beneath the names. The
 * score cards themselves are page elements above the map.
 */
export const cardLayoutSource = 'card-layout'
export const cardClusterLayer = 'card-clusters'

/** The first of the card layout's layers, which the trail layer goes beneath (see GlobeMap). */
export const overTrails = 'venue-cluster-glows'

export const cardLayoutSourceSpec: GeoJSONSourceSpecification = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }

/** A score card as it's laid out on screen, with its venue on the globe and its game's colour (see gameColour). */
export interface CardOnGlobe extends ScreenCard {
  lngLat: [number, number]
  color: string
}

/** How far a trail's venue dot reaches, and a venue cluster of this many games, ring or outline and all. */
export interface VenueSizes {
  dot: number
  cluster: (count: number) => number
}

/** What the map draws of a card layout: its features for the card layout source, and the moved cards' trails. */
export interface CardLayoutDrawing {
  source: FeatureCollection
  trails: TrailOnGlobe[]
}

/**
 * The venue clusters, card clusters and footprints of a card layout, as features for the map, and the
 * moved cards' trails (see trailLayer). The layout is worked out on screen, so its positions are
 * turned back into places on the globe with `unproject`; venues are given as they are, and footprints
 * at them, offset on screen. Moved cards whose venue dots would overlap on screen share a venue
 * cluster instead, their trails meeting at it (see venueMarks).
 */
export function cardLayoutDrawing(
  cards: readonly CardOnGlobe[],
  layout: CardLayout,
  unproject: (x: number, y: number) => [number, number],
  venueSizes: VenueSizes,
): CardLayoutDrawing {
  const features: Feature[] = []
  const trails: TrailOnGlobe[] = []
  const byGame = new Map(cards.map((card) => [card.gameId, card]))
  const moved: CardOnGlobe[] = []
  for (const card of cards) {
    const placement = layout.cards.get(card.gameId)
    if (!placement || placement.inCardCluster) continue
    const { offset, trail } = placement
    if (trail) moved.push(card)
    // Centred on the card, wherever it is: at its venue, and as far from it on screen as the card, so
    // it stays on the card as the globe turns.
    const foot = [offset.dx, offset.dy - card.height / 2 + cardFootprint.height / 2]
    features.push(feature({ kind: 'footprint', offset: foot }, { type: 'Point', coordinates: card.lngLat }))
  }
  for (const mark of venueMarks(moved, venueSizes)) {
    const lngLat = mark.cards.length === 1 ? mark.cards[0].lngLat : unproject(mark.x, mark.y)
    const dot = mark.cards.length === 1
    for (const card of mark.cards) {
      const { trail } = layout.cards.get(card.gameId)!
      const start = { dx: trail!.x1 - card.venueX, dy: trail!.y1 - card.venueY }
      trails.push({ gameId: card.gameId, color: card.color, venue: card.lngLat, start, end: lngLat, dot })
    }
    if (dot) continue
    features.push(
      feature(
        {
          kind: 'venueCluster',
          status: groupStatus(mark.cards.map((card) => card.status)),
          [sharedColorProperty]: sharedColourKey(mark.cards),
          count: mark.cards.length,
        },
        { type: 'Point', coordinates: lngLat },
      ),
    )
  }
  for (const { gameIds, status } of layout.cardClusters) {
    const first = byGame.get(gameIds[0])
    if (!first) continue
    const clustered = gameIds.flatMap((id) => byGame.get(id) ?? [])
    features.push(
      feature(
        { kind: 'cardCluster', status, [sharedColorProperty]: sharedColourKey(clustered), count: gameIds.length, firstGameId: gameIds[0] },
        { type: 'Point', coordinates: first.lngLat },
      ),
    )
  }
  return { source: { type: 'FeatureCollection', features }, trails }
}

/** Where moved cards' trails end on screen: a venue dot for one card, or a venue cluster for more. */
interface VenueMark {
  cards: CardOnGlobe[]
  x: number
  y: number
}

/**
 * Gathers moved cards' venues so their marks don't overlap: the two marks that overlap most become a
 * venue cluster in the middle of their venues on screen (a venue cluster is wider than a dot, and the
 * more games it holds the wider), and again until none overlap; of two that overlap as much, the
 * first. How far apart each pair is is worked out once, and again only for the mark just made: a
 * crowd of cards can make many venue clusters a frame.
 */
function venueMarks(cards: readonly CardOnGlobe[], sizes: VenueSizes): VenueMark[] {
  // In the cards' order; a mark gathered into another leaves an empty place.
  const marks: (VenueMark | null)[] = cards.map((card) => ({ cards: [card], x: card.venueX, y: card.venueY }))
  const count = marks.length
  const reach = ({ cards }: VenueMark) => (cards.length === 1 ? sizes.dot : sizes.cluster(cards.length))
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
    const merged = [...marks[most.i]!.cards, ...marks[most.j]!.cards]
    const middle = (of: (card: CardOnGlobe) => number) => merged.reduce((sum, card) => sum + of(card), 0) / merged.length
    marks[most.i] = { cards: merged, x: middle((card) => card.venueX), y: middle((card) => card.venueY) }
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

const kindIs = (kind: string): ['==', ['get', string], string] => ['==', ['get', 'kind'], kind]

/**
 * The venue clusters moved cards' trails end at, and card clusters, from the bottom up. Added beneath
 * the place names, so every name draws over them, and over the trails beneath them (see trailLayer).
 *
 * A venue cluster and a card cluster are each a disc outlined and lit in its games' colour (see
 * clusterColour), with the count in it, as a pin cluster is (see the theme's cluster): a venue
 * cluster as wide as a pin cluster of as many games, a card cluster as one of some.
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
