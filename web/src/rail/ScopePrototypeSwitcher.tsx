// PROTOTYPE, throwaway: steps between the Top Events / My leagues looks (see scopePrototype). Dev builds only.
import { useEffect } from 'react'
import './scopePrototype.css'
import { scopeVariants, setScopeVariant, useScopeVariant } from './scopePrototype'

export function ScopePrototypeSwitcher() {
  const current = useScopeVariant()
  const index = scopeVariants.findIndex(({ key }) => key === current)
  const step = (by: number) =>
    setScopeVariant(scopeVariants[(Math.max(index, 0) + by + scopeVariants.length) % scopeVariants.length].key)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable]')) return
      if (event.key === '[') step(-1)
      if (event.key === ']') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return (
    <div className="scope-proto-bar">
      <button className="scope-proto-bar__step" onClick={() => step(-1)} aria-label="Previous variant">
        ‹ [
      </button>
      <span>
        Scope {index + 1}/{scopeVariants.length}: {scopeVariants[index].name}
      </span>
      <button className="scope-proto-bar__step" onClick={() => step(1)} aria-label="Next variant">
        ] ›
      </button>
    </div>
  )
}
