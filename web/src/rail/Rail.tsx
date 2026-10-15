import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Camera } from '../globe/camera'
import type { ZoomSettings } from '../globe/zoomLevels'
import { useClickAway } from '../menus/clickAway'
import type { League, ViewerSettings } from '../settings/viewerSettings'
import { Colours } from './Colours'
import { Leagues } from './Leagues'
import { canZoom, nextPopover, railToggles, toggled, type PopoverEvent, type RailPopover } from './railControls'

interface RailProps {
  leagues: readonly League[]
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
  /**
   * The theme's accent (see accentColour), as #rrggbb, which a sport or league with no colour picked
   * shows hollow in Colours.
   */
  accent: string
  /** Where the globe's camera last settled, or null while the globe can't be moved yet (loading). */
  camera: Camera | null
  /** How far out and in the globe zooms, which the zoom buttons stop at. */
  zoomSettings: ZoomSettings
  onZoomIn: () => void
  onZoomOut: () => void
  /** Flies the camera back to the viewer's region, at the start zoom (see homeCamera). */
  onHome: () => void
  /** Whether the rail can't be used at all, while the welcome tour shows. */
  inert?: boolean
}

/**
 * The rail: a column of icon buttons at the top right of the globe, in three groups. Zoom in, zoom
 * out and Home, which move the camera. The "Live games only" and "Show Disrupted games" toggles, whose
 * colour says whether each is on; on a screen with no hover for their tooltips (a phone), each press
 * shows a short toast beside the rail saying what changed. Leagues and Colours, each opening a popover to the left of the rail: one at a time,
 * closed by its button, Escape or a click away from it, but not by moving or zooming the globe.
 */
export function Rail({ leagues, settings, onChange, accent, camera, zoomSettings, onZoomIn, onZoomOut, onHome, inert = false }: RailProps) {
  const zoom = camera ? canZoom(camera, zoomSettings) : { in: false, out: false }
  const [open, setOpen] = useState<RailPopover | null>(null)
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null)
  const popover = useRef<HTMLDivElement>(null)
  const popoverEvent = (event: PopoverEvent) => setOpen((current) => nextPopover(current, event))

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen((current) => nextPopover(current, 'escape'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  // A popover's button isn't away from it: its own press opens or closes it.
  useClickAway(
    open !== null,
    (target) => !!popover.current?.contains(target) || !!target.closest('[data-popover-button]'),
    () => setOpen((current) => nextPopover(current, 'outside')),
  )

  return (
    <div className="rail" inert={inert}>
      {/* Zooming keeps menus open, as zooming the globe itself does (see useClickAway). */}
      <div className="rail__group" data-keeps-popovers>
        <RailButton label="Zoom in" disabled={!zoom.in} onClick={onZoomIn}>
          <path d="M12 5v14M5 12h14" />
        </RailButton>
        <RailButton label="Zoom out" disabled={!zoom.out} onClick={onZoomOut}>
          <path d="M5 12h14" />
        </RailButton>
        <RailButton label="Home" disabled={!camera} onClick={onHome}>
          <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
        </RailButton>
      </div>
      <div className="rail__group">
        {railToggles.map(({ key, name }) => (
          <RailButton
            key={key}
            label={name}
            pressed={settings[key]}
            onClick={() => {
              const next = toggled(settings, key)
              onChange(next.settings)
              // With hover, the tooltip names the toggle and its colour says the rest.
              if (!window.matchMedia(hoverScreen).matches) setToast({ text: next.toast, id: (toast?.id ?? 0) + 1 })
            }}
          >
            {key === 'liveOnly' ? <LiveIcon /> : <DisruptedIcon />}
          </RailButton>
        ))}
        {toast && (
          // Keyed, so a second press while it shows plays its fade afresh. Gone once it has faded.
          <p key={toast.id} className="rail__toast" role="status" onAnimationEnd={() => setToast(null)}>
            {toast.text}
          </p>
        )}
      </div>
      <div className="rail__group">
        <RailButton label="Leagues" popover="leagues" open={open} onClick={() => popoverEvent({ press: 'leagues' })}>
          <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </RailButton>
        <RailButton label="Colours" popover="colours" open={open} onClick={() => popoverEvent({ press: 'colours' })}>
          <PaletteIcon />
        </RailButton>
      </div>
      {open && (
        <div ref={popover} id="rail-popover" className="rail__popover" role="dialog" aria-label={popoverNames[open]}>
          {open === 'leagues' ? (
            <Leagues leagues={leagues} settings={settings} onChange={onChange} />
          ) : (
            <Colours leagues={leagues} settings={settings} onChange={onChange} accent={accent} />
          )}
        </div>
      )}
    </div>
  )
}

const hoverScreen = '(hover: hover)'

const popoverNames: Record<RailPopover, string> = { leagues: 'Leagues', colours: 'Colours' }

/**
 * One of the rail's icon buttons, with its name as a tooltip. A toggle is pressed or not; a popover's
 * button says whether its popover is open.
 */
function RailButton({
  label,
  disabled,
  pressed,
  popover,
  open,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  pressed?: boolean
  popover?: RailPopover
  open?: RailPopover | null
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="rail__button"
      aria-label={label}
      data-tooltip={label}
      // On the left, so it covers none of the rail's other buttons.
      data-tooltip-side="left"
      disabled={disabled}
      aria-pressed={pressed}
      aria-haspopup={popover && 'dialog'}
      aria-expanded={popover && open === popover}
      aria-controls={popover && open === popover ? 'rail-popover' : undefined}
      data-popover-button={popover}
      onClick={onClick}
    >
      <svg
        className="rail__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  )
}

/** Live games only: a broadcast's waves (Feather's "radio"). */
function LiveIcon() {
  return (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14" />
    </>
  )
}

/** Show Disrupted games: a warning triangle (Feather's "alert-triangle"). */
function DisruptedIcon() {
  return <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
}

/** Colours: a painter's palette. */
function PaletteIcon() {
  return (
    <>
      <circle cx="13.5" cy="6.5" r="1" />
      <circle cx="17.5" cy="10.5" r="1" />
      <circle cx="8.5" cy="7.5" r="1" />
      <circle cx="6.5" cy="12.5" r="1" />
      <path d="M12 2a10 10 0 0 0 0 20c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6h1.9A5.6 5.6 0 0 0 22 11c0-5-4.5-9-10-9z" />
    </>
  )
}
