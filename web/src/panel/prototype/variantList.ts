// PROTOTYPE (throwaway): the game panel variants' keys and names, and the `?variant=` URL param. See ./README.md.
import { useEffect, useState } from 'react'

export const variants = [
  { key: 'current', name: 'Today’s panel' },
  { key: 'A', name: 'Score bug' },
  { key: 'B', name: 'Side sheet / peek' },
  { key: 'C', name: 'Ticker' },
  { key: 'D', name: 'Tabs' },
  { key: 'E', name: 'Floating card' },
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

