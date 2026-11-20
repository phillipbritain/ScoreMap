// PROTOTYPE, throwaway: the switcher bar for the rocket variants (see rocketPrototype.tsx), and, with
// `?rocketProto=` in the URL, the loading screen held over the app to look at. Not for main.
import { useEffect } from 'react'
import { Dimmed } from './LoadingScreen'
import { usePhrase } from './loadingPhrases'
import { rocketNames, rocketProto, rocketProtoAsked, rocketProtoVariants, type RocketVariant } from './rocketPrototype'

function go(variant: RocketVariant) {
  const url = new URL(window.location.href)
  url.searchParams.set('rocketProto', variant)
  window.location.assign(url)
}

const step = (by: number) => {
  const at = rocketProtoVariants.indexOf(rocketProto)
  go(rocketProtoVariants[(at + by + rocketProtoVariants.length) % rocketProtoVariants.length])
}

/** The switcher bar, at the top middle, clear of the bottom sheets. Local runs only. */
export function RocketProtoSwitcher() {
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
    <div className="rocket-proto-bar">
      <button type="button" onClick={() => step(-1)}>
        ‹ [
      </button>
      <span>
        {rocketProtoVariants.indexOf(rocketProto) + 1}/{rocketProtoVariants.length} {rocketProto}
        <span className="rocket-proto-bar__name">: {rocketNames[rocketProto]}</span>
      </span>
      <button type="button" onClick={() => step(1)}>
        ] ›
      </button>
    </div>
  )
}

/** With `?rocketProto=`: the loading screen as it looks on a first load, held over the globe. */
export function RocketProtoHold() {
  const message = usePhrase(rocketProtoAsked ? 'loading' : null)
  if (!import.meta.env.DEV || !rocketProtoAsked) return null
  return (
    <div className="rocket-proto-hold">
      <Dimmed message={message} label="Loading ScoreMap" />
    </div>
  )
}
