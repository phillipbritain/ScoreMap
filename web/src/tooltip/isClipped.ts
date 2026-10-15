type Box = Pick<HTMLElement, 'scrollWidth' | 'clientWidth' | 'scrollHeight' | 'clientHeight'>

/** Whether an element's text is cut off: wider or taller than the box it's shown in. */
export function isClipped({ scrollWidth, clientWidth, scrollHeight, clientHeight }: Box): boolean {
  return scrollWidth > clientWidth || scrollHeight > clientHeight
}
