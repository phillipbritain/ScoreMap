// PROTOTYPE, throw away: variants of how a score card comes in and goes out, switched by ?cardComing=
// and the floating bar (CardComingPrototypeBar), on a local run only. Not for main.
import { setCardComingDuration } from './cardComings'
import { setTrailComing } from './trailLayer'
import './cardComingPrototype.css'

export interface CardComingVariant {
  key: string
  name: string
  /** How long it takes, in and out, in milliseconds. */
  duration: number
  /** How the trail and venue dot come and go: fading with the card, or growing up from the venue to it. */
  trail: 'fade' | 'grow'
}

export const cardComingVariants: readonly CardComingVariant[] = [
  { key: 'A', name: 'Fade and scale (now)', duration: 250, trail: 'fade' },
  { key: 'B', name: 'Grow from the venue', duration: 450, trail: 'grow' },
  { key: 'C', name: 'Pop', duration: 340, trail: 'fade' },
  { key: 'D', name: 'Drop in, lift away', duration: 300, trail: 'fade' },
  { key: 'E', name: 'Light up, dim out', duration: 600, trail: 'fade' },
]

let current = cardComingVariants[0]

export const cardComingVariant = (): CardComingVariant => current

/** Switches to a variant: its duration for the cards and trails, its look on the page's root, and in the URL. */
export function setCardComingVariant(key: string): void {
  current = cardComingVariants.find((variant) => variant.key === key) ?? cardComingVariants[0]
  setCardComingDuration(current.duration)
  setTrailComing(current.trail)
  document.documentElement.dataset.cardComing = current.key
  const url = new URL(window.location.href)
  url.searchParams.set('cardComing', current.key)
  window.history.replaceState(window.history.state, '', url)
}

if (import.meta.env.DEV) setCardComingVariant(new URL(window.location.href).searchParams.get('cardComing') ?? 'A')
