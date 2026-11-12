// PROTOTYPE, throw away: the floating bar switching smaller score card variants (see
// smallerCardsPrototype.ts). Local runs only.
import { useEffect, useState } from 'react'
import { cardProtoVariant, cardProtoVariants, setCardProtoVariant } from './smallerCardsPrototype'

export function SmallerCardsPrototypeBar() {
  const [variant, setVariant] = useState(cardProtoVariant)
  const step = (by: number) => {
    const at = cardProtoVariants.indexOf(cardProtoVariant())
    setCardProtoVariant(cardProtoVariants[(at + by + cardProtoVariants.length) % cardProtoVariants.length].key)
    setVariant(cardProtoVariant())
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
    <div className="smaller-cards-prototype" data-keeps-popovers>
      <button type="button" title="Previous variant ([)" onClick={() => step(-1)}>
        ←
      </button>
      <span>
        {variant.key}: {variant.name}
      </span>
      <button type="button" title="Next variant (])" onClick={() => step(1)}>
        →
      </button>
    </div>
  )
}
