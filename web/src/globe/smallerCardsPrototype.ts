// PROTOTYPE, throw away: smaller score card variants, switched by ?cardProto= and the floating bar
// (SmallerCardsPrototypeBar), on a local run only. Not for main.
import './smallerCardsPrototype.css'

export interface CardProtoVariant {
  key: string
  name: string
}

export const cardProtoVariants: readonly CardProtoVariant[] = [
  { key: 'A', name: 'Today' },
  { key: 'B', name: 'Scaled down' },
  { key: 'C', name: 'Clock at the foot' },
  { key: 'D', name: 'One line' },
  { key: 'E', name: 'Logos and scores' },
]

/** Fired after a switch, so the globe measures its cards afresh and lays them out again. */
export const cardProtoChanged = 'card-proto-changed'

let current = cardProtoVariants[0]

export const cardProtoVariant = (): CardProtoVariant => current

/** Switches to a variant: its look on the page's root, and in the URL. */
export function setCardProtoVariant(key: string): void {
  current = cardProtoVariants.find((variant) => variant.key === key) ?? cardProtoVariants[0]
  document.documentElement.dataset.cardProto = current.key
  const url = new URL(window.location.href)
  url.searchParams.set('cardProto', current.key)
  window.history.replaceState(window.history.state, '', url)
  window.dispatchEvent(new Event(cardProtoChanged))
}

if (import.meta.env.DEV) setCardProtoVariant(new URL(window.location.href).searchParams.get('cardProto') ?? 'A')
