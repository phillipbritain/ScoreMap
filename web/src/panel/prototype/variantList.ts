// PROTOTYPE (throwaway): the game panel variants' keys and names, and the `?variant=` URL param. See ./README.md.
import { useEffect, useState } from 'react'

export const variants = [
  { key: 'current', name: 'Today’s panel' },
  { key: 'backdrop', name: 'Photo backdrop (round 3)' },
  { key: 'A', name: 'Today + backdrop' },
  { key: 'B', name: 'Last score beside venue' },
  { key: 'C', name: 'Last score in score block' },
  { key: 'D', name: 'A, no Venue label' },
  { key: 'E', name: 'D, photo under the score too' },
  { key: 'F', name: 'D, Watch under the venue' },
  { key: 'G', name: 'F, photo behind the whole panel' },
  { key: 'H', name: 'G, venue and watch in the corners' },
  { key: 'I', name: 'C, labeled last score, watch in the photo corner' },
] as const

const readVariant = () => {
  const key = new URLSearchParams(window.location.search).get('variant')
  const index = variants.findIndex((variant) => variant.key.toLowerCase() === key?.toLowerCase())
  return index < 0 ? 0 : index
}

/** The variant in the URL, kept in step with the switcher and the back button. */
export function useVariant(): [number, (index: number) => void] {
  const [index, setIndex] = useState(import.meta.env.DEV ? readVariant : 0)
  useEffect(() => {
    const popped = () => setIndex(readVariant())
    window.addEventListener('popstate', popped)
    return () => window.removeEventListener('popstate', popped)
  }, [])
  const set = (next: number) => {
    const wrapped = (next + variants.length) % variants.length
    const url = new URL(window.location.href)
    url.searchParams.set('variant', variants[wrapped].key)
    window.history.replaceState(window.history.state, '', url)
    setIndex(wrapped)
  }
  return [index, set]
}

