import { useEffect, useRef, useState, type ReactNode } from 'react'
import { moveByArrows } from '../menus/arrowKeys'
import { useClickAway } from '../menus/clickAway'
import { RailButton } from './Rail'
import { nextPopover, type PopoverEvent } from './railControls'

/** The top rail's popover: Scenario (the scenario controls). */
export type TopRailPopover = 'scenario'

interface TopRailProps {
  /**
   * The scenario controls, which the Scenario button opens in a popover; with none (hidden by
   * Shift+S, or during the welcome tour) there's no Scenario button.
   */
  scenarioControls?: ReactNode
}

/**
 * The top rail (local runs only): the local-run tools' button at the top left of the globe, as the
 * rail's are, so the rail itself keeps to the live site's buttons. Scenario opens a popover below its
 * button, closed as the rail's are: by its button, Escape or a click away from it. A pick that's done
 * with its popover ([data-closes-popover]) closes it too. With no button, it isn't drawn.
 */
export function TopRail({ scenarioControls }: TopRailProps) {
  const [chosen, setOpen] = useState<TopRailPopover | null>(null)
  // A popover closes if what it holds goes (Shift+S).
  const open = chosen === 'scenario' && !scenarioControls ? null : chosen
  const popover = useRef<HTMLDivElement>(null)
  const popoverEvent = (event: PopoverEvent<TopRailPopover>) => setOpen((current) => nextPopover(current, event))

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen((current) => nextPopover(current, 'escape'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  useClickAway(
    open !== null,
    (target) => !!popover.current?.contains(target) || !!target.closest('[data-popover-button]'),
    () => setOpen((current) => nextPopover(current, 'outside')),
  )

  if (!scenarioControls) return null

  // Each button with its popover, which hangs below the row, at its left (see .top-rail).
  const item = (name: TopRailPopover, button: ReactNode, content: ReactNode) => (
    <div className="top-rail__item">
      {button}
      {open === name && (
        <div
          ref={popover}
          id="top-rail-popover"
          className={`rail__popover top-rail__popover rail__popover--${name}`}
          role="dialog"
          aria-label="Scenario"
          onKeyDown={(event) => moveByArrows(event.nativeEvent, event.currentTarget)}
          onClick={(event) => {
            if ((event.target as Element).closest('[data-closes-popover]')) setOpen(null)
          }}
        >
          {content}
        </div>
      )}
    </div>
  )

  return (
    <div
      className="top-rail"
      onKeyDown={(event) => {
        const key = event.key
        const onItsButton = open && (event.target as Element).closest(`[data-popover-button="${open}"]`)
        if (onItsButton && popover.current && (key === 'ArrowDown' || key === 'ArrowUp')) moveByArrows(event.nativeEvent, popover.current)
      }}
    >
      <div className="rail__group top-rail__group">
        {scenarioControls &&
          item(
            'scenario',
            <RailButton label="Scenario" popover="scenario" open={open} tooltipSide="below" onClick={() => popoverEvent({ press: 'scenario' })} />,
            scenarioControls,
          )}
      </div>
    </div>
  )
}
