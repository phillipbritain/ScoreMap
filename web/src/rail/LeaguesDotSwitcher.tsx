// PROTOTYPE, throwaway, not for main: where the Leagues button's "games filtered" dot sits and how it looks,
// switched with `[` / `]` (look) and `{` / `}` (position), or ?leaguesDotProto=<look><position>, such as A1.
// Today's is A1. Switches in place (no reload). Filter games in Leagues to see the dot.
import { useEffect, useState } from 'react'

const looks = {
  A: { name: 'Gold 8px, glass edge (today)', css: 'width: 8px; height: 8px; background: var(--rail-open); box-shadow: 0 0 0 var(--shape-border-width-thin) var(--score-card-fill);' },
  B: { name: 'Gold 6px, plain', css: 'width: 6px; height: 6px; background: var(--rail-open); box-shadow: none;' },
  C: { name: 'Gold 9px, glowing', css: 'width: 9px; height: 9px; background: var(--rail-open); box-shadow: 0 0 6px 1px color-mix(in srgb, var(--rail-open) 70%, transparent);' },
  D: { name: 'Gold ring, glass inside (as the Games count)', css: 'width: 9px; height: 9px; background: var(--score-card-fill); box-shadow: inset 0 0 0 2px var(--rail-open);' },
  E: { name: 'Live red 8px, glass edge', css: 'width: 8px; height: 8px; background: var(--palette-live-main); box-shadow: 0 0 0 var(--shape-border-width-thin) var(--score-card-fill);' },
  F: { name: 'Gold 8px, slow pulse', css: 'width: 8px; height: 8px; background: var(--rail-open); animation: leagues-dot-proto-pulse 2s ease-in-out infinite;' },
} as const
const positions = {
  1: { name: 'inset 5px (today)', top: 5, right: 5 },
  2: { name: 'inset 3px', top: 3, right: 3 },
  3: { name: 'inset 1px, on the corner', top: 1, right: 1 },
  4: { name: 'over the edge, as the Games count', top: -3, right: -3 },
} as const
type Look = keyof typeof looks
type Position = keyof typeof positions
const lookKeys = Object.keys(looks) as Look[]
const positionKeys = Object.keys(positions).map(Number) as Position[]

function fromUrl(): { look: Look; position: Position } {
  const value = new URLSearchParams(window.location.search).get('leaguesDotProto')?.toUpperCase() ?? ''
  const look = lookKeys.includes(value[0] as Look) ? (value[0] as Look) : 'A'
  const position = positionKeys.includes(Number(value[1]) as Position) ? (Number(value[1]) as Position) : 1
  return { look, position }
}

const css = (look: Look, position: Position) => `
.rail__dot { ${looks[look].css} top: ${positions[position].top}px; right: ${positions[position].right}px; }
@keyframes leagues-dot-proto-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--rail-open) 60%, transparent); }
  50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--rail-open) 0%, transparent); }
}
.leagues-dot-proto-bar {
  position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 1000;
  display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 4px 8px; padding: 4px 8px;
  border-radius: 16px; max-width: calc(100vw - 120px);
  background: #ff00aa; color: #fff; font: 600 13px/1.2 system-ui, sans-serif;
  box-shadow: 0 2px 10px #0008;
}
.leagues-dot-proto-bar button {
  border: 0; border-radius: 999px; padding: 4px 10px; background: #fff3; color: inherit; font: inherit; cursor: pointer;
}`

/** The switcher bar, at the top middle. Local runs only. */
export function LeaguesDotSwitcher() {
  const [{ look, position }, setChoice] = useState(fromUrl)
  const stepLook = (by: number) =>
    setChoice((at) => ({ ...at, look: lookKeys[(lookKeys.indexOf(at.look) + by + lookKeys.length) % lookKeys.length] }))
  const stepPosition = (by: number) =>
    setChoice((at) => ({
      ...at,
      position: positionKeys[(positionKeys.indexOf(at.position) + by + positionKeys.length) % positionKeys.length],
    }))

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('leaguesDotProto', `${look}${position}`)
    window.history.replaceState(window.history.state, '', url)
  }, [look, position])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable]')) return
      if (event.key === ']') stepLook(1)
      if (event.key === '[') stepLook(-1)
      if (event.key === '}') stepPosition(1)
      if (event.key === '{') stepPosition(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!import.meta.env.DEV) return null
  return (
    <>
      <style>{css(look, position)}</style>
      <div className="leagues-dot-proto-bar">
        <button type="button" onClick={() => stepLook(-1)}>‹ [</button>
        <span>Look {look}: {looks[look].name}</span>
        <button type="button" onClick={() => stepLook(1)}>] ›</button>
        <button type="button" onClick={() => stepPosition(-1)}>‹ {'{'}</button>
        <span>Position {position}: {positions[position].name}</span>
        <button type="button" onClick={() => stepPosition(1)}>{'}'} ›</button>
      </div>
    </>
  )
}
