import { createExpression, type ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec'
import type { LayerSpecification, SymbolLayerSpecification } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'
import builtIn from '../theme/builtInTheme.json'
import { resolveTheme, type Theme } from '../theme/theme'
import type { GameStatus } from '../games/game'
import type { CardLayout } from './cardLayout'
import { cardLayoutFeatures, cardLayoutLayers } from './cardLayoutLayers'
import { smallPinReach } from './panelClearance'
import { pinClusterLayers, pinClusterSpacing, pinSourceSpec, selectedPinLayerSpec, smallPinLayers, zoomedOutPins } from './pinLayers'

/** The built-in theme, with cluster counts in another font and size. */
function testTheme(): Theme {
  const json = structuredClone(builtIn) as Record<string, any>
  json.components.Cluster.count = { font: 'Metropolis Semi Bold', size: 'body1' }
  json.typography.body1.fontSize = 16
  const result = resolveTheme(json)
  if (!result.ok) throw new Error(result.problems.join('\n'))
  return result.theme
}

const countLayout = (layers: readonly LayerSpecification[], id: string) =>
  (layers.find((l) => l.id === id) as SymbolLayerSpecification).layout

/**
 * What a style expression gives for a feature with these properties, as MapLibre works it out, with
 * what a cluster property has gathered so far when it's gathering one.
 */
function evaluate(value: unknown, properties: Record<string, unknown>, accumulated: unknown = null): unknown {
  const parsed = createExpression(value as ExpressionSpecification, 'test')
  if (parsed.result !== 'success') throw new Error(parsed.value.map((e) => e.message).join('; '))
  return parsed.value.evaluate({ zoom: 0, accumulated } as never, { type: 'Point', properties } as never)
}

const paintOf = (layers: readonly LayerSpecification[], id: string) =>
  layers.find((l) => l.id === id)?.paint as Record<string, unknown>

/** The built-in theme, with clusters and trails in sizes of their own. */
function sizedTheme(): Theme {
  const json = structuredClone(builtIn) as Record<string, any>
  json.components.Cluster.radius = { few: 10, some: 14, many: 20 }
  json.components.Cluster.glowRadius = { few: 21, some: 27, many: 35 }
  json.components.Cluster.outlineWidth = 2
  json.components.Trail = { width: 1.5, opacity: 0.8, seeThrough: { on: false, opacity: 0.5 }, glow: { width: 5, blur: 2, opacity: 0.3 }, venue: { radius: 3, ring: { radius: 6, width: 1.5 } } }
  const result = resolveTheme(json)
  if (!result.ok) throw new Error(result.problems.join('\n'))
  return result.theme
}

describe('clusters', () => {
  it("draw a pin cluster at the theme's size for how many games it holds, glow and all", () => {
    const layers = pinClusterLayers(sizedTheme(), zoomedOutPins)
    const sizes = (id: string, property: string) =>
      [3, 4, 5, 14, 15, 99].map((count) => evaluate(paintOf(layers, id)[property], { point_count: count, live: 1 }))
    expect(sizes('pin-clusters', 'circle-radius')).toEqual([10, 10, 14, 14, 20, 20])
    expect(sizes('pin-cluster-glows', 'circle-radius')).toEqual([21, 21, 27, 27, 35, 35])
    expect(paintOf(layers, 'pin-clusters')['circle-stroke-width']).toBe(2)
  })

  it('glow as small pins of the status they show as do, as strongly as the theme says, or not at all', () => {
    const json = structuredClone(builtIn) as Record<string, any>
    json.components.Pin.live.glow.opacity = 0.8
    json.components.Pin.final.glow.opacity = 0
    json.components.Cluster.glowOpacity = 0.5
    const result = resolveTheme(json)
    if (!result.ok) throw new Error(result.problems.join('\n'))
    const pinClusterGlow = paintOf(pinClusterLayers(result.theme, zoomedOutPins), 'pin-cluster-glows')['circle-opacity']
    expect(evaluate(pinClusterGlow, { point_count: 2, live: 1, upcoming: 0, final: 1 })).toBeCloseTo(0.4, 6)
    expect(evaluate(pinClusterGlow, { point_count: 2, live: 0, upcoming: 0, final: 2 })).toBe(0)
    const cardClusterGlow = paintOf(cardLayoutLayers(result.theme), 'card-cluster-glows')['circle-opacity']
    expect(evaluate(cardClusterGlow, { status: 'Live' })).toBeCloseTo(0.4, 6)
    expect(evaluate(cardClusterGlow, { status: 'Final' })).toBe(0)
  })

  it('fade as the status they show as says, disc, outline and count alike, on pin clusters and card clusters', () => {
    const json = structuredClone(builtIn) as Record<string, any>
    json.components.Cluster.live.opacity = 1
    json.components.Cluster.final.opacity = 0.4
    const result = resolveTheme(json)
    if (!result.ok) throw new Error(result.problems.join('\n'))
    /** How opaque a cluster's disc, outline and count are, for a cluster with these properties. */
    const faded = (layers: readonly LayerSpecification[], [disc, count]: [string, string], properties: Record<string, unknown>) =>
      [paintOf(layers, disc)['circle-opacity'], paintOf(layers, disc)['circle-stroke-opacity'], paintOf(layers, count)['text-opacity']].map(
        (opacity) => evaluate(opacity, properties),
      )
    const pinClusters = pinClusterLayers(result.theme, zoomedOutPins)
    const pinCluster: [string, string] = ['pin-clusters', 'pin-cluster-counts']
    expect(faded(pinClusters, pinCluster, { point_count: 2, live: 1, upcoming: 0, final: 1 })).toEqual([1, 1, 1])
    expect(faded(pinClusters, pinCluster, { point_count: 2, live: 0, upcoming: 0, final: 2 })).toEqual([0.4, 0.4, 0.4])
    const cardClusters = cardLayoutLayers(result.theme)
    const cardCluster: [string, string] = ['card-clusters', 'card-cluster-counts']
    expect(faded(cardClusters, cardCluster, { status: 'Live' })).toEqual([1, 1, 1])
    expect(faded(cardClusters, cardCluster, { status: 'Final' })).toEqual([0.4, 0.4, 0.4])
  })

  it("draw a card cluster as a pin cluster of some games, its outline inside its size", () => {
    const paint = (id: string) => paintOf(cardLayoutLayers(sizedTheme()), id)
    expect(paint('card-clusters')['circle-radius']).toBe(14 - 2)
    expect(paint('card-clusters')['circle-stroke-width']).toBe(2)
    expect(paint('card-cluster-glows')['circle-radius']).toBe(27)
  })
})

describe('trails', () => {
  it("are drawn at the theme's widths and opacities, in a glow, to a venue ringed at the theme's sizes", () => {
    const paint = (id: string) => paintOf(cardLayoutLayers(sizedTheme()), id)
    expect(paint('trails')).toMatchObject({ 'line-width': 1.5, 'line-opacity': 0.8 })
    expect(paint('trail-glows')).toMatchObject({ 'line-width': 5, 'line-blur': 2, 'line-opacity': 0.3 })
    expect(paint('trail-venues')).toMatchObject({ 'circle-radius': 3 })
    expect(paint('trail-venue-rings')).toMatchObject({ 'circle-radius': 6, 'circle-stroke-width': 1.5 })
  })

  it('let the map show through when see-through: their line and glow that much more see-through', () => {
    const theme = sizedTheme()
    const seeThrough = { ...theme, components: { ...theme.components, Trail: { ...theme.components.Trail, seeThrough: { on: true, opacity: 0.5 } } } }
    const paint = (id: string) => paintOf(cardLayoutLayers(seeThrough), id)
    expect(paint('trails')).toMatchObject({ 'line-opacity': 0.4 })
    expect(paint('trail-glows')).toMatchObject({ 'line-opacity': 0.15 })
  })
})

describe("a game's colour", () => {
  const game = { status: 'Live', color: '#123456', coreColor: '#654321' }

  it('lights a small pin: its glow and ring in the colour, its core in the core colour', () => {
    const paint = (id: string) => paintOf(smallPinLayers(sizedTheme(), zoomedOutPins), id)
    expect(evaluate(paint('pin-glows')['circle-color'], game)).toBe('#123456')
    expect(evaluate(paint('pins')['circle-stroke-color'], game)).toBe('#123456')
    expect(evaluate(paint('pins')['circle-color'], game)).toBe('#654321')
  })

  it("lights a moved card's trail, its glow and the venue it ends at", () => {
    const paint = (id: string) => paintOf(cardLayoutLayers(sizedTheme()), id)
    for (const [id, property] of [
      ['trails', 'line-color'],
      ['trail-glows', 'line-color'],
      ['trail-venues', 'circle-color'],
      ['trail-venue-rings', 'circle-stroke-color'],
    ]) {
      expect(evaluate(paint(id)[property], game), id).toBe('#123456')
    }
  })
})

describe("a cluster's colour", () => {
  /** The built-in theme, its accent (Live's colour) and Disrupted's colour each unlike any game's below. */
  function colourTheme(): Theme {
    const json = structuredClone(builtIn) as Record<string, any>
    json.palette.live.main = '#ff0000'
    json.palette.disrupted.main = '#808080'
    const result = resolveTheme(json)
    if (!result.ok) throw new Error(result.problems.join('\n'))
    return result.theme
  }

  interface ClusteredGame {
    status: GameStatus
    color: string
  }

  /** The properties the pin source gives a pin cluster of these games' pins, as MapLibre gathers them. */
  function pinClusterOf(games: readonly ClusteredGame[]): Record<string, unknown> {
    const { clusterProperties } = pinSourceSpec({ type: 'FeatureCollection', features: [] }, { size: 'small', clusterRadius: 35 })
    return Object.fromEntries(
      Object.entries(clusterProperties as Record<string, [unknown, unknown]>).map(([key, [operator, perPin]]) => {
        const reduce = typeof operator === 'string' ? [operator, ['accumulated'], ['get', key]] : operator
        const mapped = games.map((game) => evaluate(perPin, { ...game }))
        return [key, mapped.reduce((gathered, next) => evaluate(reduce, { [key]: next }, gathered))]
      }),
    )
  }

  /** The properties of a card cluster of these games' cards. */
  function cardClusterOf(games: readonly ClusteredGame[]): Record<string, unknown> {
    const cards = games.map(({ status, color }, i) => ({
      gameId: `${i}`,
      status,
      color,
      venueX: 0,
      venueY: 0,
      width: 100,
      height: 60,
      lngLat: [0, 0] as [number, number],
    }))
    const layout: CardLayout = {
      cards: new Map(cards.map(({ gameId }) => [gameId, { offset: { dx: 0, dy: -6 }, inCardCluster: true, moved: false, trail: null }])),
      cardClusters: [{ gameIds: cards.map(({ gameId }) => gameId), status: 'Live', x: 0, y: 0 }],
    }
    const { features } = cardLayoutFeatures(cards, layout, (x, y) => [x, y], { dot: 6, cluster: () => 12 })
    return features.find((feature) => feature.properties?.kind === 'cardCluster')!.properties!
  }

  /** The colours a pin cluster and a card cluster of these games show in: glow, outline and count, each. */
  function coloursOf(games: readonly ClusteredGame[]): string[] {
    const theme = colourTheme()
    const pinLayers = pinClusterLayers(theme, zoomedOutPins)
    const cardLayers = cardLayoutLayers(theme)
    const pinCluster = { ...pinClusterOf(games), point_count: games.length }
    const cardCluster = cardClusterOf(games)
    return [
      ...[
        ['pin-cluster-glows', 'circle-color'],
        ['pin-clusters', 'circle-stroke-color'],
        ['pin-cluster-counts', 'text-color'],
      ].map(([id, property]) => evaluate(paintOf(pinLayers, id)[property], pinCluster) as string),
      ...[
        ['card-cluster-glows', 'circle-color'],
        ['card-clusters', 'circle-stroke-color'],
        ['card-cluster-counts', 'text-color'],
      ].map(([id, property]) => evaluate(paintOf(cardLayers, id)[property], cardCluster) as string),
    ]
  }

  const everywhere = (colour: string) => Array(6).fill(colour)

  it('is the colour its games share, on pin clusters and card clusters alike', () => {
    const games: ClusteredGame[] = [
      { status: 'Live', color: '#123456' },
      { status: 'Final', color: '#123456' },
      { status: 'Upcoming', color: '#123456' },
    ]
    expect(coloursOf(games)).toEqual(everywhere('#123456'))
  })

  it("is the theme's accent when its games' colours differ", () => {
    const games: ClusteredGame[] = [
      { status: 'Live', color: '#123456' },
      { status: 'Live', color: '#123456' },
      { status: 'Final', color: '#654321' },
    ]
    expect(coloursOf(games)).toEqual(everywhere('#ff0000'))
  })

  it("leaves out Disrupted games, showing Disrupted's colour only when all its games are", () => {
    const disrupted: ClusteredGame = { status: 'Disrupted', color: '#808080' }
    const someDisrupted: ClusteredGame[] = [disrupted, { status: 'Live', color: '#123456' }, disrupted, { status: 'Upcoming', color: '#123456' }]
    expect(coloursOf(someDisrupted)).toEqual(everywhere('#123456'))
    expect(coloursOf([disrupted, disrupted])).toEqual(everywhere('#808080'))
  })
})

describe('pinClusterSpacing', () => {
  it('keeps the widest pin clusters apart, outline and all', () => {
    // Pin clusters reach 20 pixels, and 2 more with their outline; small pins 9.
    expect(pinClusterSpacing(sizedTheme())).toBe(44)
  })

  it('keeps small pins apart when they are wider than any pin cluster', () => {
    const json = structuredClone(builtIn) as Record<string, any>
    json.components.Pin.live.glow.radius = 60
    const result = resolveTheme(json)
    if (!result.ok) throw new Error(result.problems.join('\n'))
    expect(pinClusterSpacing(result.theme)).toBe(72)
  })
})

describe('the selected pin', () => {
  it("is ringed in the theme's selection colour and width, out to as far as a small pin reaches", () => {
    const json = structuredClone(builtIn) as Record<string, any>
    json.components.Selection = { color: '#00ff00', width: 4 }
    const result = resolveTheme(json)
    if (!result.ok) throw new Error(result.problems.join('\n'))
    expect(selectedPinLayerSpec(result.theme, 'a', zoomedOutPins).paint).toMatchObject({
      'circle-radius': smallPinReach - 4,
      'circle-stroke-width': 4,
      'circle-stroke-color': '#00ff00',
    })
  })
})

describe('cluster counts', () => {
  it("are written in the theme's font and size, on pin clusters and card clusters alike", () => {
    const theme = testTheme()
    for (const layout of [
      countLayout(pinClusterLayers(theme, zoomedOutPins), 'pin-cluster-counts'),
      countLayout(cardLayoutLayers(theme), 'card-cluster-counts'),
    ]) {
      expect(layout).toMatchObject({ 'text-font': ['Metropolis Semi Bold'], 'text-size': 16 })
    }
  })
})
