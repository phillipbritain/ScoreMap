import { useEffect, useRef, useState, type Ref } from 'react'
import type { LoadingStage } from '../globe/globeMap'
import { usePhrase } from './loadingPhrases'
import { loadingScreenView } from './loadingScreenView'

/** How often the loading screen looks again at how long it's been in a stage. */
const tickMs = 250

interface LoadingScreenProps {
  /** How far the globe's initial load has got (see GlobeMap.stage). */
  stage: LoadingStage
  /** Starts a fresh globe after an initialization failure. */
  onRetry?: () => void
  /** Called once the loading screen has gone, its fade played. */
  onGone: () => void
}

/**
 * The loading screen (see GLOSSARY.md): the globe dimmed, with a flying rocket and a message under it
 * saying it's loading, or what's holding it up if a stage takes too long, until it's ready. Then
 * the dim fades away (at once with reduce motion: the CSS has no fade then) and the loading screen is
 * gone for good. What it shows comes from loadingScreenView; this only draws it.
 */
export function LoadingScreen({ stage, onRetry, onGone }: LoadingScreenProps) {
  const element = useRef<HTMLDivElement>(null)
  const [gone, setGone] = useState(false)
  const latestOnGone = useRef(onGone)
  // How long it's been in this stage: it starts again from nothing whenever the stage changes.
  const [elapsed, setElapsed] = useState({ stage, ms: 0 })
  const msInStage = elapsed.stage === stage ? elapsed.ms : 0
  const view = loadingScreenView(stage, msInStage)
  const message = usePhrase(view.message)
  const leaving = !view.shown
  const failed = stage === 'styleError' || stage === 'constructionError'

  useEffect(() => {
    if (stage === 'ready' || failed) return
    const since = performance.now()
    const timer = setInterval(() => setElapsed({ stage, ms: performance.now() - since }), tickMs)
    return () => clearInterval(timer)
  }, [stage, failed])

  useEffect(() => {
    latestOnGone.current = onGone
  }, [onGone])

  // Gone once the fade the CSS gives a leaving loading screen has played, or at once if it gives none.
  useEffect(() => {
    if (!leaving || gone || !element.current) return
    let canceled = false
    void Promise.all(element.current.getAnimations().map((animation) => animation.finished))
      .catch(() => {})
      .then(() => {
        if (canceled) return
        setGone(true)
        latestOnGone.current()
      })
    return () => {
      // Effect-local cancellation flag; this variable is never read during render.
      // oxlint-disable-next-line react/immutability
      canceled = true
    }
  }, [leaving, gone])

  if (gone) return null
  if (failed) return (
    <div className="loading-screen" role="alert">
      <div className="loading-screen__error">
        <p>{message}</p>
        <button type="button" className="loading-screen__retry" onClick={onRetry}>Try again</button>
      </div>
    </div>
  )
  return <Dimmed ref={element} message={message} leaving={leaving} label="Loading ScoreMap" />
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
 * it, drifting in word by word. The loading screen draws it, and so does the cut-off note (see
 * live/CutOffNote.tsx).
 */
export function Dimmed({ ref, message, leaving = false, movable = false, label }: DimmedProps) {
  const className = ['loading-screen', leaving && 'loading-screen--leaving', movable && 'loading-screen--movable']
    .filter(Boolean)
    .join(' ')
  return (
    <div ref={ref} className={className} role="status" aria-label={leaving ? undefined : label} aria-busy={!leaving}>
      <Rocket />
      {message && <Message key={message} text={message} />}
    </div>
  )
}

/** How long after one word of the message the next starts drifting in. */
const msPerWord = 35

/**
 * The message under the rocket, its words drifting up into place one after another, glowing; a closing
 * ellipsis is three dots lit in turn. Keyed by the message, so a new one drifts in afresh.
 */
function Message({ text }: { text: string }) {
  const trailing = text.endsWith('…')
  const words = (trailing ? text.slice(0, -1) : text).split(' ')
  return (
    <p className="loading-screen__message">
      {words.map((word, at) => (
        <span key={at} className="loading-screen__word" style={{ animationDelay: `${at * msPerWord}ms` }}>
          {at < words.length - 1 ? `${word} ` : word}
        </span>
      ))}
      {trailing && (
        <span className="loading-screen__dots" style={{ animationDelay: `${words.length * msPerWord}ms` }} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      )}
    </p>
  )
}

/**
 * The stars streaming past the rocket, spread steadily (the same each time) across its box and a little
 * beyond, in the rocket's own frame: each across (x), down (y) and how near it is (0 to 1), nearer
 * stars bigger and quicker.
 */
const stars = Array.from({ length: 22 }, (_, at) => {
  const spread = (n: number) => {
    const x = Math.sin((at + 1) * 12.9898 * n + 311.932) * 43758.5453
    return x - Math.floor(x)
  }
  return { x: -14 + spread(1) * 92, y: -14 + spread(2) * 92, near: spread(3) }
})

/**
 * A little rocket flying up and to the right, bobbing as it goes, its two-layer flame flickering and
 * stars streaming past it, in the theme's colors, with the dim showing through its window. The stars
 * fade out toward the edge of a circle around it.
 */
function Rocket() {
  return (
    <svg className="loading-screen__rocket" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="loading-screen-stars-fade">
          <stop offset="0.5" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id="loading-screen-stars-mask">
          <circle cx="32" cy="32" r="46" fill="url(#loading-screen-stars-fade)" />
        </mask>
      </defs>
      <g mask="url(#loading-screen-stars-mask)">
        <g className="loading-screen__rocket-stars" transform="rotate(45 32 32)">
          {stars.map(({ x, y, near }, at) => (
            <circle
              key={at}
              cx={x}
              cy={y}
              r={0.5 + near * 0.9}
              style={{ animationDuration: `${0.45 + (1 - near) * 0.8}s`, animationDelay: `${-((y + 14) / 92) * 1.3}s` }}
            />
          ))}
        </g>
      </g>
      <g transform="rotate(45 32 32)">
        <g className="loading-screen__rocket-ship">
          <path className="loading-screen__rocket-flame loading-screen__rocket-flame--outer" d="M25.5 41 Q32 62 38.5 41 Z" />
          <path className="loading-screen__rocket-flame loading-screen__rocket-flame--inner" d="M28.5 41 Q32 54 35.5 41 Z" />
          <path d="M24 29 L16 42 L25 39 Z M40 29 L48 42 L39 39 Z" />
          <path d="M32 4 C41 12 43 26 40 41 H24 C21 26 23 12 32 4 Z" />
          <circle className="loading-screen__rocket-window" cx="32" cy="21" r="4.5" />
        </g>
      </g>
    </svg>
  )
}
