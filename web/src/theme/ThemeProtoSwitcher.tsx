// PROTOTYPE, throwaway: the bar switching between the color schemes in themeProto, kept in the URL
// alone (`?themeProto=`) so a changed default always shows. `[` and `]` cycle, as MapLibre takes the arrows.
import { useEffect } from 'react'
import type { Theme } from './theme'
import { param, protoThemes } from './themeProto'


export function ThemeProtoSwitcher({ setTheme }: { setTheme: (theme: Theme) => void }) {
  const key = new URLSearchParams(location.search).get(param) ?? 'F'
  const index = Math.max(0, protoThemes.findIndex((t) => t.key === key))
  const current = protoThemes[index]

  const go = (by: number) => {
    const next = protoThemes[(index + by + protoThemes.length) % protoThemes.length]
    const url = new URL(location.href)
    url.searchParams.set(param, next.key)
    history.replaceState(null, '', url)
    setTheme(next.theme)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable]')) return
      if (event.key === '[') go(-1)
      else if (event.key === ']') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="theme-proto-bar">
      <button type="button" onClick={() => go(-1)} aria-label="Previous scheme">[</button>
      <span>
        <b>{current.key}</b> {current.name}
      </span>
      <button type="button" onClick={() => go(1)} aria-label="Next scheme">]</button>
    </div>
  )
}
