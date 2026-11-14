// PROTOTYPE, throw away: how the loading screen's and cut-off note's message looks. Switched by
// ?loadingProto= and the floating bar (LoadingTextPrototype.tsx), on a local run only. Not for main.
// Each variant is keyed by data-loading-proto on the page's root (loadingTextPrototype.css), and the
// message's markup by the variant (LoadingTextPrototype.tsx).
import { pickPhrase, type PhraseScenario } from './loadingPhrases'
import './loadingTextPrototype.css'

export interface TextVariant {
  key: string
  name: string
}

export const textVariants: readonly TextVariant[] = [
  { key: 'A', name: 'Today: plain body text' },
  { key: 'B', name: 'Mission readout: typed out, monospace HUD' },
  { key: 'C', name: 'Title card: large light type, shimmer, sparkles' },
  { key: 'D', name: 'Broadcast plaque: Mission Control label, live dot' },
  { key: 'E', name: 'Drifting words: word by word, glowing dots' },
]

/** What the bar's Show button pins over the globe, to look at without waiting for a slow load. */
export const previews: readonly (PhraseScenario | 'off')[] = ['loading', 'cutOff', 'slowDrawing', 'waking', 'off']

const fromUrl = (): TextVariant => {
  const key = new URL(window.location.href).searchParams.get('loadingProto')
  return textVariants.find((variant) => variant.key === key) ?? textVariants[0]
}

const previewFromUrl = (): PhraseScenario | 'off' => {
  const value = new URL(window.location.href).searchParams.get('loadingPreview')
  return previews.find((preview) => preview === value) ?? 'off'
}

let current = fromUrl()
let preview = previewFromUrl()
let previewPhrase = preview === 'off' ? '' : pickPhrase(preview, undefined)
const listeners = new Set<() => void>()

const apply = () => {
  document.documentElement.dataset.loadingProto = current.key
}
if (import.meta.env.DEV) apply()

export const textVariant = (): TextVariant => current
export const previewShown = (): { scenario: PhraseScenario | 'off'; phrase: string } => ({ scenario: preview, phrase: previewPhrase })

export function onTextPrototypeChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const setParam = (name: string, value: string) => {
  const url = new URL(window.location.href)
  url.searchParams.set(name, value)
  window.history.replaceState(window.history.state, '', url)
}

/** Steps the variant by one, wrapping, in the URL too (kept there alone, so a reload shows it). */
export function stepTextVariant(by: number): void {
  const at = textVariants.indexOf(current)
  current = textVariants[(at + by + textVariants.length) % textVariants.length]
  setParam('loadingProto', current.key)
  apply()
  listeners.forEach((listener) => listener())
}

/** Pins the next message over the globe, with a fresh phrase, or none. */
export function stepPreview(): void {
  preview = previews[(previews.indexOf(preview) + 1) % previews.length]
  previewPhrase = preview === 'off' ? '' : pickPhrase(preview, previewPhrase)
  setParam('loadingPreview', preview)
  listeners.forEach((listener) => listener())
}

/** Another phrase for the pinned message, to see a short and a long one. */
export function nextPreviewPhrase(): void {
  if (preview === 'off') return
  previewPhrase = pickPhrase(preview, previewPhrase)
  listeners.forEach((listener) => listener())
}
