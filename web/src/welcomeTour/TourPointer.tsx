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
  /**
   * Where on the target the arrow ends, if not at its edge facing the panel: these elements' side
   * facing the panel, level with their middle (a score card's teams). Asked again every frame too.
   */
  aim?: () => Iterable<Element>
  /**
   * Makes what's lit part of the tour: a press on it (or its button, for the keyboard) calls this,
   * named by `targetLabel`. Without it, the lit target can't be pressed, as the dim catches it.
   */
  onTargetClick?: () => void
  targetLabel?: string
}

interface Boxes {
  panel: ScreenBox
  target: ScreenBox
  aim: ScreenBox | null
}

/**
 * A welcome tour step's spotlight and arrow: what the step is about is left undimmed (the dim behind
 * the panel clears while this shows, the spotlight dimming all but it), and a flowing arrow in the
 * theme's Live colour runs from the panel's edge to it. Neither catches a press; the lit target can
 * be given its own button over it (Click a score card's card). Drawn in the tour's layer, which it fills.
 */
export function TourPointer({ panel, target, aim, onTargetClick, targetLabel }: TourPointerProps) {
  const layer = useRef<HTMLDivElement>(null)
  const find = useRef({ target, aim })
  useLayoutEffect(() => {
    find.current = { target, aim }
  })
  const [boxes, setBoxes] = useState<Boxes | null>(null)
  // An id fit for url(#…), whatever characters React's ids use.
  const head = `welcome-tour-arrow-head${useId().replace(/[^\w-]/g, '')}`

  useEffect(() => {
    let frame = 0
    const look = () => {
      frame = requestAnimationFrame(look)
      const origin = layer.current?.getBoundingClientRect()
      const panelBox = panel.current?.getBoundingClientRect()
      const targetBox = boxOf(find.current.target())
      const aimBox = find.current.aim && boxOf(find.current.aim())
      const next =
        origin && panelBox && targetBox
          ? {
              panel: relativeTo(panelBox, origin),
              target: relativeTo(targetBox, origin),
              aim: aimBox ? relativeTo(aimBox, origin) : null,
            }
          : null
      setBoxes((current) => (sameBoxes(current, next) ? current : next))
    }
    look()
    return () => cancelAnimationFrame(frame)
  }, [panel])

  const arrow =
    boxes && (boxes.aim ? tourArrow(boxes.panel, boxes.aim, 'side') : tourArrow(boxes.panel, boxes.target))
  // The spotlight's hole, where the lit target's own button sits too.
  const hole = boxes && {
    left: boxes.target.left - spotlightPadding,
    top: boxes.target.top - spotlightPadding,
    width: boxes.target.right - boxes.target.left + 2 * spotlightPadding,
    height: boxes.target.bottom - boxes.target.top + 2 * spotlightPadding,
  }
  return (
    <>
      <div ref={layer} className="welcome-tour__pointer" aria-hidden="true">
        {hole && arrow && (
          <>
            <div className="welcome-tour__spotlight" style={hole} />
            <svg className="welcome-tour__arrow">
              <defs>
                <marker id={head} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0 0 10 5 0 10z" />
                </marker>
              </defs>
              <path className="welcome-tour__arrow-flow" d={arrow.path} markerEnd={`url(#${head})`} />
            </svg>
          </>
        )}
      </div>
      {hole && onTargetClick && (
        <button
          type="button"
          className="welcome-tour__target"
          style={hole}
          aria-label={targetLabel}
          onClick={onTargetClick}
        />
      )}
    </>
  )
}

/** The box around some elements on the page, or null for none. */
function boxOf(elements: Iterable<Element>): ScreenBox | null {
  return boxAround([...elements].map((element) => element.getBoundingClientRect()))
}

/** A box on the page, in the pixels of a layer whose own box on the page is `origin`. */
function relativeTo(box: ScreenBox, origin: ScreenBox): ScreenBox {
  return {
    left: box.left - origin.left,
    top: box.top - origin.top,
    right: box.right - origin.left,
    bottom: box.bottom - origin.top,
  }
}

function sameBoxes(a: Boxes | null, b: Boxes | null): boolean {
  if (!a || !b) return a === b
  return sameBox(a.panel, b.panel) && sameBox(a.target, b.target) && sameBox(a.aim, b.aim)
}

function sameBox(a: ScreenBox | null, b: ScreenBox | null): boolean {
  if (!a || !b) return a === b
  return a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom
}
