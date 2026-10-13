import { useEffect, useRef, useState } from 'react'
import type { LoadingStage } from '../globe/globeMap'
import { loadingScreenView } from './loadingScreenView'

/** How often the loading screen looks again at how long it's been in a stage. */
const tickMs = 250

/**
 * The loading screen as the theme tuner holds it up to be looked at (local runs only): off, the dim and
 * spinner, those with the slow message, or leaving, its fade playing once before it goes.
 */
export type LoadingPreview = 'off' | 'spinner' | 'slow' | 'leaving'

interface LoadingScreenProps {
  /** How far the globe's initial load has got (see GlobeMap.stage). */
  stage: LoadingStage
  /** Shows the stage's slow message from the start, as if it had already lasted too long (the tuner's preview). */
  slow?: boolean
  /** Called once the loading screen has gone, its fade played. */
  onGone: () => void
}

/**
 * The loading screen (see GLOSSARY.md): the globe dimmed, with a ring spinner, until it's ready, and a
 * message under the spinner if a stage takes too long. Then
 * the dim fades away (at once with reduce motion: the CSS has no fade then) and the loading screen is
 * gone for good. What it shows comes from loadingScreenView; this only draws it.
 */
export function LoadingScreen({ stage, slow = false, onGone }: LoadingScreenProps) {
  const element = useRef<HTMLDivElement>(null)
  const [gone, setGone] = useState(false)
  const latestOnGone = useRef(onGone)
  // How long it's been in this stage: it starts again from nothing whenever the stage changes.
  const [elapsed, setElapsed] = useState({ stage, ms: 0 })
  const msInStage = elapsed.stage === stage ? elapsed.ms : 0
  const view = loadingScreenView(stage, slow ? Infinity : msInStage)
  const leaving = !view.shown

  useEffect(() => {
    if (stage === 'ready') return
    const since = performance.now()
    const timer = setInterval(() => setElapsed({ stage, ms: performance.now() - since }), tickMs)
    return () => clearInterval(timer)
  }, [stage])

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
      {view.message && <p className="loading-screen__message">{view.message}</p>}
    </div>
  )
}
