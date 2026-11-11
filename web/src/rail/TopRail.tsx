import { useEffect, useRef, useState, type ReactNode } from 'react'
import { moveByArrows } from '../menus/arrowKeys'
import { useClickAway } from '../menus/clickAway'
import { RailButton } from './Rail'
import { nextPopover, type PopoverEvent } from './railControls'

/** The top rail's popovers: Scenario (the scenario controls) and Tuners (the theme tuner). */
export type TopRailPopover = 'scenario' | 'tuners'

interface TopRailProps {
  /**
   * The scenario controls, which the Scenario button opens in a popover; with none (hidden by
   * Shift+S, or during the welcome tour) there's no Scenario button.
   */
  scenarioControls?: ReactNode
  /** The tuners' menu, which the Tuners button opens in a popover; with none, there's no Tuners button. */
  tuners?: ReactNode
  /**
   * Whether a tuner's panel is open, which keeps the Tuners button on as its menu does. Pressed while
   * on, the button turns off, closing the menu and the panels (onTunersClose); off, it opens the menu.
   */
  tunersOpen: boolean
  onTunersClose: () => void
}

/**
 * The top rail (local runs only): the local-run tools' buttons side by side at the top left of the
 * globe, as the rail's are, so the rail itself keeps to the live site's buttons. Scenario and Tuners
 * each open a popover below their button, one at a time, closed as the rail's are: by its button,
 * Escape or a click away from it. A pick that's done with its popover ([data-closes-popover], a tuner
 * opened) closes it too. With neither button, it isn't drawn.
 */
export function TopRail({ scenarioControls, tuners, tunersOpen, onTunersClose }: TopRailProps) {
  const [chosen, setOpen] = useState<TopRailPopover | null>(null)
  // A popover closes if what it holds goes (Shift+S).
  const open = (chosen === 'scenario' && !scenarioControls) || (chosen === 'tuners' && !tuners) ? null : chosen
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

  if (!scenarioControls && !tuners) return null
  const tunersOn = open === 'tuners' || tunersOpen

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
          aria-label={name === 'scenario' ? 'Scenario' : 'Tuners'}
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
        {tuners &&
          item(
            'tuners',
            <RailButton
              label="Tuners"
              popover="tuners"
              open={open}
              on={tunersOn}
              tooltipSide="below"
              onClick={() => {
                if (tunersOn) {
                  onTunersClose()
                  setOpen(null)
                } else popoverEvent({ press: 'tuners' })
              }}
            />,
            tuners,
          )}
      </div>
    </div>
  )
}
