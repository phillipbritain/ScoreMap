// PROTOTYPE, throw away: ways to collapse and expand the rail, switched by ?railProto= and the floating
// bar (RailCollapsePrototypeBar), on a local run only. Not for main.
import { useSyncExternalStore } from 'react'
import './railCollapsePrototype.css'

export interface RailProtoVariant {
  key: string
  name: string
}

export const railProtoVariants: readonly RailProtoVariant[] = [
  { key: 'A', name: 'Today: button on top, slides off right' },
  { key: 'B', name: 'Button at the foot, folds up' },
  { key: 'C', name: 'Keeps Games when collapsed' },
  { key: 'D', name: 'Tab at the screen edge' },
  { key: 'E', name: 'Menu button, drops down' },
]

const changed = 'rail-proto-changed'
let current = railProtoVariants[0]

export const railProtoVariant = (): RailProtoVariant => current

/** Switches to a variant: its look on the page's root, and in the URL. */
export function setRailProtoVariant(key: string): void {
  current = railProtoVariants.find((variant) => variant.key === key) ?? railProtoVariants[0]
  document.documentElement.dataset.railProto = current.key
  const url = new URL(window.location.href)
  url.searchParams.set('railProto', current.key)
  window.history.replaceState(window.history.state, '', url)
  window.dispatchEvent(new Event(changed))
}

/** The variant's key, re-rendering on a switch; 'A' (today's) outside a local run. */
export function useRailProto(): string {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(changed, onChange)
      return () => window.removeEventListener(changed, onChange)
    },
    () => (import.meta.env.DEV ? current.key : 'A'),
  )
}

// E, the menu button, is the one picked: the glass looks are tried on it.
if (import.meta.env.DEV) setRailProtoVariant(new URL(window.location.href).searchParams.get('railProto') ?? 'E')

/** Glass on the rail's buttons and the Scenario button, as score cards have (?railGlass=). */
export const railGlassVariants: readonly RailProtoVariant[] = [
  { key: '1', name: 'Solid (today)' },
  { key: '2', name: "Score cards' glass, unblurred" },
  { key: '3', name: "Score cards' glass, blurred" },
  { key: '4', name: 'Clearer glass, blurred' },
  { key: '5', name: 'Clear glass, rim only' },
]

let glass = railGlassVariants[0]

export const railGlassVariant = (): RailProtoVariant => glass

export function setRailGlassVariant(key: string): void {
  glass = railGlassVariants.find((variant) => variant.key === key) ?? railGlassVariants[0]
  document.documentElement.dataset.railGlass = glass.key
  const url = new URL(window.location.href)
  url.searchParams.set('railGlass', glass.key)
  window.history.replaceState(window.history.state, '', url)
}

// 2, score cards' glass unblurred, is the one picked: the count chip's looks are tried on it.
if (import.meta.env.DEV) setRailGlassVariant(new URL(window.location.href).searchParams.get('railGlass') ?? '2')

/** Looks for the count chip on the Games button (?badgeGlass=). */
export const badgeGlassVariants: readonly RailProtoVariant[] = [
  { key: '1', name: 'Solid gold (today)' },
  { key: '2', name: 'Gold glass, dark count' },
  { key: '3', name: 'Rail glass, gold rim and count' },
  { key: '4', name: 'Rail glass, gold rim and glow' },
  { key: '5', name: 'Clear glass, gold count' },
]

let badge = badgeGlassVariants[0]

export const badgeGlassVariant = (): RailProtoVariant => badge

export function setBadgeGlassVariant(key: string): void {
  badge = badgeGlassVariants.find((variant) => variant.key === key) ?? badgeGlassVariants[0]
  document.documentElement.dataset.badgeGlass = badge.key
  const url = new URL(window.location.href)
  url.searchParams.set('badgeGlass', badge.key)
  window.history.replaceState(window.history.state, '', url)
}

if (import.meta.env.DEV) setBadgeGlassVariant(new URL(window.location.href).searchParams.get('badgeGlass') ?? '1')
