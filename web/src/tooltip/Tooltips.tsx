import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isClipped } from './isClipped'
import { tooltipPlace } from './tooltipPlace'

/** How long the pointer rests on something before its tooltip shows, as the browser's own waits. */
const hoverDelay = 500

/** What a tooltip is showing, for what, and the side of it asked for. */
interface Shown {
  text: string
  anchor: DOMRect
  prefer: 'above' | 'left'
}

/**
 * The page's tooltips, as glass (ADR-0018) rather than the browser's own: anything with a
 * `data-tooltip` shows it here, on the pointer resting on it or on keyboard focus; one that changes
 * meanwhile shows at once. The app sets no `title`, so the browser never shows a tooltip of its own;
 * only the local-run tools, which keep the browser's, do. An element marked
 * data-tooltip-side="left" has its tooltip on its left (see tooltipPlace); one marked
 * data-tooltip-when-clipped shows its tooltip only while its text is cut off (see isClipped).
 */
export function Tooltips() {
  const [shown, setShown] = useState<Shown | null>(null)
  const tooltip = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let target: HTMLElement | null = null
    let timer = 0

    const observer = new MutationObserver(() => {
      const text = target?.dataset.tooltip
      if (text != null) setShown((current) => current && { ...current, text })
    })

    const hide = () => {
      window.clearTimeout(timer)
      observer.disconnect()
      target = null
      setShown(null)
    }

    const show = (element: HTMLElement, delay: number) => {
      hide()
      target = element
      const text = element.dataset.tooltip ?? ''
      observer.observe(element, { attributeFilter: ['data-tooltip'] })
      const prefer = element.dataset.tooltipSide === 'left' ? 'left' : 'above'
      const fits = element.hasAttribute('data-tooltip-when-clipped') && !isClipped(element)
      if (text && !fits) timer = window.setTimeout(() => setShown({ text, anchor: element.getBoundingClientRect(), prefer }), delay)
    }

    const tipped = (node: EventTarget | null) => (node instanceof Element ? node.closest<HTMLElement>('[data-tooltip]') : null)

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || (target && target.contains(event.target as Node))) return
      const element = tipped(event.target)
      if (element) show(element, hoverDelay)
      else if (target) hide()
    }
    const onPointerOut = (event: PointerEvent) => {
      if (target && !target.contains(event.relatedTarget as Node | null)) hide()
    }
    const onFocusIn = (event: FocusEvent) => {
      const element = tipped(event.target)
      if (element && element === event.target && element.matches(':focus-visible')) show(element, 0)
    }
    // Put away until the pointer leaves and comes back, as the browser's own tooltips are.
    const dismiss = () => {
      window.clearTimeout(timer)
      setShown(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }

    document.addEventListener('pointerover', onPointerOver)
    document.addEventListener('pointerout', onPointerOut)
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', hide)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      hide()
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointerout', onPointerOut)
      document.removeEventListener('pointerdown', dismiss, true)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [])

  // Placed once it's drawn, from its own size.
  useLayoutEffect(() => {
    const element = tooltip.current
    if (!element || !shown) return
    const { left, top, side } = tooltipPlace(
      shown.anchor,
      { width: element.offsetWidth, height: element.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
      shown.prefer,
    )
    element.style.left = `${left}px`
    element.style.top = `${top}px`
    element.dataset.side = side
  }, [shown])

  if (!shown) return null
  return (
    <div ref={tooltip} className="tooltip" role="tooltip">
      {shown.text}
    </div>
  )
}
