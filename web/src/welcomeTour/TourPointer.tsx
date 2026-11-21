import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { ScreenBox } from '../globe/panelClearance'
import { boxAround, headLength, spotlightPadding, tourArrow } from './tourArrow'

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
  /** A media query: while it matches, the arrow starts at the middle of the panel's top edge. */
  fromTopWhen?: string
  /** Whether to draw the arrow: without it, only the spotlight shows. */
  arrow?: boolean
  /**
   * Whether the spotlight sits flush on the target, square, rather than with room around it: for a part
   * of the event panel, so the room doesn't take in the panel's parts beside it.
   */
  flush?: boolean
}

interface Boxes {
  panel: ScreenBox
  target: ScreenBox
  aim: ScreenBox | null
  fromTop: boolean
}

/**
 * A welcome tour step's spotlight and arrow: what the step is about is left undimmed (the dim behind
 * the panel clears while this shows, the spotlight dimming all but it), and a flowing arrow in the
 * theme's Live color runs from the panel's edge to it. Neither catches a press; the lit target can
 * be given its own button over it (Click a score card's card). Drawn in the tour's layer, which it fills.
 */
export function TourPointer({ panel, target, aim, onTargetClick, targetLabel, fromTopWhen, arrow: drawArrow = true, flush = false }: TourPointerProps) {
  const layer = useRef<HTMLDivElement>(null)
  const find = useRef({ target, aim, fromTopWhen })
  useLayoutEffect(() => {
    find.current = { target, aim, fromTopWhen }
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
              fromTop: find.current.fromTopWhen !== undefined && window.matchMedia(find.current.fromTopWhen).matches,
            }
          : null
      setBoxes((current) => (sameBoxes(current, next) ? current : next))
    }
    look()
    return () => cancelAnimationFrame(frame)
  }, [panel])

  const startAt = boxes?.fromTop ? 'top' : 'facing'
  const arrow =
    boxes &&
    (boxes.aim ? tourArrow(boxes.panel, boxes.aim, 'side', startAt) : tourArrow(boxes.panel, boxes.target, 'facing', startAt))
  // The spotlight's hole, where the lit target's own button sits too.
  const room = flush ? 0 : spotlightPadding
  const hole = boxes && {
    left: boxes.target.left - room,
    top: boxes.target.top - room,
    width: boxes.target.right - boxes.target.left + 2 * room,
    height: boxes.target.bottom - boxes.target.top + 2 * room,
    ...(flush && { borderRadius: 0 }),
  }
  return (
    <>
      <div ref={layer} className="welcome-tour__pointer" aria-hidden="true">
        {hole && arrow && (
          <>
            <div className="welcome-tour__spotlight" style={hole} />
            <svg className="welcome-tour__arrow">
              <defs>
                {/* Its base at the line's end, its tip headLength on (see tourArrow). */}
                <marker
                  id={head}
                  viewBox="0 0 10 10"
                  refX="0"
                  refY="5"
                  markerUnits="userSpaceOnUse"
                  markerWidth={headLength}
                  markerHeight={headLength}
                  orient="auto"
                >
                  <path d="M0 0 10 5 0 10z" />
                </marker>
              </defs>
              {drawArrow && <path className="welcome-tour__arrow-flow" d={arrow.path} markerEnd={`url(#${head})`} />}
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
  return sameBox(a.panel, b.panel) && sameBox(a.target, b.target) && sameBox(a.aim, b.aim) && a.fromTop === b.fromTop
}

function sameBox(a: ScreenBox | null, b: ScreenBox | null): boolean {
  if (!a || !b) return a === b
  return a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom
}
