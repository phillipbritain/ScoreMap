// PROTOTYPE (throwaway): game panel layout variants, see ./README.md. Not production code: no tests, no polish.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { spotlightElapsed } from '../../games/scorers'

/** Lights a row up for a moment when its side scores, as the real panel does (reuses its CSS animation). */
export function useScoredRow<T extends HTMLElement>(scoredAt: number | null) {
  const row = useRef<T>(null)
  useLayoutEffect(() => {
    const element = row.current
    if (!element) return
    element.classList.remove('game-panel__team--scored')
    const elapsed = spotlightElapsed(scoredAt === null ? undefined : { side: 'home', at: scoredAt }, performance.now())
    if (elapsed === null) return
    void element.offsetWidth
    element.style.setProperty('--scorer-spotlight-delay', `${-elapsed}ms`)
    element.classList.add('game-panel__team--scored')
  }, [scoredAt])
  return row
}

/** Whether the page has its phone layout (as index.css's 640px breakpoint). */
export function usePhone(): boolean {
  const query = '(max-width: 640px)'
  const [phone, setPhone] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const list = window.matchMedia(query)
    const changed = () => setPhone(list.matches)
    list.addEventListener('change', changed)
    return () => list.removeEventListener('change', changed)
  }, [])
  return phone
}

