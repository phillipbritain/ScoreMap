import type {
  CircleLayerSpecification,
  GeoJSONSourceSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'
import type { Theme } from '../theme/theme'
import type { CardLayout, ScreenCard } from './cardLayout'
import { byStatus } from './statusLook'

/**
 * What the score cards' layout adds to the map (see cardLayout): moved cards' trails and the venues
 * they end at, card clusters, and the cards' footprints. They're drawn by the map rather than the
 * page, so the place names can draw over them (ADR-0010): the trails, venues and card clusters are
 * layers beneath the names. The score cards themselves are page elements above the map.
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

/**
 * The trails, venues, card clusters and footprints of a card layout, as features for the map. The
 * layout is worked out on screen, so its positions are turned back into places on the globe with
 * `unproject`; venues are given as they are.
 */
export function cardLayoutFeatures(
  cards: readonly CardOnGlobe[],
  layout: CardLayout,
  unproject: (x: number, y: number) => [number, number],
): FeatureCollection {
  const features: Feature[] = []
  const byGame = new Map(cards.map((card) => [card.gameId, card]))
  for (const card of cards) {
    const placement = layout.cards.get(card.gameId)
    if (!placement || placement.inCardCluster) continue
    const { offset, trail } = placement
    const { status, lngLat } = card
    if (trail) {
      features.push(
        feature({ kind: 'trail', status }, { type: 'LineString', coordinates: [unproject(trail.x1, trail.y1), lngLat] }),
        feature({ kind: 'venue', status }, { type: 'Point', coordinates: lngLat }),
      )
    }
    // A card sitting above its venue points down to it, so its footprint (pointer and all) stands on
    // the venue; a moved card has no pointer, so its footprint is centred on the card.
    const foot = trail
      ? unproject(card.venueX + offset.dx, card.venueY + offset.dy - card.height / 2 + cardFootprint.height / 2)
      : lngLat
    features.push(feature({ kind: 'footprint' }, { type: 'Point', coordinates: foot }))
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

function feature(properties: Feature['properties'], geometry: Feature['geometry']): Feature {
  return { type: 'Feature', properties, geometry }
}

const kindIs = (kind: string): ['==', ['get', string], string] => ['==', ['get', 'kind'], kind]

/**
 * Moved cards' trails, the venues they end at, and card clusters, from the bottom up. Added beneath
 * the place names, so every name draws over them.
 *
 * A trail is a thin line lit in its game's status colour, like a score card's outline, in a soft glow,
 * to a point ringed in it. A card cluster is a disc outlined and lit in the colour of its most
 * prominent game, with the count in it, as a pin cluster is (see the theme's cluster).
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
] {
  const { cluster, trail } = theme
  // Each trail, venue and card cluster in its game's status colour (a card cluster's, see groupStatus).
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
      id: 'card-cluster-glows',
      type: 'circle',
      source: cardLayoutSource,
      filter: kindIs('cardCluster'),
      paint: {
        'circle-radius': cluster.glowRadius.some,
        'circle-color': statusColor,
        'circle-blur': 1,
        'circle-opacity': byStatus(theme, 'own', (look) => look.clusterOpacity * cluster.glowOpacity),
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
        'text-font': [theme.fonts.clusterCount.font.name],
        'text-size': theme.fonts.clusterCount.size,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': statusColor, 'text-opacity': byStatus(theme, 'own', (look) => look.clusterOpacity) },
    },
  ]
}

/**
 * An invisible stand-in for each score card with room, where it is, moved or not: score cards are
 * page elements MapLibre can't see, so these give place names something to avoid (see pinLayers' pin
 * footprints). A typical score card with its pointer and a small margin: cards vary with their teams'
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
