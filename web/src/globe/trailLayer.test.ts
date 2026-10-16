import { describe, expect, it } from 'vitest'
import { themeWith } from '../theme/testTheme'
import { trailShapes, type TrailOnScreen, type TrailShape } from './trailLayer'

const theme = themeWith((json) => {
  json.components.Trail = { width: 1.5, opacity: 0.8, glow: { width: 5, blur: 2, opacity: 0.3 }, venue: { radius: 3, ring: { radius: 6, width: 1.5 } } }
  json.components.Hover.trail = { width: 3, opacity: 0.95 }
  json.components.Hover.venue = { radius: 4, glow: { radius: 14, opacity: 0.7 } }
})

// a ends at a dot of its own; b at a venue cluster.
const a: TrailOnScreen = { gameId: 'a', from: { x: 100, y: 150 }, to: { x: 100, y: 200 }, dot: true }
const b: TrailOnScreen = { gameId: 'b', from: { x: 300, y: 150 }, to: { x: 320, y: 200 }, dot: false }
const shapesOf = (hovered: string | null = null) => trailShapes([a, b], ['#aaaaaa', '#bbbbbb'], hovered, theme.components)

describe('trailShapes', () => {
  it("draws each trail from its card to its venue in its game's colour, in a glow, at the theme's widths and opacities", () => {
    const lines = shapesOf().filter((shape) => shape.kind === 'line')
    expect(lines).toEqual([
      { kind: 'line', from: a.from, to: a.to, width: 5, blur: 2, color: '#aaaaaa', opacity: 0.3 },
      { kind: 'line', from: b.from, to: b.to, width: 5, blur: 2, color: '#bbbbbb', opacity: 0.3 },
      { kind: 'line', from: a.from, to: a.to, width: 1.5, blur: 0, color: '#aaaaaa', opacity: 0.8 },
      { kind: 'line', from: b.from, to: b.to, width: 1.5, blur: 0, color: '#bbbbbb', opacity: 0.8 },
    ])
  })

  it("rings a trail's own venue, with a dot on it, at the theme's sizes, but not a venue cluster's", () => {
    const circles = shapesOf().filter((shape) => shape.kind === 'circle')
    expect(circles).toEqual([
      { kind: 'circle', at: a.to, radius: 6, strokeWidth: 1.5, blur: 0, color: 'transparent', opacity: 1, stroke: '#aaaaaa' },
      { kind: 'circle', at: a.to, radius: 3, strokeWidth: 0, blur: 0, color: '#aaaaaa', opacity: 1, stroke: 'transparent' },
    ])
  })

  it("draws a hovered card's trail and venue dot from the hover settings, the dot lit in a glow beneath its ring", () => {
    const shapes = shapesOf('a')
    const lines = shapes.filter((shape): shape is Extract<TrailShape, { kind: 'line' }> => shape.kind === 'line' && shape.blur === 0)
    expect(lines.map(({ width, opacity }) => [width, opacity])).toEqual([
      [3, 0.95],
      [1.5, 0.8],
    ])
    expect(shapes.filter((shape) => shape.kind === 'circle')).toEqual([
      { kind: 'circle', at: a.to, radius: 14, strokeWidth: 0, blur: 1, color: '#aaaaaa', opacity: 0.7, stroke: 'transparent' },
      { kind: 'circle', at: a.to, radius: 6, strokeWidth: 3, blur: 0, color: 'transparent', opacity: 1, stroke: '#aaaaaa' },
      { kind: 'circle', at: a.to, radius: 4, strokeWidth: 0, blur: 0, color: '#aaaaaa', opacity: 1, stroke: 'transparent' },
    ])
  })
})
