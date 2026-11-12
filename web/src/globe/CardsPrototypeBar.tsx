// PROTOTYPE, throw away: the floating bar switching how far out score cards show (see cardsPrototype.ts).
import { useEffect, useState } from 'react'
import { cardsVariant, cardsVariants, onCardsPrototypeChange, pinnedGames, setCardsVariant } from './cardsPrototype'

export function CardsPrototypeBar() {
  const [, redraw] = useState(0)
  useEffect(() => onCardsPrototypeChange(() => redraw((n) => n + 1)), [])
  const variant = cardsVariant()
  const step = (by: number) => {
    const at = cardsVariants.indexOf(variant)
    setCardsVariant(cardsVariants[(at + by + cardsVariants.length) % cardsVariants.length].key)
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
  const pins = pinnedGames().size
  return (
    <div className="cards-prototype" data-keeps-popovers>
      <button type="button" title="Previous variant ([)" onClick={() => step(-1)}>←</button>
      <span className="cards-prototype__label">
        {variant.key}: {variant.name}
        {pins > 0 && ` · ${pins} pinned`}
      </span>
      <button type="button" title="Next variant (])" onClick={() => step(1)}>→</button>
    </div>
  )
}
