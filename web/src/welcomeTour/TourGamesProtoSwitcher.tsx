// PROTOTYPE, throw away: the switcher bar for ?tourGamesProto= (see tourGamesProto.ts). At the top
// middle, clear of the phone's bottom sheets, over the tour's dim. [ and ] cycle (MapLibre has the arrows).
import { useEffect } from 'react'
import { tourGamesSets, tourGamesVariants, type TourGamesVariant } from './tourGamesProto'

function go(variant: TourGamesVariant, step: number) {
  const index = (tourGamesVariants.indexOf(variant) + step + tourGamesVariants.length) % tourGamesVariants.length
  const url = new URL(window.location.href)
  url.searchParams.set('tourGamesProto', tourGamesVariants[index])
  // A reload, so the globe opens on the new set's camera and the tour starts over.
  window.location.assign(url)
}

export function TourGamesProtoSwitcher({ variant, onRestart }: { variant: TourGamesVariant; onRestart: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable]')) return
      if (event.key === '[') go(variant, -1)
      if (event.key === ']') go(variant, 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [variant])
  const set = tourGamesSets[variant]
  const button = { background: 'none', border: 'none', color: '#fff', font: 'inherit', cursor: 'pointer', padding: '0 6px' }
  return (
    <div
      style={{
        position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 10000,
        display: 'flex', alignItems: 'center', gap: 4, maxWidth: 'calc(100vw - 16px)',
        background: '#c2185b', color: '#fff', borderRadius: 999, padding: '4px 8px',
        font: '600 12px system-ui, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,.4)', whiteSpace: 'nowrap',
      }}
    >
      <button type="button" style={button} onClick={() => go(variant, -1)} aria-label="Previous variant">[</button>
      <span title={set.summary} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        PROTO {variant}: {set.name}
        <span className="tour-games-proto__summary" style={{ fontWeight: 400 }}> · {set.summary}</span>
      </span>
      <button type="button" style={button} onClick={() => go(variant, 1)} aria-label="Next variant">]</button>
      <button type="button" style={{ ...button, textDecoration: 'underline' }} onClick={onRestart}>Tour again</button>
    </div>
  )
}
