import { createExpression, type ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec'
import { describe, expect, it } from 'vitest'
import type { GameStatus } from '../games/game'
import {
  applyStatusLook,
  byStatus,
  pinClusterStatus,
  pinClusterStatusCounts,
  cardClusterStacking,
  groupFill,
  groupOutline,
  groupStatus,
  selectedStacking,
  selectionColor,
  smallPinWidth,
  statusLooks,
  statusProminence,
} from './statusLook'

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
  it("picks a pin's value by its own status", () => {
    for (const status of statusProminence) {
      expect(evaluate(byStatus('pin', (look) => look.coreRadius), { status })).toBe(statusLooks[status].coreRadius)
    }
  })

  it("picks a pin cluster's value by the status it shows as", () => {
    expect(evaluate(byStatus('pinCluster', (look) => look.color), pinClusterOf(['Final', 'Upcoming']))).toBe(
      statusLooks.Upcoming.color,
    )
  })
})

describe('the status look', () => {
  it('draws the selected card above every other, and card clusters above all', () => {
    for (const look of Object.values(statusLooks)) expect(selectedStacking).toBeGreaterThan(look.stacking)
    expect(cardClusterStacking).toBeGreaterThan(selectedStacking)
  })

  it("measures a small pin by a Live one's glow, the widest, of which the inner part shows", () => {
    expect(smallPinWidth).toBe(Math.round(2 * 0.6 * statusLooks.Live.glowRadius))
    for (const look of Object.values(statusLooks)) {
      expect(look.glowRadius).toBeLessThanOrEqual(statusLooks.Live.glowRadius)
      expect(smallPinWidth).toBeGreaterThan(2 * (look.coreRadius + look.coreRing))
    }
  })

  it("writes each status's look, the groups' fill and outline, and the selection colour, for the page's CSS", () => {
    const properties = new Map<string, string>()
    applyStatusLook({ style: { setProperty: (name: string, value: string | null) => properties.set(name, value!) } })

    expect(properties.get('--live-color')).toBe(statusLooks.Live.color)
    expect(properties.get('--disrupted-group-opacity')).toBe(String(statusLooks.Disrupted.groupOpacity))
    expect(properties.get('--group-fill')).toBe(groupFill)
    expect(properties.get('--group-outline')).toBe(`${groupOutline}px`)
    expect(properties.get('--selection-color')).toBe(selectionColor)
    expect(properties.size).toBe(2 * statusProminence.length + 3)
  })
})
