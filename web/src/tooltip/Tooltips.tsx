import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
 * The page's tooltips, as glass (ADR-0018) rather than the browser's own: anything with a `title` shows
 * it here, on the pointer resting on it or on keyboard focus, so the parts of the page set a title as
 * usual. While its tooltip is up an element's title is taken off, so the browser doesn't show its own
 * too, and put back after; a title that changes meanwhile shows at once. Places marked
 * [data-native-tooltips] (the local-run tools) keep the browser's. An element marked
 * data-tooltip-side="left" has its tooltip on its left (see tooltipPlace).
 */
export function Tooltips() {
  const [shown, setShown] = useState<Shown | null>(null)
  const tooltip = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let target: HTMLElement | null = null
    let text = ''
    let timer = 0

    const observer = new MutationObserver(() => {
      const next = target?.getAttribute('title')
      if (!target || next == null) return
      text = next
      target.removeAttribute('title')
      setShown((current) => current && { ...current, text })
    })

    const hide = () => {
      window.clearTimeout(timer)
      observer.disconnect()
      if (target && !target.hasAttribute('title')) target.setAttribute('title', text)
      target = null
      setShown(null)
    }

    const show = (element: HTMLElement, delay: number) => {
      hide()
      target = element
      text = element.getAttribute('title') ?? ''
      element.removeAttribute('title')
      observer.observe(element, { attributeFilter: ['title'] })
      const prefer = element.dataset.tooltipSide === 'left' ? 'left' : 'above'
      if (text) timer = window.setTimeout(() => setShown({ text, anchor: element.getBoundingClientRect(), prefer }), delay)
    }

    const titled = (node: EventTarget | null) => {
      if (!(node instanceof Element) || node.closest('[data-native-tooltips]')) return null
      return node.closest<HTMLElement>('[title]')
    }

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || (target && target.contains(event.target as Node))) return
      const element = titled(event.target)
      if (element) show(element, hoverDelay)
      else if (target) hide()
    }
    const onPointerOut = (event: PointerEvent) => {
      if (target && !target.contains(event.relatedTarget as Node | null)) hide()
    }
    const onFocusIn = (event: FocusEvent) => {
      const element = titled(event.target)
      if (element && element === event.target && element.matches(':focus-visible')) show(element, 0)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide()
    }

    document.addEventListener('pointerover', onPointerOver)
    document.addEventListener('pointerout', onPointerOut)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', hide)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', hide, true)
    return () => {
      hide()
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointerout', onPointerOut)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', hide, true)
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
