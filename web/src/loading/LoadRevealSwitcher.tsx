// PROTOTYPE, throwaway: the switcher bar for the load reveal's variants (see loadRevealPrototype.ts).
import { useEffect, useState } from 'react'
import { loadProto, loadProtoVariants, names, root, type Variant } from './loadRevealPrototype'

function go(variant: Variant) {
  const url = new URL(window.location.href)
  url.searchParams.set('loadProto', variant)
  window.location.assign(url)
}

/** The switcher bar, at the top middle, clear of the game panel. Local runs only. */
export function LoadRevealSwitcher() {
  const [, rerender] = useState(0)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable]')) return
      if (event.key !== '[' && event.key !== ']') return
      const at = loadProtoVariants.indexOf(loadProto)
      const step = event.key === ']' ? 1 : -1
      go(loadProtoVariants[(at + step + loadProtoVariants.length) % loadProtoVariants.length])
    }
    window.addEventListener('keydown', onKey)
    const timer = window.setInterval(() => rerender((n) => n + 1), 250)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearInterval(timer)
    }
  }, [])
  if (!import.meta.env.DEV) return null
  const at = loadProtoVariants.indexOf(loadProto)
  const readyAt = root.dataset.loadReadyAt
  return (
    <div className="load-proto-bar">
      <button type="button" onClick={() => go(loadProtoVariants[(at + loadProtoVariants.length - 1) % loadProtoVariants.length])}>
        ‹ [
      </button>
      <span>
        {loadProto}: {names[loadProto]} · {readyAt ? `Ready at ${(Number(readyAt) / 1000).toFixed(1)} s` : 'loading'}
      </span>
      <button type="button" onClick={() => go(loadProtoVariants[(at + 1) % loadProtoVariants.length])}>
        ] ›
      </button>
      <button type="button" onClick={() => window.location.reload()}>
        Replay
      </button>
      <button
        type="button"
        onClick={() => {
          window.localStorage.removeItem('scoremap.welcomeTour')
          window.location.reload()
        }}
      >
        Replay as first visit
      </button>
    </div>
  )
}
