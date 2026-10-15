import type { MouseEvent } from 'react'

type Box = Pick<HTMLElement, 'scrollWidth' | 'clientWidth' | 'scrollHeight' | 'clientHeight'>

/** Whether an element's text is cut off: wider or taller than the box it's shown in. */
export function isClipped({ scrollWidth, clientWidth, scrollHeight, clientHeight }: Box): boolean {
  return scrollWidth > clientWidth || scrollHeight > clientHeight
}

/**
 * Props that show an element's full text on hover, only while the text is cut off. Checked on each
 * hover, as the panel's width and the text both change.
 */
export function titleWhenClipped(text: string) {
  return {
    onMouseEnter: (event: MouseEvent<HTMLElement>) => {
      const element = event.currentTarget
      if (isClipped(element)) element.title = text
      else element.removeAttribute('title')
    },
  }
}
