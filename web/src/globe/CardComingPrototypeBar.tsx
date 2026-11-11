// PROTOTYPE, throw away: the floating bar switching how score cards come in and go out (see
// cardComingPrototype.ts), with buttons to take cards out and bring them back. Local runs only.
import { useEffect, useState } from 'react'
import { cardComingVariant, cardComingVariants, setCardComingVariant } from './cardComingPrototype'

/** Hides games from the globe as if they had left the board, and shows them again as if they had arrived. */
export interface CardTryOut {
  /** Takes out one score card on screen, picked at random, or every one. */
  takeOut: (which: 'one' | 'all') => void
  /** Brings back every game taken out. */
  bringBack: () => void
  /** How many games are taken out now. */
  takenOut: number
}

export function CardComingPrototypeBar({ cards }: { cards: CardTryOut }) {
  const [variant, setVariant] = useState(cardComingVariant)
  const step = (by: number) => {
    const at = cardComingVariants.indexOf(cardComingVariant())
    setCardComingVariant(cardComingVariants[(at + by + cardComingVariants.length) % cardComingVariants.length].key)
    setVariant(cardComingVariant())
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
    <div className="card-coming-prototype" data-keeps-popovers>
      <button type="button" title="Previous variant ([)" onClick={() => step(-1)}>
        ←
      </button>
      <span className="card-coming-prototype__label">
        {variant.key}: {variant.name} · {variant.duration} ms
      </span>
      <button type="button" title="Next variant (])" onClick={() => step(1)}>
        →
      </button>
      <span className="card-coming-prototype__sep" />
      <button type="button" onClick={() => cards.takeOut('one')}>
        Take one out
      </button>
      <button type="button" onClick={() => cards.takeOut('all')}>
        Take all out
      </button>
      <button type="button" disabled={cards.takenOut === 0} onClick={cards.bringBack}>
        Bring back{cards.takenOut > 0 && ` (${cards.takenOut})`}
      </button>
    </div>
  )
}
