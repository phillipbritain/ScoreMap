// PROTOTYPE, throwaway: three ways for a phone user to tap cut-off game panel text and see all of it,
// switchable via `?truncationProto=A|B|C` and the bar at the top ([ and ] cycle). Only text that is cut
// off right now reacts to a tap; the rest of the panel behaves as today. A tap is a touch, or any click
// at phone width (so it can be tried with a mouse in a narrow window).
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { isClipped } from './isClipped'
import { tooltipPlace, type Box } from './tooltipPlace'

const variants = [
  { key: 'A', name: 'Bubble above' },
  { key: 'B', name: 'Slide along' },
  { key: 'C', name: 'Unfold in place' },
] as const
type Key = (typeof variants)[number]['key']

const param = 'truncationProto'
const readVariant = (): Key => {
  const value = new URLSearchParams(window.location.search).get(param)
  return variants.find((v) => v.key === value)?.key ?? 'A'
}

interface Revealed {
  element: HTMLElement
  text: string
  box: Box
  font: CSSProperties
}

export function TruncationTapPrototype() {
  const [variant, setVariant] = useState<Key>(readVariant)
  const [revealed, setRevealed] = useState<Revealed | null>(null)
  const current = useRef<Revealed | null>(null)
  const variantRef = useRef(variant)

  const cycle = (step: number) => {
    const i = variants.findIndex((v) => v.key === variant)
    const next = variants[(i + step + variants.length) % variants.length].key
    const url = new URL(window.location.href)
    url.searchParams.set(param, next)
    window.history.replaceState(null, '', url)
    setRevealed(null)
    setVariant(next)
  }
  const cycleRef = useRef(cycle)
  useLayoutEffect(() => {
    current.current = revealed
    variantRef.current = variant
    cycleRef.current = cycle
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable]')) return
      if (event.key === '[') cycleRef.current(-1)
      if (event.key === ']') cycleRef.current(1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    let pointerType = 'mouse'
    let timer = 0
    let slide: (() => void) | null = null
    let sliding: HTMLElement | null = null
    const onPointerDown = (event: PointerEvent) => {
      pointerType = event.pointerType
    }
    const hide = () => {
      window.clearTimeout(timer)
      slide?.()
      slide = null
      sliding = null
      setRevealed(null)
    }
    const onClick = (event: MouseEvent) => {
      const tap = pointerType !== 'mouse' || window.matchMedia('(max-width: 960px)').matches
      const element = (event.target as Element).closest?.<HTMLElement>('.game-panel [data-tooltip-when-clipped]')
      const shown = current.current?.element
      if (shown && element === shown) {
        // A second tap on what's shown: a link goes where it goes, anything else is put away.
        hide()
        return
      }
      if (shown) hide()
      if (!tap || !element || !isClipped(element)) return
      event.preventDefault()
      event.stopPropagation()
      const style = getComputedStyle(element)
      const { left, top, width, height } = element.getBoundingClientRect()
      const next: Revealed = {
        element,
        text: element.dataset.tooltip ?? element.textContent ?? '',
        box: { left, top, width, height },
        font: {
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          letterSpacing: style.letterSpacing,
          textTransform: style.textTransform as CSSProperties['textTransform'],
          lineHeight: style.lineHeight,
          color: style.color,
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
        },
      }
      setRevealed(next)
      if (variantRef.current === 'A') timer = window.setTimeout(hide, 5000)
      if (variantRef.current === 'B') {
        sliding = element
        slide = slideAlong(element, hide)
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('click', onClick, true)
    // The slide's own scrolling doesn't put it away.
    const onScroll = (event: Event) => {
      if (event.target !== sliding) hide()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', hide)
    return () => {
      hide()
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', hide)
    }
  }, [])

  const name = variants.find((v) => v.key === variant)?.name
  return (
    <>
      {revealed && variant === 'A' && <Bubble revealed={revealed} />}
      {revealed && variant === 'C' && <Unfold revealed={revealed} />}
      <div style={barStyle}>
        <button type="button" style={arrowStyle} onClick={() => cycle(-1)} aria-label="Previous variant">
          [
        </button>
        <span style={{ whiteSpace: 'nowrap' }}>
          {variant} ({name})
        </span>
        <button type="button" style={arrowStyle} onClick={() => cycle(1)} aria-label="Next variant">
          ]
        </button>
      </div>
    </>
  )
}

/** A: the hover tooltip's glass bubble, above the text (below where there's no room), for 5 s or until the next tap. */
function Bubble({ revealed }: { revealed: Revealed }) {
  const bubble = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = bubble.current
    if (!element) return
    const { left, top, side } = tooltipPlace(
      revealed.box,
      { width: element.offsetWidth, height: element.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    )
    element.style.left = `${left}px`
    element.style.top = `${top}px`
    element.dataset.side = side
  }, [revealed])
  return (
    <div ref={bubble} className="tooltip" role="tooltip" style={{ zIndex: 6 }}>
      {revealed.text}
    </div>
  )
}

/** B: the line itself slides along to its end, holds, and slides back, at reading pace. */
function slideAlong(element: HTMLElement, done: () => void): () => void {
  const distance = element.scrollWidth - element.clientWidth
  const travel = Math.max(600, (distance / 60) * 1000)
  const hold = 1500
  const textOverflow = element.style.textOverflow
  element.style.textOverflow = 'clip'
  const start = performance.now()
  let frame = 0
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
  const step = (now: number) => {
    const t = now - start
    if (t < travel) element.scrollLeft = distance * ease(t / travel)
    else if (t < travel + hold) element.scrollLeft = distance
    else if (t < 2 * travel + hold) element.scrollLeft = distance * (1 - ease((t - travel - hold) / travel))
    else return done()
    frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
  return () => {
    cancelAnimationFrame(frame)
    element.scrollLeft = 0
    element.style.textOverflow = textOverflow
  }
}

/** C: a glass sheet over the line, in its own type, as wide as it, wrapping the whole text down over what's below (up, near the screen's foot). */
function Unfold({ revealed }: { revealed: Revealed }) {
  const sheet = useRef<HTMLDivElement>(null)
  const { box } = revealed
  const pad = 6
  useLayoutEffect(() => {
    const element = sheet.current
    if (!element) return
    const height = element.offsetHeight
    const top = box.top - pad + height > window.innerHeight - 8 ? box.top + box.height + pad - height : box.top - pad
    element.style.top = `${top}px`
  }, [box])
  return (
    <div
      ref={sheet}
      role="tooltip"
      style={{
        ...revealed.font,
        position: 'fixed',
        zIndex: 6,
        left: box.left - pad,
        top: box.top - pad,
        width: box.width + 2 * pad,
        boxSizing: 'border-box',
        padding: pad,
        paddingLeft: `calc(${revealed.font.paddingLeft} + ${pad}px)`,
        paddingRight: `calc(${revealed.font.paddingRight} + ${pad}px)`,
        borderRadius: 'var(--menu-corner)',
        background: 'var(--tooltip-surface)',
        boxShadow: '0 4px 16px rgb(0 0 0 / 0.35)',
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        animation: 'tooltip-in 140ms ease-out',
        transformOrigin: '50% 0',
      }}
    >
      {revealed.text}
    </div>
  )
}

const barStyle: CSSProperties = {
  position: 'fixed',
  top: 8,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 10px',
  borderRadius: 999,
  background: '#ff0',
  color: '#000',
  font: '600 13px system-ui, sans-serif',
  boxShadow: '0 2px 8px rgb(0 0 0 / 0.5)',
}

const arrowStyle: CSSProperties = {
  border: 'none',
  background: 'none',
  color: '#000',
  font: 'inherit',
  cursor: 'pointer',
  padding: '0 4px',
}
