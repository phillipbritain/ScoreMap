// PROTOTYPE, throw away: how the game panel's close button and top edge look. Switched by ?closeProto=
// and ?edgeProto= and the floating bar (PanelLookPrototypeBar), on a local run only. Not for main.
// Each variant is CSS alone (panelLookPrototype.css), keyed by data-close-proto and data-edge-proto on
// the page's root, so nothing in the panel re-renders to switch.
import './panelLookPrototype.css'

export interface LookVariant {
  key: string
  name: string
}

export const closeVariants: readonly LookVariant[] = [
  { key: 'A', name: 'Before: game-color tab at the top right' },
  { key: 'B', name: 'Labeled tab: CLOSE ×' },
  { key: 'C', name: 'Frosted circle floating above the corner' },
  { key: 'D', name: 'Tab in the panel\'s own surface' },
  { key: 'E', name: 'Pull tab at the top center, ⌄' },
]

export const edgeVariants: readonly LookVariant[] = [
  { key: 'A', name: 'Today: thick game-color top edge' },
  { key: 'B', name: 'No top edge (glow only)' },
  { key: 'C', name: 'Thin game-color hairline' },
  { key: 'D', name: 'Short game-color accent at the left' },
  { key: 'E', name: 'Neutral divider, no color' },
]

export type LookAxis = 'close' | 'edge'
const params: Record<LookAxis, string> = { close: 'closeProto', edge: 'edgeProto' }
const lists: Record<LookAxis, readonly LookVariant[]> = { close: closeVariants, edge: edgeVariants }

const fromUrl = (axis: LookAxis): LookVariant => {
  const key = new URL(window.location.href).searchParams.get(params[axis])
  return lists[axis].find((variant) => variant.key === key) ?? lists[axis][0]
}

const current: Record<LookAxis, LookVariant> = { close: fromUrl('close'), edge: fromUrl('edge') }
const listeners = new Set<() => void>()

const apply = () => {
  document.documentElement.dataset.closeProto = current.close.key
  document.documentElement.dataset.edgeProto = current.edge.key
}
if (import.meta.env.DEV) apply()

export const lookVariant = (axis: LookAxis): LookVariant => current[axis]

export function onLookPrototypeChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Steps an axis's variant by one, wrapping, in the URL too (kept there alone, so a reload shows it). */
export function stepLookVariant(axis: LookAxis, by: number): void {
  const list = lists[axis]
  const at = list.indexOf(current[axis])
  current[axis] = list[(at + by + list.length) % list.length]
  const url = new URL(window.location.href)
  url.searchParams.set(params[axis], current[axis].key)
  window.history.replaceState(window.history.state, '', url)
  apply()
  listeners.forEach((listener) => listener())
}
