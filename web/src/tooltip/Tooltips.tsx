import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isClipped } from './isClipped'
import { tooltipPlace, type Box, type TooltipPrefer } from './tooltipPlace'

/** How long the pointer rests on something before its tooltip shows, as the browser's own waits. */
const hoverDelay = 500

/** How long a tooltip shown by a tap stays, unless something puts it away sooner. */
const tapShowFor = 5000

/** What a tooltip is showing, for what, and the side of it asked for. */
interface Shown {
  text: string
  anchor: Box
  prefer: TooltipPrefer
}

/**
 * The page's tooltips, as glass (ADR-0018) rather than the browser's own: anything with a
 * `data-tooltip` shows it here, on the pointer resting on it or on keyboard focus; one that changes
 * meanwhile shows at once. The app sets no `title`, so the browser never shows a tooltip of its own;
 * only the local-run tools, which keep the browser's, do. An element marked
 * data-tooltip-side="left" or "right" has its tooltip on that side (see tooltipPlace), past that edge
 * of the nearest element marked data-tooltip-edge around it, if any (the Games list), rather than its own. One marked data-tooltip-when-clipped shows its tooltip only while its
 * text is cut off (see isClipped); on a touch screen, where nothing hovers, a tap on it shows the tooltip
 * then, in place of whatever the tap would do, for a few seconds, and a second tap does what a tap does
 * (a link goes where it goes).
 */
export function Tooltips() {
  const [shown, setShown] = useState<Shown | null>(null)
  const tooltip = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let target: HTMLElement | null = null
    let timer = 0
    // The kind of pointer last pressed, so a click can tell a tap from a mouse's.
    let pointerType = 'mouse'
    // The cut-off text a tap is showing in full, so the next tap on it does what it would have done.
    let tapped: Element | null = null
    let tapTimer = 0

    const observer = new MutationObserver(() => {
      const text = target?.dataset.tooltip
      if (text != null) setShown((current) => current && { ...current, text })
    })

    const hide = () => {
      window.clearTimeout(timer)
      window.clearTimeout(tapTimer)
      tapped = null
      observer.disconnect()
      target = null
      setShown(null)
    }

    const show = (element: HTMLElement, delay: number) => {
      hide()
      target = element
      const text = element.dataset.tooltip ?? ''
      observer.observe(element, { attributeFilter: ['data-tooltip'] })
      const side = element.dataset.tooltipSide
      const prefer: TooltipPrefer = side === 'left' || side === 'right' ? side : 'above'
      const clippedText = tooltipText(element)
      const fits = clippedText && !isClipped(clippedText)
      if (!text || fits) return
      const reveal = () => setShown({ text, anchor: anchorOf(element, prefer), prefer })
      // No wait shows it at once, in the same task as the tap or focus that asked for it.
      if (delay === 0) reveal()
      else timer = window.setTimeout(reveal, delay)
    }

    const tipped = (node: EventTarget | null) => (node instanceof Element ? node.closest<HTMLElement>('[data-tooltip]') : null)

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || (target && target.contains(event.target as Node))) return
      const element = tipped(event.target)
      if (element) show(element, hoverDelay)
      else if (target) hide()
    }
    // A touch leaves what it pressed as it lifts, before its click, so only a mouse's leaving counts.
    const onPointerOut = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && target && !target.contains(event.relatedTarget as Node | null)) hide()
    }
    const onFocusIn = (event: FocusEvent) => {
      const element = tipped(event.target)
      if (element && element === event.target && element.matches(':focus-visible')) show(element, 0)
    }
    // Put away until the pointer leaves and comes back, as the browser's own tooltips are.
    const dismiss = () => {
      window.clearTimeout(timer)
      window.clearTimeout(tapTimer)
      tapped = null
      setShown(null)
    }
    // A press puts a tooltip away, but the click it makes still needs to know what a tap was showing.
    const onPointerDown = (event: PointerEvent) => {
      pointerType = event.pointerType
      const showing = tapped
      dismiss()
      tapped = showing
    }
    // A tap on text cut off shows it in full, rather than doing what a tap does there.
    const onClick = (event: MouseEvent) => {
      if (pointerType === 'mouse') return
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-tooltip-when-clipped]') : null
      const again = element !== null && element === tapped
      tapped = null
      const clippedText = element && tooltipText(element)
      if (!element || again || !clippedText?.contains(event.target as Node) || !isClipped(clippedText)) return
      event.preventDefault()
      event.stopPropagation()
      show(element, 0)
      tapped = element
      tapTimer = window.setTimeout(dismiss, tapShowFor)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }

    document.addEventListener('pointerover', onPointerOver)
    document.addEventListener('pointerout', onPointerOut)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', hide)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      hide()
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointerout', onPointerOut)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('click', onClick, true)
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

/** When a whole control has a tooltip for clipped text, the attribute can name its text element. */
function tooltipText(element: HTMLElement): HTMLElement | null {
  const selector = element.getAttribute('data-tooltip-when-clipped')
  return selector === null ? null : selector ? element.querySelector(selector) : element
}

/** The box a tooltip is placed by: its element's, reaching on its side to the edge marked around it, if any. */
function anchorOf(element: HTMLElement, prefer: TooltipPrefer): Box {
  const { left, top, width, height } = element.getBoundingClientRect()
  const edge = prefer === 'above' ? undefined : element.closest('[data-tooltip-edge]')?.getBoundingClientRect()
  if (!edge) return { left, top, width, height }
  return prefer === 'right' ? { left, top, width: edge.right - left, height } : { left: edge.left, top, width: left + width - edge.left, height }
}
