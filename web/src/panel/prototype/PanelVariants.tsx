// PROTOTYPE (throwaway): picks the game panel variant from `?variant=` (current, compact, A–E) and shows the floating
// switcher bar at the bottom of the page on local runs. See ./README.md. Kept out of main.
import { useEffect } from 'react'
import { GamePanel } from '../GamePanel'
import type { VariantProps } from './facts'
import { variants } from './variantList'
import { VariantA } from './VariantA'
import { VariantB } from './VariantB'
import { VariantCompact } from './VariantCompact'
import { VariantC } from './VariantC'
import { VariantD } from './VariantD'
import { VariantE } from './VariantE'
import './prototype.css'

// In the order of variants in ./variantList.ts.
const panels = [
  ({ panelRef, ...props }: VariantProps) => <GamePanel ref={panelRef} {...props} />,
  VariantCompact,
  VariantA,
  VariantB,
  VariantC,
  VariantD,
  VariantE,
]

/** The selected game's panel, in whichever variant the URL asks for. */
export function PanelVariant({ index, ...props }: VariantProps & { index: number }) {
  const Panel = panels[index]
  // Keyed by game, so a variant's state (such as Show all) starts afresh for each game.
  return <Panel key={props.game.id} {...props} />
}

/** The floating bar to flip between variants: arrows, or the ← and → keys (Shift+← and → on the globe). Local runs only. */
export function PanelVariantSwitcher({ index, onChange }: { index: number; onChange: (index: number) => void }) {
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const keyed = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable]')) return
      // The globe pans with the arrow keys, so there it takes Shift as well.
      if (!event.shiftKey && target?.closest('.maplibregl-map, [data-game-id]')) return
      if (event.key === 'ArrowLeft') onChange(index - 1)
      if (event.key === 'ArrowRight') onChange(index + 1)
    }
    window.addEventListener('keydown', keyed)
    return () => window.removeEventListener('keydown', keyed)
  }, [index, onChange])
  if (!import.meta.env.DEV) return null
  const { key, name } = variants[index]
  return (
    <div className="pp-switcher" role="toolbar" aria-label="Prototype: game panel variant">
      <button type="button" onClick={() => onChange(index - 1)} aria-label="Previous variant">
        ‹
      </button>
      <span>
        <span className="pp-switcher__tag">PROTOTYPE</span> {key === 'current' ? name : `${key} · ${name}`}
      </span>
      <button type="button" onClick={() => onChange(index + 1)} aria-label="Next variant">
        ›
      </button>
    </div>
  )
}
