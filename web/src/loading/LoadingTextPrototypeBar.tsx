// PROTOTYPE, throw away: the loading text variants, their floating bar and a pinned preview (see
// loadingTextPrototype.ts). Not for main.
import { useEffect, useState } from 'react'
import { Dimmed } from './LoadingScreen'
import {
  nextPreviewPhrase,
  onTextPrototypeChange,
  previewShown,
  stepPreview,
  stepTextVariant,
  textVariant,
} from './loadingTextPrototype'

function useTextPrototype() {
  const [, redraw] = useState(0)
  useEffect(() => onTextPrototypeChange(() => redraw((n) => n + 1)), [])
}

/** The message under the rocket, as the variant draws it. Keyed by the phrase, so each starts afresh. */
export function PrototypeMessage({ text }: { text: string }) {
  useTextPrototype()
  const key = `${textVariant().key}:${text}`
  switch (textVariant().key) {
    case 'B':
      return <Readout key={key} text={text} msPerLetter={32} />
    case 'B2':
      return <Readout key={key} text={text} msPerLetter={10} />
    case 'C':
      return <TitleCard key={key} text={text} />
    case 'D':
      return <Plaque key={key} text={text} />
    case 'E':
      return <DriftingWords key={key} text={text} msPerWord={90} />
    case 'E2':
      return <DriftingWords key={key} text={text} msPerWord={35} fast />
    default:
      return <p className="loading-screen__message">{text}</p>
  }
}

/** B: typed out a letter at a time behind a block cursor, the untyped rest held in place unseen. */
function Readout({ text, msPerLetter, lettersPerTick = 1 }: { text: string; msPerLetter: number; lettersPerTick?: number }) {
  const [typed, setTyped] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? text.length : 0,
  )
  useEffect(() => {
    const timer = setInterval(() => setTyped((n) => Math.min(text.length, n + lettersPerTick)), msPerLetter)
    return () => clearInterval(timer)
  }, [text, msPerLetter, lettersPerTick])
  return (
    <div className="loading-screen__message ltp-readout">
      <span className="ltp-readout__label">Transmission</span>
      <p className="ltp-readout__text">
        {text.slice(0, typed)}
        <span className="ltp-readout__cursor" aria-hidden="true" />
        <span className="ltp-readout__rest" aria-hidden="true">{text.slice(typed)}</span>
      </p>
    </div>
  )
}

/** C: large light type with a gold shimmer passing over it, over lines drawn out from a twinkling sparkle. */
function TitleCard({ text }: { text: string }) {
  return (
    <div className="loading-screen__message ltp-title">
      <p className="ltp-title__text">
        <span className="ltp-title__words">{text}</span>
      </p>
      <span className="ltp-title__ornament" aria-hidden="true">
        <span className="ltp-title__rule" />
        <span className="ltp-title__sparkle">✦</span>
        <span className="ltp-title__rule" />
      </span>
    </div>
  )
}

/** D: a broadcast plaque, a Mission Control label with a live dot over the message. */
function Plaque({ text }: { text: string }) {
  return (
    <div className="loading-screen__message ltp-plaque-place">
      <div className="ltp-plaque">
        <span className="ltp-plaque__label">
          <span className="ltp-plaque__dot" aria-hidden="true" />
          Mission Control
        </span>
        <p className="ltp-plaque__text">{text}</p>
      </div>
    </div>
  )
}

/** E: the words drift in one after another, the closing ellipsis three glowing dots in turn. */
function DriftingWords({ text, msPerWord, fast = false }: { text: string; msPerWord: number; fast?: boolean }) {
  const trailing = text.endsWith('…')
  const words = (trailing ? text.slice(0, -1) : text).split(' ')
  return (
    <p className={fast ? 'loading-screen__message ltp-drift ltp-drift--fast' : 'loading-screen__message ltp-drift'} aria-label={text}>
      {words.map((word, at) => (
        <span key={at} className="ltp-drift__word" style={{ animationDelay: `${at * msPerWord}ms` }} aria-hidden="true">
          {word}
          {at < words.length - 1 ? ' ' : ''}
        </span>
      ))}
      {trailing && (
        <span className="ltp-drift__dots" style={{ animationDelay: `${words.length * msPerWord}ms` }} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      )}
    </p>
  )
}

/** A message pinned over the globe, as the cut-off note shows one (the globe still moves under it). */
export function LoadingTextPreview() {
  useTextPrototype()
  const { scenario, phrase } = previewShown()
  if (scenario === 'off') return null
  return <Dimmed message={phrase} movable label="Prototype preview" />
}

/** The floating bar: [ and ] cycle the variant (the arrow keys pan the globe), \ picks another phrase. */
export function LoadingTextPrototypeBar() {
  useTextPrototype()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable]')) return
      if (event.key === '[') stepTextVariant(-1)
      else if (event.key === ']') stepTextVariant(1)
      else if (event.key === '\\') nextPreviewPhrase()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const variant = textVariant()
  const { scenario } = previewShown()
  return (
    <div className="ltp-bar" data-keeps-popovers>
      <button type="button" title="Previous ([)" onClick={() => stepTextVariant(-1)}>←</button>
      <span className="ltp-bar__label">
        <strong>{variant.key}</strong>
        <span className="ltp-bar__name">: {variant.name}</span>
      </span>
      <button type="button" title="Next (])" onClick={() => stepTextVariant(1)}>→</button>
      <button type="button" title="Pin a message over the globe" onClick={stepPreview}>Show: {scenario}</button>
      <button type="button" title="Another phrase (\)" onClick={nextPreviewPhrase} disabled={scenario === 'off'}>Phrase</button>
    </div>
  )
}
