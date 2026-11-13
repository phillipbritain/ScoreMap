// PROTOTYPE, throw away: the floating bar switching ways to collapse the rail (see railCollapsePrototype.ts).
// Local runs only.
import { useEffect, useState } from 'react'
import { railProtoVariant, railProtoVariants, setRailProtoVariant } from './railCollapsePrototype'

export function RailCollapsePrototypeBar() {
  const [variant, setVariant] = useState(railProtoVariant)
  const step = (by: number) => {
    const at = railProtoVariants.indexOf(railProtoVariant())
    setRailProtoVariant(railProtoVariants[(at + by + railProtoVariants.length) % railProtoVariants.length].key)
    setVariant(railProtoVariant())
  }
  // [ and ] cycle: the arrow keys pan the globe.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable]')) return
      if (event.key === '[') step(-1)
      else if (event.key === ']') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return (
    <div className="rail-collapse-prototype" data-keeps-popovers>
      <button type="button" title="Previous ([)" onClick={() => step(-1)}>
        ←
      </button>
      <span>
        {variant.key}: {variant.name}
      </span>
      <button type="button" title="Next (])" onClick={() => step(1)}>
        →
      </button>
    </div>
  )
}
