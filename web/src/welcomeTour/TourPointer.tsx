import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { ScreenBox } from '../globe/panelClearance'
import { boxAround, spotlightPadding, tourArrow } from './tourArrow'

interface TourPointerProps {
  /** The step's panel, which the arrow starts from. */
  panel: RefObject<HTMLElement | null>
  /**
   * Finds what the step points at on the page: its elements, lit and pointed at as one box (the
   * rail's groups, a score card). Asked again every frame, so the arrow follows it as the window is
   * resized or it moves; finding none draws nothing.
   */
  target: () => Iterable<Element>
}

/**
 * A welcome tour step's spotlight and arrow: what the step is about is left undimmed (the dim behind
 * the panel clears while this shows, the spotlight dimming all but it), and a flowing arrow in the
 * theme's Live colour runs from the panel's edge to it. Neither catches a press. Drawn in the tour's
 * layer, which it fills.
 */
export function TourPointer({ panel, target }: TourPointerProps) {
  const layer = useRef<HTMLDivElement>(null)
  const findTarget = useRef(target)
  useLayoutEffect(() => {
    findTarget.current = target
  })
  const [boxes, setBoxes] = useState<{ panel: ScreenBox; target: ScreenBox } | null>(null)
  // An id fit for url(#…), whatever characters React's ids use.
  const head = `welcome-tour-arrow-head${useId().replace(/[^\w-]/g, '')}`

  useEffect(() => {
    let frame = 0
    const look = () => {
      frame = requestAnimationFrame(look)
      const origin = layer.current?.getBoundingClientRect()
      const panelBox = panel.current?.getBoundingClientRect()
      const targetBox = boxAround([...findTarget.current()].map((element) => element.getBoundingClientRect()))
      const next =
        origin && panelBox && targetBox ? { panel: within(panelBox, origin), target: within(targetBox, origin) } : null
      setBoxes((current) => (sameBoxes(current, next) ? current : next))
    }
    look()
    return () => cancelAnimationFrame(frame)
  }, [panel])

  const arrow = boxes && tourArrow(boxes.panel, boxes.target)
  return (
    <div ref={layer} className="welcome-tour__pointer" aria-hidden="true">
      {boxes && arrow && (
        <>
          <div
            className="welcome-tour__spotlight"
            style={{
              left: boxes.target.left - spotlightPadding,
              top: boxes.target.top - spotlightPadding,
              width: boxes.target.right - boxes.target.left + 2 * spotlightPadding,
              height: boxes.target.bottom - boxes.target.top + 2 * spotlightPadding,
            }}
          />
          <svg className="welcome-tour__arrow">
            <defs>
              <marker id={head} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0 10 5 0 10z" />
              </marker>
            </defs>
            <path className="welcome-tour__arrow-glow" d={arrow.path} />
            <path className="welcome-tour__arrow-flow" d={arrow.path} markerEnd={`url(#${head})`} />
          </svg>
        </>
      )}
    </div>
  )
}

/** A box on the page, in the pixels of a layer whose own box on the page is `origin`. */
function within(box: ScreenBox, origin: ScreenBox): ScreenBox {
  return {
    left: box.left - origin.left,
    top: box.top - origin.top,
    right: box.right - origin.left,
    bottom: box.bottom - origin.top,
  }
}

function sameBoxes(
  a: { panel: ScreenBox; target: ScreenBox } | null,
  b: { panel: ScreenBox; target: ScreenBox } | null,
): boolean {
  if (!a || !b) return a === b
  return sameBox(a.panel, b.panel) && sameBox(a.target, b.target)
}

function sameBox(a: ScreenBox, b: ScreenBox): boolean {
  return a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom
}
