// PROTOTYPE, throw away: the floating bar switching the rail's group spacing (see railGapPrototype.ts).
import { useEffect, useState } from 'react'
import { gapVariant, onGapPrototypeChange, stepGapVariant } from './railGapPrototype'

export function RailGapPrototypeBar() {
  const [, redraw] = useState(0)
  useEffect(() => onGapPrototypeChange(() => redraw((n) => n + 1)), [])
  // [ and ] cycle: the arrow keys pan the globe.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable]')) return
      if (event.key === '[') stepGapVariant(-1)
      else if (event.key === ']') stepGapVariant(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const variant = gapVariant()
  return (
    <div className="gap-prototype" data-keeps-popovers>
      <span className="gap-prototype__axis">Rail gaps</span>
      <button type="button" title="Previous ([)" onClick={() => stepGapVariant(-1)}>←</button>
      <span>
        <strong>{variant.key}</strong>
        <span className="gap-prototype__name">: {variant.name}</span>
      </span>
      <button type="button" title="Next (])" onClick={() => stepGapVariant(1)}>→</button>
    </div>
  )
}
