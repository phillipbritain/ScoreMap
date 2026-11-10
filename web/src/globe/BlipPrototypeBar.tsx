// PROTOTYPE (throwaway, not for main): the floating bar that switches the score-change variants
// (see blipPrototype.ts). `[` and `]` cycle too (the arrow keys pan the globe), and `.` fires a score
// change on every card on screen. Mounted on local runs only.
import { useEffect, useState } from 'react'
import './blipPrototype.css'
import { blipVariant, blipVariants, fireAllCards, setBlipVariant, type BlipVariant } from './blipPrototype'

export function BlipPrototypeBar() {
  const [variant, setVariant] = useState<BlipVariant>(blipVariant)
  const [fired, setFired] = useState<number | null>(null)

  useEffect(() => setBlipVariant(variant), [variant])

  const index = blipVariants.findIndex(({ key }) => key === variant)
  const step = (by: number) => setVariant(blipVariants[(index + by + blipVariants.length) % blipVariants.length].key)
  const fire = () => setFired(fireAllCards())

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable]')) return
      if (event.key === '[') step(-1)
      else if (event.key === ']') step(1)
      else if (event.key === '.') fire()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="blip-proto-bar" role="toolbar" aria-label="Score change prototype">
      <button type="button" onClick={() => step(-1)} aria-label="Previous variant">
        ←
      </button>
      <span className="blip-proto-bar__label">
        {index + 1}/{blipVariants.length} {variant} ({blipVariants[index].name})
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next variant">
        →
      </button>
      <button type="button" className="blip-proto-bar__fire" onClick={fire}>
        Fire all{fired !== null ? ` (${fired})` : ''}
      </button>
    </div>
  )
}
