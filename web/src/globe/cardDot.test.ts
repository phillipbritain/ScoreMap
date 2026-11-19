import { describe, expect, it } from 'vitest'
import { cardDotAt } from './cardDot'
import { layOutCards, type ScreenCard } from './cardLayout'

// A card 80 by 40, its trail's start given from its venue, the card sitting `offset` from its venue (its bottom middle).
const size = { width: 80, height: 40 }

describe('cardDotAt', () => {
  it("sits at the bottom middle of a card above its venue, where its trail runs straight down", () => {
    const offset = { dx: 0, dy: -16 }
    expect(cardDotAt({ dx: 0, dy: -16 }, offset, size)).toEqual({ x: 40, y: 40 })
  })

  it("follows the trail round the card as it's moved aside: its left, right and top", () => {
    // Moved 100 px right of its venue: its trail leaves its left side's middle.
    const right = { dx: 100, dy: -16 }
    expect(cardDotAt({ dx: 60, dy: -36 }, right, size)).toEqual({ x: 0, y: 20 })
    // Moved left: its right side's middle.
    const left = { dx: -100, dy: -16 }
    expect(cardDotAt({ dx: -60, dy: -36 }, left, size)).toEqual({ x: 80, y: 20 })
    // Moved below its venue: its top's middle.
    const below = { dx: 0, dy: 80 }
    expect(cardDotAt({ dx: 0, dy: 40 }, below, size)).toEqual({ x: 40, y: 0 })
  })

  it('sits wherever along an edge a trail facing its venue leaves, a corner too', () => {
    const offset = { dx: 70, dy: -30 }
    // Leaving the bottom edge a little left of its middle.
    expect(cardDotAt({ dx: 52, dy: -30 }, offset, size)).toEqual({ x: 22, y: 40 })
    // Leaving its bottom left corner.
    expect(cardDotAt({ dx: 30, dy: -30 }, offset, size)).toEqual({ x: 0, y: 40 })
  })

  it("lands on its card's edge for every card a crowded layout moves aside", () => {
    // Twelve cards over nearly one venue, so most are moved aside round it, their trails leaving every side.
    const cards: ScreenCard[] = Array.from({ length: 12 }, (_, i) => ({
      gameId: `g${String(i).padStart(2, '0')}`,
      status: 'Live',
      venueX: 500 + i * 3,
      venueY: 400 + (i % 3) * 3,
      width: 106,
      height: 60,
    }))
    const { cards: placements } = layOutCards(cards, { width: 1000, height: 800, venueGap: 16 })
    const sides = new Set<string>()
    for (const card of cards) {
      const { offset, trail, inCardCluster } = placements.get(card.gameId)!
      if (inCardCluster || !trail) continue
      const at = cardDotAt({ dx: trail.x1 - card.venueX, dy: trail.y1 - card.venueY }, offset, card)
      const near = (a: number, b: number) => Math.abs(a - b) < 1e-6
      const side = near(at.x, 0) ? 'left' : near(at.x, card.width) ? 'right' : near(at.y, 0) ? 'top' : near(at.y, card.height) ? 'bottom' : 'inside'
      expect(side, card.gameId).not.toBe('inside')
      expect(at.x).toBeGreaterThanOrEqual(-1e-6)
      expect(at.x).toBeLessThanOrEqual(card.width + 1e-6)
      expect(at.y).toBeGreaterThanOrEqual(-1e-6)
      expect(at.y).toBeLessThanOrEqual(card.height + 1e-6)
      sides.add(side)
    }
    expect(sides.size).toBeGreaterThan(1)
  })
})
