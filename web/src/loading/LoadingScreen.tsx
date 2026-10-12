import { useEffect, useRef, useState } from 'react'
import type { LoadingStage } from '../globe/globeMap'
import { loadingScreenView } from './loadingScreenView'

interface LoadingScreenProps {
  /** How far the globe's initial load has got (see GlobeMap.stage). */
  stage: LoadingStage
  /** Called once the loading screen has gone, its fade played. */
  onGone: () => void
}

/**
 * The loading screen (see GLOSSARY.md): the globe dimmed, with a ring spinner, until it's ready. Then
 * the dim fades away (at once with reduce motion: the CSS has no fade then) and the loading screen is
 * gone for good. What it shows comes from loadingScreenView; this only draws it.
 */
export function LoadingScreen({ stage, onGone }: LoadingScreenProps) {
  const element = useRef<HTMLDivElement>(null)
  const [gone, setGone] = useState(false)
  const latestOnGone = useRef(onGone)
  const leaving = !loadingScreenView(stage).shown

  useEffect(() => {
    latestOnGone.current = onGone
  }, [onGone])

  // Gone once the fade the CSS gives a leaving loading screen has played, or at once if it gives none.
  useEffect(() => {
    if (!leaving || gone || !element.current) return
    let cancelled = false
    void Promise.all(element.current.getAnimations().map((animation) => animation.finished))
      .catch(() => {})
      .then(() => {
        if (cancelled) return
        setGone(true)
        latestOnGone.current()
      })
    return () => {
      cancelled = true
    }
  }, [leaving, gone])

  if (gone) return null
  return (
    <div
      ref={element}
      className={leaving ? 'loading-screen loading-screen--leaving' : 'loading-screen'}
      role="status"
      aria-label={leaving ? undefined : 'Loading ScoreMap'}
      aria-busy={!leaving}
    >
      <div className="loading-screen__spinner" />
    </div>
  )
}
