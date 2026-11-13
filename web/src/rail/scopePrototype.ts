// PROTOTYPE, throwaway: looks for Leagues' "Top Events | My leagues" control, picked by `?scopeProto=`
// and stepped with [ and ] (ScopePrototypeSwitcher). The question: how should it read as a choice of
// what the globe shows, rather than as navigation tabs? Kept in the URL alone, so a reload shows the
// default ("current") once the param is gone.
import { useEffect, useState } from 'react'

export const scopeVariants = [
  { key: 'current', name: "Today's tabs" },
  { key: 'segmented', name: 'Segmented control' },
  { key: 'radio', name: 'Radio cards' },
  { key: 'show-chips', name: '"Show:" with checked chips' },
  { key: 'switch', name: 'Top Events switch' },
  { key: 'dropdown', name: '"Show" dropdown' },
] as const
export type ScopeVariant = (typeof scopeVariants)[number]['key']

const param = 'scopeProto'
let variant: ScopeVariant = readVariant()
const listeners = new Set<() => void>()

function readVariant(): ScopeVariant {
  if (typeof window === 'undefined') return 'current'
  const value = new URLSearchParams(window.location.search).get(param)
  return scopeVariants.some(({ key }) => key === value) ? (value as ScopeVariant) : 'current'
}

export const scopeVariant = (): ScopeVariant => variant

export function setScopeVariant(next: ScopeVariant): void {
  variant = next
  const url = new URL(window.location.href)
  url.searchParams.set(param, next)
  window.history.replaceState(window.history.state, '', url)
  for (const listener of listeners) listener()
}

export function useScopeVariant(): ScopeVariant {
  const [current, setCurrent] = useState(variant)
  useEffect(() => {
    const listener = () => setCurrent(variant)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return current
}

/** Why the leagues can't be picked while Top Events is on, and how to pick them, in each look's words. */
export function offHintText(variant: ScopeVariant): string {
  switch (variant) {
    case 'switch':
      return 'Top Events is on, so your leagues are off. Turn off "Show Top Events only" above to pick your own.'
    case 'show-chips':
      return 'Top Events is on, so your leagues are off. Pick "My leagues" above to choose your own.'
    default:
      return 'Top Events is on, so your leagues are off. Choose "My leagues" above to pick your own.'
  }
}
