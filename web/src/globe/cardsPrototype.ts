// PROTOTYPE, throw away: score cards at every zoom, and games pinned from the Games list so their cards
// always show. Switched by ?cardsProto= and the floating bar (CardsPrototypeBar), on a local run only.
// Pins live in memory: a reload forgets them. Not for main.
import './cardsPrototype.css'

export interface CardsVariant {
  key: string
  name: string
  /** Cards at every zoom, not only from the card zoom (see pinSize). */
  everyZoom: boolean
  /** How far from the view's center a venue can be and still have a card, in degrees (see hasCard). */
  radius: number
  /** Zoomed out past the real card zoom, cards shrink to a compact one-line look. */
  compactZoomedOut: boolean
}

export const cardsVariants: readonly CardsVariant[] = [
  { key: 'A', name: 'Today: cards from country zoom', everyZoom: false, radius: 40, compactZoomedOut: false },
  { key: 'B', name: 'Every zoom, near the center', everyZoom: true, radius: 40, compactZoomedOut: false },
  { key: 'C', name: 'Every zoom, whole facing side', everyZoom: true, radius: 90, compactZoomedOut: false },
  { key: 'D', name: 'Every zoom, compact when out', everyZoom: true, radius: 90, compactZoomedOut: true },
]

let current = cardsVariants[0]
const pinned = new Set<string>()
const listeners = new Set<() => void>()

export const cardsVariant = (): CardsVariant => (import.meta.env.DEV ? current : cardsVariants[0])
export const isPinned = (gameId: string): boolean => pinned.has(gameId)
export const pinnedGames = (): ReadonlySet<string> => pinned

/** Called on any change of variant or pins. Gives back a function that stops it. */
export function onCardsPrototypeChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const changed = () => {
  for (const listener of listeners) listener()
}

export function togglePinned(gameId: string): void {
  if (!pinned.delete(gameId)) pinned.add(gameId)
  changed()
}

/** Switches to a variant, in the URL too. */
export function setCardsVariant(key: string): void {
  current = cardsVariants.find((variant) => variant.key === key) ?? cardsVariants[0]
  const url = new URL(window.location.href)
  url.searchParams.set('cardsProto', current.key)
  window.history.replaceState(window.history.state, '', url)
  changed()
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const key = new URL(window.location.href).searchParams.get('cardsProto')
  if (key) current = cardsVariants.find((variant) => variant.key === key) ?? current
}
