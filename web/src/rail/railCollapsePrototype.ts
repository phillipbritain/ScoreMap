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

if (import.meta.env.DEV) setRailProtoVariant(new URL(window.location.href).searchParams.get('railProto') ?? 'A')
