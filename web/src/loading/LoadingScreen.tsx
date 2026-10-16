import { useEffect, useRef, useState, type Ref } from 'react'
import type { LoadingStage } from '../globe/globeMap'
import { loadingScreenView } from './loadingScreenView'

/** How often the loading screen looks again at how long it's been in a stage. */
const tickMs = 250

/**
 * The loading screen as the theme tuner holds it up to be looked at (local runs only): off, the dim and
 * rocket, those with the slow message, or leaving, its fade playing once before it goes.
 */
export type LoadingPreview = 'off' | 'rocket' | 'slow' | 'leaving'

interface LoadingScreenProps {
  /** How far the globe's initial load has got (see GlobeMap.stage). */
  stage: LoadingStage
  /** Shows the stage's slow message from the start, as if it had already lasted too long (the tuner's preview). */
  slow?: boolean
  /** Called once the loading screen has gone, its fade played. */
  onGone: () => void
}

/**
 * The loading screen (see GLOSSARY.md): the globe dimmed, with a flying rocket, until it's ready, and a
 * message under the rocket if a stage takes too long. Then
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
  return <Dimmed ref={element} message={view.message} leaving={leaving} label="Loading ScoreMap" />
}

interface DimmedProps {
  ref?: Ref<HTMLDivElement>
  /** Under the rocket, if anything. */
  message: string | null
  /** Its fade playing as it goes. */
  leaving?: boolean
  /** Lets the globe under it be moved, which the loading screen doesn't. */
  movable?: boolean
  /** What a screen reader says it is while it's there. */
  label: string
}

/**
 * The loading screen's look: the globe dimmed, with a flying rocket in the middle and a message under
 * it. The loading screen draws it, and so does the cut-off note (see live/CutOffNote.tsx).
 */
export function Dimmed({ ref, message, leaving = false, movable = false, label }: DimmedProps) {
  const className = ['loading-screen', leaving && 'loading-screen--leaving', movable && 'loading-screen--movable']
    .filter(Boolean)
    .join(' ')
  return (
    <div ref={ref} className={className} role="status" aria-label={leaving ? undefined : label} aria-busy={!leaving}>
      <Rocket />
      {message && <p className="loading-screen__message">{message}</p>}
    </div>
  )
}

/**
 * A little rocket flying up and to the right, bobbing as it goes, its flame flickering and speed lines
 * streaming past, in the theme's colours, with the dim showing through its window.
 */
function Rocket() {
  return (
    <svg className="loading-screen__rocket" viewBox="0 0 64 64" aria-hidden="true">
      <g transform="rotate(45 32 32)">
        <g className="loading-screen__rocket-lines">
          <line x1="20" y1="44" x2="20" y2="56" />
          <line x1="32" y1="50" x2="32" y2="62" />
          <line x1="44" y1="44" x2="44" y2="56" />
        </g>
        <g className="loading-screen__rocket-ship">
          <path className="loading-screen__rocket-flame" d="M27 41 Q32 56 37 41 Z" />
          <path d="M24 29 L16 42 L25 39 Z M40 29 L48 42 L39 39 Z" />
          <path d="M32 4 C41 12 43 26 40 41 H24 C21 26 23 12 32 4 Z" />
          <circle className="loading-screen__rocket-window" cx="32" cy="21" r="4.5" />
        </g>
      </g>
    </svg>
  )
}
