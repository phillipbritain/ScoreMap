// PROTOTYPE (throwaway): what would a "Liquid Glass" look be like on ScoreMap?
// Three glass materials on the real app, switchable by ?variant= (A, B, C, or off for today's solid
// look) from the pink bar at the top, or [ and ]. Each surface's frost, from clear glass (0) to opaque
// frosted glass (1), is a slider on the Glass tab of the Theme tuner. Local runs only; nothing is kept.
import { useEffect, useState } from 'react'
import './glassPrototype.css'

const variants = [
  { key: 'A', name: 'Liquid' },
  { key: 'B', name: 'Frosted acrylic' },
  { key: 'C', name: 'Smoked glass' },
  { key: 'off', name: 'Today, solid' },
] as const

const surfaces = [
  { key: 'cards', name: 'Score cards' },
  { key: 'panel', name: 'Game panel' },
  { key: 'rail', name: 'Rail and popovers' },
  { key: 'controls', name: 'Scenario controls' },
] as const

type Frost = Record<(typeof surfaces)[number]['key'], number>

const startFrost: Frost = { cards: 0.3, panel: 0.45, rail: 0.35, controls: 0.35 }

function variantFromUrl() {
  const asked = new URLSearchParams(window.location.search).get('variant')
  return variants.findIndex((variant) => variant.key === asked) === -1 ? 'A' : asked!
}

/** The prototype's state, written to the page's root, and its two controls: the switcher bar and the sliders. */
export function useGlassPrototype() {
  const [variant, setVariant] = useState(variantFromUrl)
  const [frost, setFrost] = useState(startFrost)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const root = document.documentElement
    root.dataset.glass = variant
    for (const { key } of surfaces) root.style.setProperty(`--glass-${key}`, String(frost[key]))
    console.info('[glass prototype]', { variant, ...frost })
  }, [variant, frost])

  const cycle = (by: number) => {
    const index = variants.findIndex((v) => v.key === variant)
    const next = variants[(index + by + variants.length) % variants.length].key
    const url = new URL(window.location.href)
    url.searchParams.set('variant', next)
    window.history.replaceState(null, '', url)
    setVariant(next)
  }

  useEffect(() => {
    // [ and ], not the arrow keys, which pan the globe.
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
      if (event.key === '[') cycle(-1)
      if (event.key === ']') cycle(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const current = variants.find((v) => v.key === variant)!
  const bar = (
    <div className="glass-switcher" data-keeps-popovers>
      <button type="button" aria-label="Previous variant" onClick={() => cycle(-1)}>
        ←
      </button>
      <span className="glass-switcher__label">
        {current.key} ({current.name})
      </span>
      <button type="button" aria-label="Next variant" onClick={() => cycle(1)}>
        →
      </button>
      {/* The lens for A: the globe bent a little through the glass (Chromium only). */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <filter id="glass-prototype-lens" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="28" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
    </div>
  )

  const sliders = (
    <div className="theme-tuner__body">
      <div className="theme-tuner__group theme-tuner__group--top">
        <div className="theme-tuner__heading">
          Glass: {current.key} ({current.name})
        </div>
        <div className="glass-sliders__ends">
          <span>← clear glass</span>
          <span>opaque frosted →</span>
        </div>
        {surfaces.map(({ key, name }) => (
          <div key={key} className={frost[key] === startFrost[key] ? 'theme-tuner__row' : 'theme-tuner__row theme-tuner__row--changed'}>
            <span className="theme-tuner__name">{name}</span>
            <span className="theme-tuner__number">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={frost[key]}
                onChange={(event) => setFrost({ ...frost, [key]: Number(event.target.value) })}
              />
              <input type="number" min={0} max={1} step={0.05} value={frost[key]} onChange={(event) => setFrost({ ...frost, [key]: Number(event.target.value) })} />
            </span>
            <button
              type="button"
              className="theme-tuner__reset"
              style={{ visibility: frost[key] === startFrost[key] ? 'hidden' : 'visible' }}
              onClick={() => setFrost({ ...frost, [key]: startFrost[key] })}
            >
              ↺
            </button>
          </div>
        ))}
        <pre className="glass-sliders__state">{JSON.stringify({ variant, ...frost }, null, 1)}</pre>
      </div>
    </div>
  )

  return { bar, sliders }
}
