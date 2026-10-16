import { describe, expect, it } from 'vitest'
import { tourArrow } from './tourArrow'

// A panel in the middle of a 1600 x 900 screen.
const panel = { left: 580, top: 300, right: 1020, bottom: 600 }

describe('the tour arrow', () => {
  it('runs from the right of the panel to the left of a rail at the top right, level with each middle', () => {
    const rail = { left: 1550, top: 12, right: 1586, bottom: 340 }
    const { from, to } = tourArrow(panel, rail)
    expect(from.x).toBeGreaterThan(panel.right)
    expect(from.y).toBe(450)
    expect(to.x).toBeLessThan(rail.left)
    expect(to.x).toBeGreaterThan(from.x)
    expect(to.y).toBe(176)
  })

  it('runs from the left of the panel to the right of a card to its left', () => {
    const card = { left: 200, top: 420, right: 300, bottom: 470 }
    const { from, to } = tourArrow(panel, card)
    expect(from.x).toBeLessThan(panel.left)
    expect(from.y).toBe(450)
    expect(to.x).toBeGreaterThan(card.right)
    expect(to.x).toBeLessThan(from.x)
    expect(to.y).toBe(445)
  })

  it('runs up from the top of a bottom sheet to a card above it', () => {
    const sheet = { left: 12, top: 500, right: 363, bottom: 800 }
    const card = { left: 140, top: 200, right: 240, bottom: 250 }
    const { from, to } = tourArrow(sheet, card)
    expect(from.x).toBe(187.5)
    expect(from.y).toBeLessThan(sheet.top)
    expect(to.x).toBe(190)
    expect(to.y).toBeGreaterThan(card.bottom)
    expect(to.y).toBeLessThan(from.y)
  })

  it('runs up from the top of a bottom sheet on a phone to the left of the rail above it', () => {
    const sheet = { left: 12, top: 300, right: 363, bottom: 655 }
    const rail = { left: 327, top: 12, right: 363, bottom: 280 }
    const { from, to } = tourArrow(sheet, rail)
    expect(from.x).toBe(187.5)
    expect(from.y).toBeLessThan(sheet.top)
    expect(to.x).toBeLessThan(rail.left)
    expect(to.y).toBe(146)
  })

  it("ends at the side of a card above the panel, not under it where the card's trail runs", () => {
    const teams = { left: 700, top: 120, right: 800, bottom: 170 }
    const { from, to } = tourArrow(panel, teams, 'side')
    expect(from.y).toBeLessThan(panel.top)
    expect(to.x).toBeGreaterThan(teams.right)
    expect(to.y).toBe(145)
  })

  it("ends at the side of a card above a bottom sheet, the side facing the sheet's middle", () => {
    const sheet = { left: 12, top: 500, right: 363, bottom: 800 }
    const teams = { left: 220, top: 200, right: 320, bottom: 250 }
    const { from, to } = tourArrow(sheet, teams, 'side')
    expect(from.y).toBeLessThan(sheet.top)
    expect(to.x).toBeLessThan(teams.left)
    expect(to.y).toBe(225)
  })

  it('draws a path from its start to its end', () => {
    const rail = { left: 1550, top: 12, right: 1586, bottom: 340 }
    const { from, to, path } = tourArrow(panel, rail)
    expect(path.startsWith(`M${from.x} ${from.y} `)).toBe(true)
    expect(path.endsWith(` ${to.x} ${to.y}`)).toBe(true)
  })
})
