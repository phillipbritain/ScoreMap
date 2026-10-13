import { createExpression, type ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec'
import { describe, expect, it } from 'vitest'
import type { GameStatus } from '../games/game'
import builtIn from '../theme/builtInTheme.json'
import { resolveTheme, type Theme } from '../theme/theme'
import {
  byStatus,
  pinClusterStatus,
  pinClusterStatusCounts,
  groupStatus,
  selectedStacking,
  smallPinWidth,
  stacking,
  statusLook,
  statusProminence,
} from './statusLook'

/** A theme whose status looks are each unlike the built-in theme's, and unlike each other's. */
function testTheme(): Theme {
  const json = structuredClone(builtIn) as Record<string, any>
  const looks = {
    live: ['#ff0000', 4, 20],
    upcoming: ['#00ff00', 3, 12],
    final: ['#0000ff', 2, 6],
    disrupted: ['#808080', 1, 5],
  } as const
  for (const [status, [color, coreRadius, glowRadius]] of Object.entries(looks)) {
    json.palette[status].main = color
    json.components.Pin[status] = {
      core: { color: '#ffffff', radius: coreRadius, opacity: 0.9, ring: 1 },
      glow: { radius: glowRadius, opacity: 0.5 },
    }
    json.components.Cluster[status].opacity = coreRadius / 4
    Object.assign(json.components.ScoreCard[status], { fade: 0, glow: { radius: glowRadius / 2, opacity: 0.5 } })
  }
  const result = resolveTheme(json)
  if (!result.ok) throw new Error(result.problems.join('\n'))
  return result.theme
}

const theme = testTheme()

/** What a style expression gives for a feature with these properties, as MapLibre works it out. */
function evaluate(expression: ExpressionSpecification, properties: Record<string, unknown>): unknown {
  const parsed = createExpression(expression, 'test')
  if (parsed.result !== 'success') throw new Error(parsed.value.map((e) => e.message).join('; '))
  return parsed.value.evaluate({ zoom: 0 }, { type: 'Point', properties } as never)
}

/** The properties the pin source gives a pin cluster of games with these statuses (see pinClusterStatusCounts). */
function pinClusterOf(statuses: readonly GameStatus[]): Record<string, number> {
  return Object.fromEntries(
    Object.entries(pinClusterStatusCounts).map(([name, [, perPin]]) => [
      name,
      statuses.reduce((sum, status) => sum + (evaluate(perPin as ExpressionSpecification, { status }) as number), 0),
    ]),
  )
}

const everyMix: GameStatus[][] = Array.from({ length: 2 ** statusProminence.length - 1 }, (_, bits) =>
  statusProminence.filter((_, i) => (bits + 1) & (1 << i)),
)

describe('the status a group of games shows as', () => {
  it('is the most prominent among them', () => {
    expect(groupStatus(['Final', 'Live', 'Upcoming'])).toBe('Live')
    expect(groupStatus(['Disrupted', 'Upcoming'])).toBe('Upcoming')
    expect(groupStatus(['Disrupted', 'Final'])).toBe('Final')
  })

  it('is Disrupted only when all its games are', () => {
    expect(groupStatus(['Disrupted', 'Disrupted'])).toBe('Disrupted')
  })

  it('is the same for a pin cluster as for a card cluster, whatever the mix', () => {
    for (const mix of everyMix) {
      const games = [...mix, ...mix.slice(0, 1)]
      expect(evaluate(pinClusterStatus, pinClusterOf(games)), mix.join(', ')).toBe(groupStatus(games))
    }
  })
})

describe('byStatus', () => {
  it("picks a pin's, a trail's or a card cluster's value by its own status, from the theme", () => {
    const radii = { Live: 4, Upcoming: 3, Final: 2, Disrupted: 1 }
    for (const status of statusProminence) {
      expect(evaluate(byStatus(theme, 'own', (look) => look.core.radius), { status })).toBe(radii[status])
    }
  })

  it("picks a pin cluster's value by the status it shows as, from the theme", () => {
    expect(evaluate(byStatus(theme, 'pinCluster', (look) => look.color), pinClusterOf(['Final', 'Upcoming']))).toBe('#00ff00')
  })

  it('picks which status draws on top, which isn’t part of the theme', () => {
    for (const status of statusProminence) {
      expect(evaluate(byStatus(theme, 'own', (look) => look.stacking), { status })).toBe(stacking[status])
    }
  })
})

describe('the status look', () => {
  it("is each status's look, gathered from the palette, Pin, Cluster and ScoreCard", () => {
    expect(statusLook(theme, 'Live')).toMatchObject({ color: '#ff0000', glow: { radius: 20 }, clusterOpacity: 1 })
    expect(statusLook(theme, 'Upcoming')).toMatchObject({ color: '#00ff00', core: { radius: 3 } })
    expect(statusLook(theme, 'Final')).toMatchObject({ color: '#0000ff', clusterOpacity: 0.5 })
    expect(statusLook(theme, 'Disrupted')).toMatchObject({ color: '#808080', glow: { radius: 5 }, card: { fade: 0, glow: { radius: 2.5 } } })
  })

  it('draws Live on top, then Upcoming, then Final and Disrupted alike', () => {
    expect(stacking.Live).toBeGreaterThan(stacking.Upcoming)
    expect(stacking.Upcoming).toBeGreaterThan(stacking.Final)
    expect(stacking.Final).toBe(stacking.Disrupted)
  })

  it('draws the selected card above every other', () => {
    for (const status of statusProminence) expect(selectedStacking).toBeGreaterThan(stacking[status])
  })

  it("measures a small pin by the widest glow in the theme, of which the inner part shows", () => {
    expect(smallPinWidth(theme)).toBe(Math.round(2 * 0.6 * 20))
    const json = structuredClone(builtIn) as Record<string, any>
    json.components.Pin.final.glow.radius = 30
    const wideFinal = resolveTheme(json)
    expect(wideFinal.ok && smallPinWidth(wideFinal.theme)).toBe(36)
  })
})
