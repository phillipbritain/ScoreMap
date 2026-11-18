// PROTOTYPE, throwaway: variants of a mark on each score card where its trail meets it, switched by
// `?anchorProto=` (see TrailAnchorSwitcher). Not for main.
import type { PlacedCard } from './placedCard'
import type { TrailOnGlobe } from './trailLayer'

export const anchorProtoVariants = ['off', 'dot', 'ring', 'tab', 'bar'] as const
export type AnchorVariant = (typeof anchorProtoVariants)[number]

export const anchorNames: Record<AnchorVariant, string> = {
  off: 'Today (no mark)',
  dot: 'Dot in the trail’s color',
  ring: 'Ring, echoing the venue dot',
  tab: 'Tab pointing out along the trail',
  bar: 'Lit edge segment',
}

const asked = new URLSearchParams(window.location.search).get('anchorProto')
export const anchorProto: AnchorVariant = (anchorProtoVariants as readonly string[]).includes(asked ?? '') ? (asked as AnchorVariant) : 'dot'
document.documentElement.dataset.anchorProto = anchorProto

/** The anchor mark, appended to a card each time it's drawn. */
export function anchorElement(): HTMLElement {
  const anchor = document.createElement('span')
  anchor.className = 'score-card__anchor'
  return anchor
}

/**
 * Puts each card's anchor where its trail leaves it, on the side it leaves from; a card with no trail
 * (in a card cluster) has none.
 */
export function placeAnchors(placed: ReadonlyMap<string, PlacedCard>, trails: readonly TrailOnGlobe[]): void {
  const starts = new Map(trails.map((trail) => [trail.gameId, trail.start]))
  for (const [gameId, card] of placed) {
    const start = starts.get(gameId)
    const element = card.element
    if (!element) continue
    if (!start || !card.offset) {
      delete element.dataset.anchorSide
      continue
    }
    // From the card's top left: its bottom middle sits at its offset from the venue.
    const x = start.dx - card.offset.dx + card.width / 2
    const y = start.dy - card.offset.dy + card.height
    const toEdge = { left: x, right: card.width - x, top: y, bottom: card.height - y }
    const side = (Object.keys(toEdge) as (keyof typeof toEdge)[]).reduce((a, b) => (Math.abs(toEdge[b]) < Math.abs(toEdge[a]) ? b : a))
    element.style.setProperty('--anchor-x', `${x}px`)
    element.style.setProperty('--anchor-y', `${y}px`)
    element.dataset.anchorSide = side
  }
}
