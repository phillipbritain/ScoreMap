// PROTOTYPE, throw away: the floating bar switching confetti variants (see globe/confettiPrototype.ts). Local runs only.
import { useEffect, useState } from 'react'
import { confettiVariant, cycledVariants, onConfettiPrototypeChange, setConfettiVariant } from '../globe/confettiPrototype'
import './confettiPrototype.css'

/** The floating bar: the variant, [ and ] to cycle, and buttons that make a game finish now. */
export function ConfettiPrototypeBar({ selectedGameId }: { selectedGameId: string | null }) {
  const [, redraw] = useState(0)
  const [note, setNote] = useState('')
  useEffect(() => onConfettiPrototypeChange(() => redraw((n) => n + 1)), [])
  const variant = confettiVariant()
  const step = (by: number) => {
    const at = cycledVariants.indexOf(variant)
    setConfettiVariant(cycledVariants[(Math.max(0, at) + by + cycledVariants.length) % cycledVariants.length].key)
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
  const finish = (which: 'panel' | 'card') => {
    const happen = window.scoremapGames?.happen
    if (!happen) return
    const onScreenCard = (gameId: string) => {
      const box = document.querySelector(`.maplibregl-marker [data-game-id="${CSS.escape(gameId)}"]`)?.getBoundingClientRect()
      return !!box && box.width > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth
    }
    const change = happen('finish', (game) => (which === 'panel' ? game.id === selectedGameId : game.id !== selectedGameId && onScreenCard(game.id)))
    setNote(change ? '' : which === 'panel' ? 'open a Live game first' : 'no Live card on screen')
    // A card alone then drops out once its celebration is over, as a Final game does (a minute later in a
    // scenario), so its going away can be seen too.
    if (change && which === 'card') {
      const gameId = change.game.id
      setTimeout(() => window.scoremapGames?.remove?.(gameId), confettiVariant().duration + 800)
    }
  }
  return (
    <div className="confetti-prototype" data-keeps-popovers>
      <button type="button" title="Previous variant ([)" onClick={() => step(-1)}>←</button>
      <span className="confetti-prototype__label">
        {variant.key}: {variant.name}
      </span>
      <button type="button" title="Next variant (])" onClick={() => step(1)}>→</button>
      <button type="button" title="Finish the open panel's game, in this tab" onClick={() => finish('panel')}>Finish panel</button>
      <button type="button" title="Finish a Live game with a score card on screen, then take it off the board as a Final game drops out, in this tab" onClick={() => finish('card')}>Finish card</button>
      {note && <span className="confetti-prototype__note">{note}</span>}
    </div>
  )
}
