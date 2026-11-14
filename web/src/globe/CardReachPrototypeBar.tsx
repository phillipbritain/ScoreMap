// PROTOTYPE, throw away: the floating bar switching which games get score cards zoomed out (see cardReachPrototype.ts).
import { useEffect, useState } from 'react'
import { onReachPrototypeChange, reachVariant, reachVariants, setReachVariant } from './cardReachPrototype'

export function CardReachPrototypeBar() {
  const [, redraw] = useState(0)
  useEffect(() => onReachPrototypeChange(() => redraw((n) => n + 1)), [])
  const variant = reachVariant()
  const step = (by: number) => {
    const at = reachVariants.indexOf(variant)
    setReachVariant(reachVariants[(at + by + reachVariants.length) % reachVariants.length].key)
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
    <div className="reach-prototype" data-keeps-popovers>
      <button type="button" title="Previous variant ([)" onClick={() => step(-1)}>←</button>
      <span className="reach-prototype__label">
        {variant.key}: {variant.name}
      </span>
      <button type="button" title="Next variant (])" onClick={() => step(1)}>→</button>
    </div>
  )
}
