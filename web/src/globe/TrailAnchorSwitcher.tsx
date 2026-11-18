// PROTOTYPE, throwaway: the switcher bar for the trail anchor's variants (see trailAnchorPrototype.ts).
import { useEffect } from 'react'
import { anchorNames, anchorProto, anchorProtoVariants, type AnchorVariant } from './trailAnchorPrototype'

function go(variant: AnchorVariant) {
  const url = new URL(window.location.href)
  url.searchParams.set('anchorProto', variant)
  window.location.assign(url)
}

const step = (by: number) => {
  const at = anchorProtoVariants.indexOf(anchorProto)
  go(anchorProtoVariants[(at + by + anchorProtoVariants.length) % anchorProtoVariants.length])
}

/** The switcher bar, at the top middle, clear of the game panel. Local runs only. */
export function TrailAnchorSwitcher() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable]')) return
      if (event.key === ']') step(1)
      if (event.key === '[') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (!import.meta.env.DEV) return null
  return (
    <div className="anchor-proto-bar">
      <button type="button" onClick={() => step(-1)}>
        ‹ [
      </button>
      <span>
        {anchorProtoVariants.indexOf(anchorProto) + 1}/{anchorProtoVariants.length} {anchorProto}: {anchorNames[anchorProto]}
      </span>
      <button type="button" onClick={() => step(1)}>
        ] ›
      </button>
    </div>
  )
}
