import { createExpression, type ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec'
import type { LayerSpecification, SymbolLayerSpecification } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'
import { themeWith } from '../theme/testTheme'
import type { Theme } from '../theme/theme'
import type { GameStatus } from '../games/game'
import type { CardLayout } from './cardLayout'
import { cardClusterFootprintLayerSpec, cardLayoutDrawing, cardLayoutLayers } from './cardLayoutLayers'
import { smallPinReach } from './panelClearance'
import { clusterFootprint, selectedPinLayerSpec, smallPinLayers, type PinSet } from './pinLayers'

// A pin set with no prefix, so its layers' ids are the base ids.
const pins: PinSet = { source: 'pins', prefix: '', only: ['==', ['get', 'kind'], 'smallPin'] }

/** The built-in theme, with cluster counts in another font and size. */
function testTheme(): Theme {
  return themeWith((json) => {
    json.components.Cluster.count = { font: 'Noto Sans Regular', size: 'body1' }
    json.typography.body1.fontSize = 16
  })
}

const countLayout = (layers: readonly LayerSpecification[], id: string) =>
  (layers.find((l) => l.id === id) as SymbolLayerSpecification).layout

/** What a style expression gives for a feature with these properties, as MapLibre works it out. */
function evaluate(value: unknown, properties: Record<string, unknown>): unknown {
  const parsed = createExpression(value as ExpressionSpecification, 'test')
  if (parsed.result !== 'success') throw new Error(parsed.value.map((e) => e.message).join('; '))
  return parsed.value.evaluate({ zoom: 0 } as never, { type: 'Point', properties } as never)
}

const paintOf = (layers: readonly LayerSpecification[], id: string) =>
  layers.find((l) => l.id === id)?.paint as Record<string, unknown>

/** The built-in theme, with clusters in sizes of their own. */
function sizedTheme(): Theme {
  return themeWith((json) => {
    json.components.Cluster.radius = 14
    json.components.Cluster.glowRadius = 27
    delete json.components.Cluster.matchPinGlow
    json.components.Cluster.outlineWidth = 2
  })
}

describe('clusters', () => {
  it('glow as small pins of their status do, as strongly as the theme says, or not at all', () => {
    const theme = themeWith((json) => {
      json.components.Pin.live.glow.opacity = 0.8
      json.components.Pin.final.glow.opacity = 0
      json.components.Cluster.glowOpacity = 0.5
    })
    const cardClusterGlow = paintOf(cardLayoutLayers(theme), 'card-cluster-glows')['circle-opacity']
    expect(evaluate(cardClusterGlow, { status: 'Live' })).toBeCloseTo(0.4, 6)
    expect(evaluate(cardClusterGlow, { status: 'Final' })).toBe(0)
  })

  it('fade as the status they show as says, disc, outline and count alike', () => {
    const theme = themeWith((json) => {
      delete json.components.Cluster.fillWithGameColor
      json.components.Cluster.live.opacity = 1
      json.components.Cluster.final.opacity = 0.4
    })
    /** How opaque a cluster's disc, outline and count are, for a cluster with these properties. */
    const faded = (layers: readonly LayerSpecification[], [disc, count]: [string, string], properties: Record<string, unknown>) =>
      [paintOf(layers, disc)['circle-opacity'], paintOf(layers, disc)['circle-stroke-opacity'], paintOf(layers, count)['text-opacity']].map(
        (opacity) => evaluate(opacity, properties),
      )
    const cardClusters = cardLayoutLayers(theme)
    const cardCluster: [string, string] = ['card-clusters', 'card-cluster-counts']
    expect(faded(cardClusters, cardCluster, { status: 'Live' })).toEqual([1, 1, 1])
    expect(faded(cardClusters, cardCluster, { status: 'Final' })).toEqual([0.4, 0.4, 0.4])
  })

  it("draw a card cluster at the theme's size, its outline inside its size", () => {
    const paint = (id: string) => paintOf(cardLayoutLayers(sizedTheme()), id)
    expect(paint('card-clusters')['circle-radius']).toBe(14 - 2)
    expect(paint('card-clusters')['circle-stroke-width']).toBe(2)
    expect(paint('card-cluster-glows')['circle-radius']).toBe(27)
  })
})

describe("clusters' footprints", () => {
  // In sizedTheme, a card cluster reaches 14 pixels, outline and all.
  const across = (layer: SymbolLayerSpecification, properties: Record<string, unknown>) =>
    (evaluate(layer.layout!['icon-size'], properties) as number) * clusterFootprint.size

  it('cover a card cluster, disc and outline, with a pixel to spare each side, whatever its count', () => {
    const layer = cardClusterFootprintLayerSpec(sizedTheme())
    for (const count of [2, 30]) expect(across(layer, { kind: 'cardCluster', count })).toBe(30)
  })

  it('are placed whatever else is there, to keep names off every cluster, and draw nothing', () => {
    const layer = cardClusterFootprintLayerSpec(sizedTheme())
    expect(layer.layout!['icon-allow-overlap']).toBe(true)
    expect(layer.layout!['icon-ignore-placement']).toBeUndefined()
    expect(layer.paint!['icon-opacity']).toBe(0)
  })
})

describe("a game's color", () => {
  const game = { status: 'Live', color: '#123456' }

  it('lights a small pin: its glow and ring in the color', () => {
    const paint = (id: string) => paintOf(smallPinLayers(sizedTheme(), pins), id)
    expect(evaluate(paint('pin-glows')['circle-color'], game)).toBe('#123456')
    expect(evaluate(paint('pins')['circle-stroke-color'], game)).toBe('#123456')
  })

  it("lights a small pin's core in the color, but where the theme gives its status a bright core of its own", () => {
    // A Live pin's core paler than Live's color; an Upcoming pin's core just Upcoming's color.
    const theme = themeWith((json) => {
      json.components.Pin.live.core.color = '#ffcccc'
      json.components.Pin.upcoming.core.color = 'upcoming.main'
    })
    const core = paintOf(smallPinLayers(theme, pins), 'pins')['circle-color']
    expect(evaluate(core, game)).toBe('#ffcccc')
    expect(evaluate(core, { ...game, status: 'Upcoming' })).toBe('#123456')
  })
})

describe("a cluster's color", () => {
  /** The built-in theme, its accent (Live's color) unlike any game's below. */
  function colorTheme(): Theme {
    return themeWith((json) => {
      json.palette.live.main = '#ff0000'
      delete json.components.Cluster.count.color
    })
  }

  interface ClusteredGame {
    status: GameStatus
    color: string
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
      hotIndicator: false,
    }))
    const gameIds = cards.map(({ gameId }) => gameId)
    const layout: Pick<CardLayout, 'shows' | 'gatherings'> = {
      shows: () => ({ as: 'inCardCluster', cardCluster: gameIds }),
      gatherings: () => [{ kind: 'cardCluster', trails: [], noRoom: gameIds, at: { venueOf: gameIds[0] } }],
    }
    const { features } = cardLayoutDrawing(cards, layout, (x, y) => [x, y], themeWith()).source
    return features.find((feature) => feature.properties?.kind === 'cardCluster')!.properties!
  }

  /** The colors a card cluster of these games shows in: glow, outline and count. */
  function colorsOf(games: readonly ClusteredGame[]): string[] {
    const cardLayers = cardLayoutLayers(colorTheme())
    const cardCluster = cardClusterOf(games)
    return [
      ['card-cluster-glows', 'circle-color'],
      ['card-clusters', 'circle-stroke-color'],
      ['card-cluster-counts', 'text-color'],
    ].map(([id, property]) => evaluate(paintOf(cardLayers, id)[property], cardCluster) as string)
  }

  const everywhere = (color: string) => Array(3).fill(color)

  it('is the color its games share', () => {
    const games: ClusteredGame[] = [
      { status: 'Live', color: '#123456' },
      { status: 'Final', color: '#123456' },
      { status: 'Upcoming', color: '#123456' },
    ]
    expect(colorsOf(games)).toEqual(everywhere('#123456'))
  })

  it("is the theme's accent when its games' colors differ", () => {
    const games: ClusteredGame[] = [
      { status: 'Live', color: '#123456' },
      { status: 'Live', color: '#123456' },
      { status: 'Final', color: '#654321' },
    ]
    expect(colorsOf(games)).toEqual(everywhere('#ff0000'))
  })
})

describe('the selected pin', () => {
  it("is ringed in the theme's selection color and width, out to as far as a small pin reaches", () => {
    const theme = themeWith((json) => {
      json.components.Selection = { color: '#00ff00', width: 4 }
    })
    expect(selectedPinLayerSpec(theme, 'a', pins).paint).toMatchObject({
      'circle-radius': smallPinReach - 4,
      'circle-stroke-width': 4,
      'circle-stroke-color': '#00ff00',
    })
  })
})

describe('card cluster counts', () => {
  it("are written in the theme's font and size", () => {
    expect(countLayout(cardLayoutLayers(testTheme()), 'card-cluster-counts')).toMatchObject({ 'text-font': ['Noto Sans Regular'], 'text-size': 16 })
  })
})
