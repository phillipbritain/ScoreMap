import type { CircleLayerSpecification, GeoJSONSourceSpecification, SymbolLayerSpecification } from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'
import type { Theme } from '../theme/theme'
import type { CardLayout, ScreenCard } from './cardLayout'
import { accentColor } from '../settings/gameColor'
import { clusterColor, mixedColors, sharedColorProperty, sharedColorKey } from './clusterColor'
import {
  clusterHotIndicatorLayout,
  clusterHotIndicatorImage,
  clusterFootprintAcross,
  clusterFootprintLayout,
  type PinSet,
} from './pinLayers'
import { byStatus, dimmedColor, groupStatus } from './statusLook'
import type { TrailOnGlobe } from './trailLayer'

/**
 * What the card layout adds to the map (see cardLayout): the venue clusters moved cards' trails end
 * at, card clusters, the small pins of lone games with no room for a card, and the cards' footprints;
 * the trails themselves and their venue dots are the trail layer's (see trailLayer). They're drawn by the map rather than the page, so the place
 * names can draw over them (ADR-0010): the trails and clusters are layers beneath the names. The
 * score cards themselves are page elements above the map.
 */
export const cardLayoutSource = 'card-layout'

const kindIs = (kind: string): ['==', ['get', string], string] => ['==', ['get', 'kind'], kind]
export const cardClusterLayer = 'card-clusters'

/** The first of the card layout's layers, which the trail layer goes beneath (see GlobeMap). */
export const overTrails = 'venue-cluster-rings'

/**
 * The small pins of lone games with no room for a score card, which no other cluster or venue dot
 * would overlap (see cardLayout), among the card layout's features: drawn and selected as any
 * small pin is (see pinLayers).
 */
export const cardlessPins: PinSet = { source: cardLayoutSource, prefix: 'cardless-', only: kindIs('smallPin') }
export const cardlessSmallPinLayer = 'cardless-pins'
export const cardlessSelectedPinLayer = 'cardless-pin-selected'

/**
 * How far a card cluster reaches from its middle, outline and all (see the theme's Cluster).
 */
export const cardClusterReach = (theme: Theme): number => theme.components.Cluster.radius

export const cardLayoutSourceSpec: GeoJSONSourceSpecification = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }

/**
 * A score card as it's laid out on screen, with its venue on the globe, its game's color (see
 * gameColor) and whether it is hot.
 */
export interface CardOnGlobe extends ScreenCard {
  lngLat: [number, number]
  color: string
  hotIndicator: boolean
}

/** A card cluster as drawn: its games, those with no room first (see Showing), and where on the globe it's drawn. */
export interface DrawnCardCluster {
  gameIds: readonly string[]
  lngLat: [number, number]
}

/**
 * What the map draws of a card layout: its features for the card layout source, the cards' trails,
 * and the card clusters.
 */
export interface CardLayoutDrawing {
  source: FeatureCollection
  trails: TrailOnGlobe[]
  cardClusters: DrawnCardCluster[]
}

/**
 * The venue clusters, card clusters, small pins and footprints of a card layout, as features for the
 * map, the cards' trails (see trailLayer), and the card clusters as drawn. The layout is worked out on
 * screen, so a point between venues is turned back into a place on the globe with `unproject`; what's
 * at a game's venue is put there, and footprints at their venues, offset on screen.
 */
export function cardLayoutDrawing(
  cards: readonly CardOnGlobe[],
  layout: Pick<CardLayout, 'shows' | 'gatherings'>,
  unproject: (x: number, y: number) => [number, number],
  theme: Theme,
): CardLayoutDrawing {
  const features: Feature[] = []
  const trails: TrailOnGlobe[] = []
  const cardClusters: DrawnCardCluster[] = []
  const byGame = new Map(cards.map((card) => [card.gameId, card]))
  for (const card of cards) {
    const showing = layout.shows(card.gameId)
    if (showing.as !== 'card') continue
    // Centered on the card, wherever it is: at its venue, and as far from it on screen as the card, so
    // it stays on the card as the globe turns.
    const foot = [showing.offset.dx, showing.offset.dy - card.height / 2 + cardFootprint.height / 2]
    features.push(feature({ kind: 'footprint', offset: foot }, { type: 'Point', coordinates: card.lngLat }))
  }
  for (const gathering of layout.gatherings()) {
    const { kind, at } = gathering
    const lngLat = 'venueOf' in at ? byGame.get(at.venueOf)!.lngLat : unproject(at.x, at.y)
    const noRoom = gathering.noRoom.map((id) => byGame.get(id)!)
    const withTrails = gathering.trails.map((id) => byGame.get(id)!)
    for (const card of withTrails) {
      const showing = layout.shows(card.gameId)
      if (showing.as !== 'card') continue
      const start = { dx: showing.trail.x1 - card.venueX, dy: showing.trail.y1 - card.venueY }
      trails.push({
        gameId: card.gameId,
        color: dimmedColor(theme, card.color, card.status),
        venue: card.lngLat,
        start,
        end: lngLat,
        dot: kind === 'venueDot',
        ...(showing.firstLeg && { firstLeg: showing.firstLeg }),
      })
    }
    if (kind === 'venueDot') continue
    if (kind === 'smallPin') {
      const [{ gameId, status, color, hotIndicator }] = noRoom
      features.push(feature({ kind: 'smallPin', gameId, status, color: dimmedColor(theme, color, status), hotIndicator }, { type: 'Point', coordinates: lngLat }))
      continue
    }
    const games = [...noRoom, ...withTrails]
    const shared = { status: groupStatus(games.map((card) => card.status)), [sharedColorProperty]: sharedColorKey(games) }
    if (kind === 'venueCluster') {
      // Dimmed by the status it shows as, in its games' color, or the accent where they differ (see clusterColor).
      const color = shared[sharedColorProperty] === mixedColors ? accentColor(theme) : shared[sharedColorProperty]
      features.push(feature({ kind: 'venueCluster', ...shared, color: dimmedColor(theme, color, shared.status) }, { type: 'Point', coordinates: lngLat }))
      continue
    }
    cardClusters.push({ gameIds: games.map((card) => card.gameId), lngLat })
    features.push(
      feature(
        // The hot indicator for a game with no room: one whose card is on screen shows its own.
        { kind: 'cardCluster', ...shared, count: games.length, firstGameId: games[0].gameId, hotIndicator: noRoom.some((card) => card.hotIndicator) },
        { type: 'Point', coordinates: lngLat },
      ),
    )
  }
  return { source: { type: 'FeatureCollection', features }, trails, cardClusters }
}

function feature(properties: Feature['properties'], geometry: Feature['geometry']): Feature {
  return { type: 'Feature', properties, geometry }
}

/**
 * The venue clusters moved cards' trails end at, and card clusters, from the bottom up. Added beneath
 * the place names, so every name draws over them, and over the trails beneath them (see trailLayer).
 *
 * A venue cluster is drawn as the venue dot its trails would otherwise each end at (see trailLayer), a
 * dot in a ring, in its games' color (see clusterColor), with no count: its games' cards are on
 * screen. A card cluster is a disc outlined and lit in its games' color, with the count in it (see
 * cardClusterReach). A card cluster holding a game that shows
 * the hot indicator has it around its disc; a venue cluster never does, as its games' cards are on screen,
 * indicators and all.
 */
export function cardLayoutLayers(
  theme: Theme,
): [
  CircleLayerSpecification,
  CircleLayerSpecification,
  CircleLayerSpecification,
  SymbolLayerSpecification,
  CircleLayerSpecification,
  SymbolLayerSpecification,
] {
  const { Cluster: cluster } = theme.components
  const { venue } = theme.components.Trail
  // Each cluster in its games' color (see clusterColor).
  const clusterPaint = clusterColor(theme)
  // The cluster's wider disc needs the same span outside its edge as the small pin's glow.
  const glowRadius = cluster.matchPinGlow ? byStatus(theme, ({ glow, core }) =>
    glow.radius === 0 ? 0 : Math.max(0, glow.radius + cluster.radius - core.radius - core.ring)) : cluster.glowRadius
  return [
    {
      // A venue cluster's ring, beneath its dot, as the trail layer draws a venue dot's.
      id: overTrails,
      type: 'circle',
      source: cardLayoutSource,
      filter: kindIs('venueCluster'),
      paint: {
        'circle-radius': venue.ring.radius,
        'circle-opacity': 0,
        'circle-stroke-width': venue.ring.width,
        'circle-stroke-color': ['get', 'color'],
      },
    },
    {
      id: 'venue-clusters',
      type: 'circle',
      source: cardLayoutSource,
      filter: kindIs('venueCluster'),
      paint: { 'circle-radius': venue.radius, 'circle-color': ['get', 'color'] },
    },
    {
      id: 'card-cluster-glows',
      type: 'circle',
      source: cardLayoutSource,
      filter: kindIs('cardCluster'),
      paint: {
        'circle-radius': glowRadius,
        'circle-color': clusterPaint,
        'circle-blur': 1,
        'circle-opacity': byStatus(theme, (look) => look.glow.opacity * cluster.glowOpacity),
      },
    },
    {
      id: 'card-cluster-hot-indicator',
      type: 'symbol',
      source: cardLayoutSource,
      filter: ['all', kindIs('cardCluster'), ['==', ['get', 'hotIndicator'], true]],
      layout: clusterHotIndicatorLayout(clusterHotIndicatorImage(theme, cluster.radius)),
      paint: { 'icon-opacity': byStatus(theme, (look) => look.clusterOpacity) },
    },
    {
      id: cardClusterLayer,
      type: 'circle',
      source: cardLayoutSource,
      filter: kindIs('cardCluster'),
      paint: {
        // As wide as cardClusterReach, outline and all: the stroke is drawn outside the radius.
        'circle-radius': cardClusterReach(theme) - cluster.outlineWidth,
        'circle-color': cluster.fillWithGameColor ? clusterPaint : cluster.fill,
        'circle-opacity': byStatus(theme, (look) => look.clusterOpacity),
        'circle-stroke-width': cluster.outlineWidth,
        'circle-stroke-color': clusterPaint,
        'circle-stroke-opacity': byStatus(theme, (look) => look.clusterOpacity),
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
      paint: {
        'text-color': cluster.count.color ?? clusterPaint,
        'text-opacity': cluster.fillWithGameColor ? 1 : byStatus(theme, (look) => look.clusterOpacity),
      },
    },
  ]
}

/**
 * An invisible stand-in for each score card with room, where it is, moved or not: score cards are
 * page elements MapLibre can't see, so these give place names something to avoid (see pinLayers' pin
 * footprints). A typical score card with a small margin: cards vary with their teams'
 * names and clock line, and a footprint image has one size, so it's an approximation.
 */
export const cardFootprint = { image: 'card-footprint', width: 78, height: 50 }

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
 * An invisible stand-in for each card cluster (see pinLayers' clusterFootprintLayout), as wide as the
 * card cluster, outline and all. A venue cluster has none, as a venue dot has none: it has no count
 * to keep readable.
 */
export function cardClusterFootprintLayerSpec(theme: Theme): SymbolLayerSpecification {
  return {
    id: 'card-cluster-footprints',
    type: 'symbol',
    source: cardLayoutSource,
    filter: kindIs('cardCluster'),
    layout: clusterFootprintLayout(clusterFootprintAcross(cardClusterReach(theme))),
    paint: { 'icon-opacity': 0 },
  }
}
