import type {
  CircleLayerSpecification,
  GeoJSONSourceSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'
import type { Theme } from '../theme/theme'
import type { CardLayout, ScreenCard } from './cardLayout'
import { byCount } from './pinLayers'
import { byStatus, groupStatus } from './statusLook'

/**
 * What the score cards' layout adds to the map (see cardLayout): moved cards' trails and the venues
 * and venue clusters they end at, card clusters, and the cards' footprints. They're drawn by the map
 * rather than the page, so the place names can draw over them (ADR-0010): the trails, venues and
 * clusters are layers beneath the names. The score cards themselves are page elements above the map.
 */
export const cardLayoutSource = 'card-layout'
export const cardClusterLayer = 'card-clusters'

export const cardLayoutSourceSpec: GeoJSONSourceSpecification = {
  type: 'geojson',
  data: { type: 'FeatureCollection', features: [] },
}

/** A score card as it's laid out on screen, with its venue on the globe. */
export interface CardOnGlobe extends ScreenCard {
  lngLat: [number, number]
}

/** How far a trail's venue dot reaches, and a venue cluster of this many games, ring or outline and all. */
export interface VenueSizes {
  dot: number
  cluster: (count: number) => number
}

/**
 * The trails, venues, venue clusters, card clusters and footprints of a card layout, as features for
 * the map. The layout is worked out on screen, so its positions are turned back into places on the
 * globe with `unproject`; venues are given as they are. Moved cards whose venue dots would overlap on
 * screen share a venue cluster instead, their trails meeting at it (see venueMarks).
 */
export function cardLayoutFeatures(
  cards: readonly CardOnGlobe[],
  layout: CardLayout,
  unproject: (x: number, y: number) => [number, number],
  venueSizes: VenueSizes,
): FeatureCollection {
  const features: Feature[] = []
  const byGame = new Map(cards.map((card) => [card.gameId, card]))
  const moved: CardOnGlobe[] = []
  for (const card of cards) {
    const placement = layout.cards.get(card.gameId)
    if (!placement || placement.inCardCluster) continue
    const { offset, trail } = placement
    if (trail) moved.push(card)
    // Centred on the card, wherever it is.
    const foot = unproject(card.venueX + offset.dx, card.venueY + offset.dy - card.height / 2 + cardFootprint.height / 2)
    features.push(feature({ kind: 'footprint' }, { type: 'Point', coordinates: foot }))
  }
  for (const mark of venueMarks(moved, venueSizes)) {
    const lngLat = mark.cards.length === 1 ? mark.cards[0].lngLat : unproject(mark.x, mark.y)
    for (const card of mark.cards) {
      const { trail } = layout.cards.get(card.gameId)!
      features.push(
        feature({ kind: 'trail', status: card.status }, { type: 'LineString', coordinates: [unproject(trail!.x1, trail!.y1), lngLat] }),
      )
    }
    const status = groupStatus(mark.cards.map((card) => card.status))
    features.push(
      mark.cards.length === 1
        ? feature({ kind: 'venue', status }, { type: 'Point', coordinates: lngLat })
        : feature({ kind: 'venueCluster', status, count: mark.cards.length }, { type: 'Point', coordinates: lngLat }),
    )
  }
  for (const { gameIds, status } of layout.cardClusters) {
    const first = byGame.get(gameIds[0])
    if (!first) continue
    features.push(
      feature(
        { kind: 'cardCluster', status, count: gameIds.length, firstGameId: gameIds[0] },
        { type: 'Point', coordinates: first.lngLat },
      ),
    )
  }
  return { type: 'FeatureCollection', features }
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
 * more games it holds the wider), and again until none overlap. There are only as many as there are
 * moved cards on screen, so each pair is simply looked at afresh.
 */
function venueMarks(cards: readonly CardOnGlobe[], sizes: VenueSizes): VenueMark[] {
  const marks: VenueMark[] = cards.map((card) => ({ cards: [card], x: card.venueX, y: card.venueY }))
  const reach = ({ cards }: VenueMark) => (cards.length === 1 ? sizes.dot : sizes.cluster(cards.length))
  for (;;) {
    let most: { i: number; j: number; gap: number } | null = null
    for (let i = 0; i < marks.length; i++) {
      for (let j = i + 1; j < marks.length; j++) {
        const gap = Math.hypot(marks[i].x - marks[j].x, marks[i].y - marks[j].y) - reach(marks[i]) - reach(marks[j])
        if (gap < 0 && (!most || gap < most.gap)) most = { i, j, gap }
      }
    }
    if (!most) return marks
    const merged = [...marks[most.i].cards, ...marks[most.j].cards]
    const middle = (of: (card: CardOnGlobe) => number) => merged.reduce((sum, card) => sum + of(card), 0) / merged.length
    marks[most.i] = { cards: merged, x: middle((card) => card.venueX), y: middle((card) => card.venueY) }
    marks.splice(most.j, 1)
  }
}

function feature(properties: Feature['properties'], geometry: Feature['geometry']): Feature {
  return { type: 'Feature', properties, geometry }
}

const kindIs = (kind: string): ['==', ['get', string], string] => ['==', ['get', 'kind'], kind]

/**
 * Moved cards' trails, the venues and venue clusters they end at, and card clusters, from the bottom
 * up. Added beneath the place names, so every name draws over them.
 *
 * A trail is a thin line lit in its game's status colour, like a score card's outline, in a soft glow,
 * to a point ringed in it. A venue cluster and a card cluster are each a disc outlined and lit in the
 * colour of its most prominent game, with the count in it, as a pin cluster is (see the theme's
 * cluster): a venue cluster as wide as a pin cluster of as many games, a card cluster as one of some.
 */
export function cardLayoutLayers(
  theme: Theme,
): [
  LineLayerSpecification,
  LineLayerSpecification,
  CircleLayerSpecification,
  CircleLayerSpecification,
  CircleLayerSpecification,
  CircleLayerSpecification,
  SymbolLayerSpecification,
  CircleLayerSpecification,
  CircleLayerSpecification,
  SymbolLayerSpecification,
] {
  const { Cluster: cluster, Trail: trail } = theme.components
  // Each trail, venue and cluster in its game's status colour (a cluster's, see groupStatus).
  const statusColor = byStatus(theme, 'own', (look) => look.color)
  return [
    {
      id: 'trail-glows',
      type: 'line',
      source: cardLayoutSource,
      filter: kindIs('trail'),
      paint: {
        'line-color': statusColor,
        'line-width': trail.glow.width,
        'line-blur': trail.glow.blur,
        'line-opacity': trail.glow.opacity,
      },
    },
    {
      id: 'trails',
      type: 'line',
      source: cardLayoutSource,
      filter: kindIs('trail'),
      paint: { 'line-color': statusColor, 'line-width': trail.width, 'line-opacity': trail.opacity },
    },
    {
      id: 'trail-venue-rings',
      type: 'circle',
      source: cardLayoutSource,
      filter: kindIs('venue'),
      paint: {
        'circle-radius': trail.venue.ring.radius,
        'circle-color': 'transparent',
        'circle-stroke-width': trail.venue.ring.width,
        'circle-stroke-color': statusColor,
      },
    },
    {
      id: 'trail-venues',
      type: 'circle',
      source: cardLayoutSource,
      filter: kindIs('venue'),
      paint: { 'circle-radius': trail.venue.radius, 'circle-color': statusColor },
    },
    {
      id: 'venue-cluster-glows',
      type: 'circle',
      source: cardLayoutSource,
      filter: kindIs('venueCluster'),
      paint: {
        'circle-radius': byCount(cluster.glowRadius, 'count'),
        'circle-color': statusColor,
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
        'circle-stroke-color': statusColor,
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
      paint: { 'text-color': statusColor, 'text-opacity': byStatus(theme, 'own', (look) => look.clusterOpacity) },
    },
    {
      id: 'card-cluster-glows',
      type: 'circle',
      source: cardLayoutSource,
      filter: kindIs('cardCluster'),
      paint: {
        'circle-radius': cluster.glowRadius.some,
        'circle-color': statusColor,
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
        'circle-stroke-color': statusColor,
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
      paint: { 'text-color': statusColor, 'text-opacity': byStatus(theme, 'own', (look) => look.clusterOpacity) },
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
    // Always placed, whatever else is there, and still keeps names out.
    'icon-allow-overlap': true,
  },
  paint: { 'icon-opacity': 0 },
}
