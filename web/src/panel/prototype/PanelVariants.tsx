// PROTOTYPE (throwaway): picks the game panel variant from `?variant=` (current, backdrop, A–F) and shows the floating
// switcher bar at the bottom of the page on local runs. See ./README.md. Kept out of main.
import { useEffect } from 'react'
import { GamePanel } from '../GamePanel'
import type { VariantProps } from './facts'
import { variants } from './variantList'
import type { Game } from '../../games/game'
import { VariantA, VariantB, VariantC, VariantD, VariantE, VariantF } from './TodayBackdrop'
import { VariantE as VariantBackdrop } from './VariantE'
import './prototype.css'

// In the order of variants in ./variantList.ts.
const panels = [
  ({ panelRef, ...props }: VariantProps) => <GamePanel ref={panelRef} {...props} />,
  VariantBackdrop,
  VariantA,
  VariantB,
  VariantC,
  VariantD,
  VariantE,
  VariantF,
]

/** The selected game's panel, in whichever variant the URL asks for. */
export function PanelVariant({ index, ...props }: VariantProps & { index: number }) {
  const Panel = panels[index]
  // Keyed by game, so a variant's state (such as Show all) starts afresh for each game.
  return <Panel key={props.game.id} {...props} game={withDummyWatchLinks(props.game)} />
}

/**
 * Round 5: made-up watch links for a game that lists none (every scenario game, as scenarios have no
 * broadcasters), so each panel, today's too, shows what real links look like. Round 6: two at most, as the
 * user asked. DUMMY DATA: these channels aren't real listings for the game.
 */
function withDummyWatchLinks(game: Game): Game {
  if (game.broadcasters.length > 0 || game.streamLinks.length > 0) return game
  return {
    ...game,
    broadcasters: [
      { name: 'ESPN', country: null, watchUrl: 'https://www.espn.com/watch/' },
      { name: 'Peacock', country: null, watchUrl: 'https://www.peacocktv.com/' },
    ],
  }
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
