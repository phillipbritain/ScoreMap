// PROTOTYPE, throwaway, not for main: desktop widths for the game panel, switched with `[` / `]` or
// ?panelWidthProto=A..E. Today's width is A. Phones and short screens keep today's layout: the override
// applies only from 961px wide and 501px tall. Switches in place (no reload) so the open panel stays open.
import { useEffect, useState } from 'react'

const variants = {
  A: { width: 1200, name: '1200px (today)' },
  B: { width: 1040, name: '1040px' },
  C: { width: 900, name: '900px' },
  D: { width: 780, name: '780px' },
  E: { width: 680, name: '680px' },
} as const
type Variant = keyof typeof variants
const keys = Object.keys(variants) as Variant[]

function fromUrl(): Variant {
  const value = new URLSearchParams(window.location.search).get('panelWidthProto')?.toUpperCase()
  return keys.includes(value as Variant) ? (value as Variant) : 'A'
}

const css = (variant: Variant) => `
@media (min-width: 961px) and (min-height: 501px) {
  .game-panel { --game-panel-size-width: ${variants[variant].width}px; }
}
.panel-width-proto-bar {
  position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 1000;
  display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 999px;
  background: #ff00aa; color: #fff; font: 600 13px/1.2 system-ui, sans-serif; white-space: nowrap;
  box-shadow: 0 2px 10px #0008;
}
.panel-width-proto-bar button {
  border: 0; border-radius: 999px; padding: 4px 10px; background: #fff3; color: inherit; font: inherit; cursor: pointer;
}`

/** The switcher bar, at the top middle, clear of the game panel. Local runs only. */
export function PanelWidthSwitcher() {
  const [variant, setVariant] = useState(fromUrl)
  const step = (by: number) => setVariant((at) => keys[(keys.indexOf(at) + by + keys.length) % keys.length])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('panelWidthProto', variant)
    window.history.replaceState(window.history.state, '', url)
  }, [variant])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable]')) return
      if (event.key === ']') step(1)
      if (event.key === '[') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!import.meta.env.DEV) return null
  return (
    <>
      <style>{css(variant)}</style>
      <div className="panel-width-proto-bar">
        <button type="button" onClick={() => step(-1)}>‹ [</button>
        <span>Panel width {keys.indexOf(variant) + 1}/{keys.length} {variant}: {variants[variant].name}</span>
        <button type="button" onClick={() => step(1)}>] ›</button>
      </div>
    </>
  )
}
