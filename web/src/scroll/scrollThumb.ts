/**
 * The app's own scrollbar on a touch screen: a thin bar drawn at the right of a scrolling area for as
 * long as it overflows, so a viewer can tell there's more further down. Safari on iPhone ignores the
 * app's scrollbar styling (see index.css) and draws its own only while scrolling, then fades it, so the
 * app draws one there instead and hides the browser's. Elsewhere the browser's own, always shown, is used.
 */

/** Where a touch screen is, on which the app draws its own scrollbar. */
const touchScreen = '(pointer: coarse)'

/** The shortest the bar gets, so it stays easy to see on a long list. */
const shortestThumb = 24

/** The bar's place in a scrolling area, in pixels from the top of what it scrolls; null when nothing overflows. */
export interface ThumbPlace {
  top: number
  height: number
}

/**
 * Where the bar sits for a scrolling area's sizes: as long as the share of it on show (but no shorter
 * than shortestThumb), as far down the area as it's scrolled. Measured from the top of what scrolls, as
 * the bar scrolls with it. Null when it all fits.
 */
export function thumbPlace(scrollTop: number, clientHeight: number, scrollHeight: number): ThumbPlace | null {
  const room = scrollHeight - clientHeight
  if (room < 1 || clientHeight <= 0) return null
  const height = Math.min(clientHeight, Math.max(shortestThumb, (clientHeight * clientHeight) / scrollHeight))
  const scrolled = Math.min(1, Math.max(0, scrollTop / room))
  return { top: scrollTop + scrolled * (clientHeight - height), height }
}

/**
 * Draws the app's scrollbar in a scrolling area on a touch screen, following it as it scrolls, is
 * resized or what it holds changes; nothing elsewhere. Returns what takes it away again.
 */
export function showScrollThumb(area: HTMLElement): () => void {
  if (!window.matchMedia(touchScreen).matches) return () => {}
  const thumb = document.createElement('span')
  thumb.className = 'scroll-thumb'
  thumb.setAttribute('aria-hidden', 'true')
  area.classList.add('has-scroll-thumb')
  // The bar is placed within the area, so it must place its children.
  const placedBefore = area.style.position
  if (getComputedStyle(area).position === 'static') area.style.position = 'relative'
  area.append(thumb)

  let frame = 0
  const place = () => {
    frame = 0
    const at = thumbPlace(area.scrollTop, area.clientHeight, area.scrollHeight)
    thumb.hidden = at === null
    if (at) {
      thumb.style.height = `${at.height}px`
      thumb.style.transform = `translateY(${at.top}px)`
    }
  }
  const later = () => {
    if (!frame) frame = requestAnimationFrame(place)
  }
  place()
  area.addEventListener('scroll', later, { passive: true })
  const resized = new ResizeObserver(later)
  resized.observe(area)
  // What it holds changing (a list filtered, a picker opened) changes how far it scrolls, unseen by its size.
  const changed = new MutationObserver((records) => {
    if (records.some((record) => record.target !== thumb)) later()
  })
  changed.observe(area, { childList: true, subtree: true, characterData: true })

  return () => {
    cancelAnimationFrame(frame)
    area.removeEventListener('scroll', later)
    resized.disconnect()
    changed.disconnect()
    thumb.remove()
    area.classList.remove('has-scroll-thumb')
    area.style.position = placedBefore
  }
}

/** A ref that draws the app's scrollbar in the element it's given (see showScrollThumb). */
export function scrollThumbRef(area: HTMLElement | null): (() => void) | undefined {
  return area ? showScrollThumb(area) : undefined
}
