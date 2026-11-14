// PROTOTYPE, throw away: the spacing between the rail's groups of buttons. Switched by ?railGapProto=
// and the floating bar (RailGapPrototypeBar), on a local run only. Not for main. Each variant is CSS
// alone (railGapPrototype.css), keyed by data-rail-gap-proto on the page's root.
import './railGapPrototype.css'

export interface GapVariant {
  key: string
  name: string
}

export const gapVariants: readonly GapVariant[] = [
  { key: 'A', name: 'Today: 8px gaps' },
  { key: 'B', name: '4px gaps' },
  { key: 'C', name: '2px gaps' },
  { key: 'D', name: 'Joined, a divider between groups' },
  { key: 'E', name: '4px on desktop, joined on a phone' },
]

const param = 'railGapProto'
const fromUrl = (): GapVariant => {
  const key = new URL(window.location.href).searchParams.get(param)
  return gapVariants.find((variant) => variant.key === key) ?? gapVariants[0]
}

let current = fromUrl()
const listeners = new Set<() => void>()
const apply = () => {
  document.documentElement.dataset.railGapProto = current.key
}
if (import.meta.env.DEV) apply()

export const gapVariant = (): GapVariant => current

export function onGapPrototypeChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Steps the variant by one, wrapping, in the URL too (kept there alone, so a reload shows it). */
export function stepGapVariant(by: number): void {
  const at = gapVariants.indexOf(current)
  current = gapVariants[(at + by + gapVariants.length) % gapVariants.length]
  const url = new URL(window.location.href)
  url.searchParams.set(param, current.key)
  window.history.replaceState(window.history.state, '', url)
  apply()
  listeners.forEach((listener) => listener())
}
