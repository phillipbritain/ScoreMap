import { describe, expect, it } from 'vitest'
import { cityNameBox } from './cityNameBox'
import { cityNameLook } from './placeNames'
import { builtInTheme } from '../theme/builtInTheme'

describe('cityNameBox', () => {
  // Every letter 10 px wide.
  const measure = (text: string) => text.length * 10
  // Wide enough for the longest word below, "Santísima", to fit on a line.
  const look = { ...cityNameLook(4, false, builtInTheme), maxWidth: 100 }

  it('sits centred below the dot, past the offset, with room for the outline', () => {
    const box = cityNameBox('Tampa', { x: 100, y: 200 }, look, measure)
    expect(box.x).toBe(100)
    expect(box.width).toBeGreaterThan(50)
    expect(box.y - box.height / 2).toBeLessThanOrEqual(200 + look.offset)
    expect(box.y - box.height / 2).toBeGreaterThan(200)
    expect(box.y + box.height / 2).toBeGreaterThanOrEqual(200 + look.offset + look.size)
  })

  it("keeps the theme's clearance for score cards around the name's letters", () => {
    const { components } = builtInTheme
    const scoreCard = { ...components.ScoreCard, size: { ...components.ScoreCard.size, nameClearance: 7 } }
    const theme = { ...builtInTheme, components: { ...components, ScoreCard: scoreCard } }
    const clear = { ...cityNameLook(4, false, theme), maxWidth: 100 }
    const box = cityNameBox('Tampa', { x: 100, y: 200 }, clear, measure)
    expect(box.width).toBe(measure('Tampa') + 2 * 7)
    expect(box.y - box.height / 2).toBe(200 + clear.offset - 7)
  })

  it('wraps a long name onto more lines, as the map does', () => {
    const box = cityNameBox('Ciudad de la Santísima Trinidad', { x: 0, y: 0 }, look, measure)
    expect(box.width).toBeLessThanOrEqual(look.maxWidth + 8)
    expect(box.height).toBeGreaterThan(2 * look.size)
  })
})
