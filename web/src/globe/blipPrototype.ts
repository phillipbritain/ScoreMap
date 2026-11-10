// PROTOTYPE (throwaway, not for main): calmer alternatives to a score card's score-change pulse ("blip"),
// switched by `?blipProto=<key>` and the floating bar (BlipPrototypeBar). Every variant but `current`
// is CSS in blipPrototype.css, keyed off attributes on <html>; `venue` instead leaves the card alone
// and rings its venue dot. Only a score change (animation 'score') is affected: start and finish
// play as they do today.
import { Marker, type Map as MapLibreMap } from 'maplibre-gl'
import { fadedOut } from './horizon'

export const blipVariants = [
  { key: 'current', name: "Today's bounce" },
  { key: 'small', name: 'Small nudge' },
  { key: 'glow', name: 'Glow only' },
  { key: 'roll', name: 'Number rolls' },
  { key: 'underline', name: 'Underline fades' },
  { key: 'dot', name: 'Corner dot' },
  { key: 'venue', name: 'Venue dot ring' },
] as const

export type BlipVariant = (typeof blipVariants)[number]['key']

export const blipParam = 'blipProto'

export function blipFromUrl(): BlipVariant {
  const key = new URLSearchParams(window.location.search).get(blipParam)
  return blipVariants.find((variant) => variant.key === key)?.key ?? 'current'
}

let variant: BlipVariant = import.meta.env.DEV ? blipFromUrl() : 'current'

/** The variant playing now. */
export function blipVariant(): BlipVariant {
  return variant
}

/** Plays this variant from now on: writes it to <html> for the CSS and to the URL. */
export function setBlipVariant(next: BlipVariant): void {
  variant = next
  const root = document.documentElement
  root.dataset.blipProto = next
  root.toggleAttribute('data-blip-calm', next !== 'current')
  const url = new URL(window.location.href)
  url.searchParams.set(blipParam, next)
  window.history.replaceState(window.history.state, '', url)
}

/** Fires a score change on every card on screen: set by ScoreCardMarkers, called by the bar. */
let fireAll: (() => number) | undefined

export function registerFireAll(fire: () => number): void {
  fireAll = fire
}

export function fireAllCards(): number {
  return fireAll?.() ?? 0
}

/** The `venue` variant: one soft ring out from the venue dot, the card itself left alone. */
export function venueRing(map: MapLibreMap, color: string, lngLat: [number, number]): void {
  if (fadedOut(map, lngLat)) return
  const element = document.createElement('div')
  element.style.pointerEvents = 'none'
  const ring = document.createElement('div')
  ring.className = 'blip-proto-venue-ring'
  ring.style.setProperty('--pulse-color', color)
  element.append(ring)
  const marker = new Marker({ element }).setLngLat(lngLat).addTo(map)
  const remove = () => marker.remove()
  ring.addEventListener('animationend', remove, { once: true })
  setTimeout(remove, 5000)
}
