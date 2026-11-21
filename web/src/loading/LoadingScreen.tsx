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
 * beyond, in the rocket's own frame, then turned with the rocket to fly up and to the right: each across
 * (x) and down (y) its box, in the rocket's units (64 across), how far along its stream it starts (0 to
 * 1), and how near it is (0 to 1), nearer stars bigger and quicker. Turned here rather than by the page,
 * so each star stays a crisp dot.
 */
const stars = Array.from({ length: 22 }, (_, at) => {
  const spread = (n: number) => {
    const x = Math.sin((at + 1) * 12.9898 * n + 311.932) * 43758.5453
    return x - Math.floor(x)
  }
  const [across, down] = [-14 + spread(1) * 92 - 32, -14 + spread(2) * 92 - 32]
  const turn = Math.SQRT1_2
  return { x: 32 + (across - down) * turn, y: 32 + (across + down) * turn, along: spread(2), near: spread(3) }
})

/** The rocket's drawing, 64 units across, its nose up: the ship, and each layer of its flame. */
const rocketBox = '0 0 64 64'

/**
 * A little rocket flying up and to the right, bobbing as it goes, its two-layer flame flickering and
 * stars streaming past it, in the theme's colors, with the dim showing through its window. The stars
 * fade out toward the edge of a circle around it.
 *
 * Each moving part is an element of its own (a star, the ship, each layer of the flame), moved only by
 * its transform, so the browser's compositor flies it smoothly even while the page is busy loading:
 * it can't run an animation on a shape inside an SVG drawing.
 */
function Rocket() {
  return (
    <div className="loading-screen__rocket" aria-hidden="true">
      <div className="loading-screen__rocket-stars">
        {stars.map(({ x, y, along, near }, at) => (
          <span
            key={at}
            style={{
              left: `${((x + 14) / 92) * 100}%`,
              top: `${((y + 14) / 92) * 100}%`,
              animationDuration: `${0.45 + (1 - near) * 0.8}s`,
              animationDelay: `${-along * 1.3}s`,
            }}
          >
            <svg viewBox="-1.5 -1.5 3 3">
              <circle r={0.5 + near * 0.9} />
            </svg>
          </span>
        ))}
      </div>
      <div className="loading-screen__rocket-heading">
        <div className="loading-screen__rocket-ship">
          <div className="loading-screen__rocket-flame loading-screen__rocket-flame--outer">
            <svg viewBox={rocketBox}>
              <path d="M25.5 41 Q32 62 38.5 41 Z" />
            </svg>
          </div>
          <div className="loading-screen__rocket-flame loading-screen__rocket-flame--inner">
            <svg viewBox={rocketBox}>
              <path d="M28.5 41 Q32 54 35.5 41 Z" />
            </svg>
          </div>
          <svg className="loading-screen__rocket-body" viewBox={rocketBox}>
            <path d="M24 29 L16 42 L25 39 Z M40 29 L48 42 L39 39 Z" />
            <path d="M32 4 C41 12 43 26 40 41 H24 C21 26 23 12 32 4 Z" />
            <circle className="loading-screen__rocket-window" cx="32" cy="21" r="4.5" />
          </svg>
        </div>
      </div>
    </div>
  )
}
