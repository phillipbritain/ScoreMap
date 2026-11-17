import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { moveByArrows } from '../menus/arrowKeys'
import { useClickAway } from '../menus/clickAway'
import { useLeaving } from '../motion/useLeaving'
import { showScrollThumb } from '../scroll/scrollThumb'
import { RailButton } from './Rail'
import { nextPopover, popoverLeaveDuration, type PopoverEvent } from './railControls'

/** The top rail's popover: Scenario (the scenario controls). */
export type TopRailPopover = 'scenario'

interface TopRailProps {
  /**
   * The scenario controls, which the Scenario button opens in a popover; with none (on the deployed
   * site, or during the welcome tour) there's no Scenario button.
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
  // A popover closes if what it holds goes (the welcome tour starting).
  const open = chosen === 'scenario' && !scenarioControls ? null : chosen
  const { shown, leaving, key: popoverKey } = useLeaving(open, popoverLeaveDuration)
  const popover = useRef<HTMLDivElement>(null)
  // The popover, with the app's scrollbar drawn in it on a touch screen (see showScrollThumb).
  const popoverRef = useCallback((element: HTMLDivElement | null) => {
    popover.current = element
    const hide = element ? showScrollThumb(element) : undefined
    return () => {
      popover.current = null
      hide?.()
    }
  }, [])
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
      {shown === name && (
        <div
          key={popoverKey}
          ref={leaving ? undefined : popoverRef}
          id={leaving ? undefined : 'top-rail-popover'}
          className={`rail__popover top-rail__popover rail__popover--${name}${leaving ? ' rail__popover--leaving' : ''}`}
          role="dialog"
          aria-label="Scenario"
          aria-hidden={leaving || undefined}
          inert={leaving}
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
